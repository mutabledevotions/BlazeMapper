// Data model factories. Pure functions, plain objects only (structuredClone-friendly).

let idCounter = 0

// Unique-enough id for a session; not persisted-stable across machines, fine for local use.
// Exported so other code (duplicateSelected) can mint ids for cloned strips.
export function newId(prefix) {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

export function newProject() {
  return {
    version: 1,
    units: 'mm',
    grid: { divisions: 20, snap: false, show: true },
    world: { x: 0, y: 0, size: 2000 },
    image: null, // { x, y, scale, rotation, opacity, locked, visible } once loaded; src lives outside the project (see state/project.svelte.js's imageSrc)
    strips: [],
    export: { decimals: 4, forceZ: false, anchors: false, gapPlaceholder: 'previous' }
  }
}

// Grid step derived from the world box, so grid lines always meet its edges
// (world.size / grid.divisions). Falls back to the full world size if divisions
// is zero or negative (defensive -- the UI clamps divisions to >= 1).
export function gridStep(project) {
  const d = project.grid.divisions
  return d > 0 ? project.world.size / d : project.world.size
}

const STRIP_COLORS = ['#4fc3f7', '#ff8a65', '#aed581', '#ba68c8', '#ffd54f', '#4db6ac', '#f06292', '#90a4ae']

// Geometry types whose default shape is sized from ledCount/pitch (a "roughly
// fits" span/circumference/perimeter) rather than built straight from opts.
const CURVE_TYPES = ['bezier', 'arc', 'circle', 'polygon']

export function newStrip(geomType = 'line', opts = {}) {
  const id = newId('strip')
  const colorIdx = idCounter % STRIP_COLORS.length
  const base = {
    id,
    name: opts.name || `Strip ${idCounter}`,
    color: opts.color || STRIP_COLORS[colorIdx],
    channel: opts.channel ?? 0,
    colorType: opts.colorType || 'RGB',
    ledCount: opts.ledCount ?? 30,
    pitch: opts.pitch ?? 16.667,
    spacing: opts.spacing || 'pitch',
    reversed: opts.reversed ?? false,
    z: opts.z ?? 0,
    locked: opts.locked ?? false,
    hidden: opts.hidden ?? false,
    kind: opts.kind || 'strip', // 'strip' | 'pixel' (standalone point LED)
    geom: null
  }
  // Every curve type's default shape depends on the strip's own ledCount/pitch
  // (sized so a default strip roughly fits), so it needs those resolved
  // values, not just whatever opts.geom itself carries.
  const geomOpts = CURVE_TYPES.includes(geomType) ? { ledCount: base.ledCount, pitch: base.pitch, ...opts.geom } : opts.geom
  base.geom = newGeom(geomType, geomOpts)
  // Points strips have no pitch/ledCount of their own -- ledCount mirrors the point
  // list so the strip list / export summary read naturally without special-casing.
  if (geomType === 'points' && opts.ledCount === undefined) {
    base.ledCount = base.geom.pts.length
  }
  return base
}

function newGeom(type, opts = {}) {
  if (type === 'line') {
    return {
      type: 'line',
      p0: opts.p0 || { x: 0, y: 0 },
      angle: opts.angle ?? 0,
      p1: opts.p1 || null // used only in 'fit' spacing mode
    }
  }
  if (type === 'points') {
    return {
      type: 'points',
      pts: opts.pts ? opts.pts.map((p) => ({ x: p.x, y: p.y })) : []
    }
  }
  if (type === 'bezier') {
    if (opts.p0 && opts.c0 && opts.c1 && opts.p1) {
      return {
        type: 'bezier',
        p0: { x: opts.p0.x, y: opts.p0.y },
        c0: { x: opts.c0.x, y: opts.c0.y },
        c1: { x: opts.c1.x, y: opts.c1.y },
        p1: { x: opts.p1.x, y: opts.p1.y }
      }
    }
    // Default: a gentle S from the view centre, p0..p1 spanning roughly
    // (ledCount - 1) * pitch so a default strip's LEDs land close to real
    // pitch spacing, controls at 1/3 and 2/3 along, offset perpendicular with
    // opposite sign for the S bend.
    const center = opts.center || { x: 0, y: 0 }
    const ledCount = Math.max(1, opts.ledCount ?? 10)
    const pitch = opts.pitch > 0 ? opts.pitch : 16.667
    const span = Math.max(pitch, (ledCount - 1) * pitch)
    const half = span / 2
    const p0 = { x: center.x - half, y: center.y }
    const p1 = { x: center.x + half, y: center.y }
    const bow = span * 0.25
    return {
      type: 'bezier',
      p0,
      c0: { x: p0.x + span / 3, y: p0.y - bow },
      c1: { x: p0.x + (span * 2) / 3, y: p0.y + bow },
      p1
    }
  }
  if (type === 'arc') {
    // Fully specified (e.g. a handle drag's patch, or test fixtures): use as given.
    if (opts.center && opts.radius !== undefined) {
      return {
        type: 'arc',
        center: { x: opts.center.x, y: opts.center.y },
        radius: opts.radius,
        startAngle: opts.startAngle ?? 0,
        sweep: opts.sweep ?? 90
      }
    }
    const center = opts.center || { x: 0, y: 0 }
    const ledCount = Math.max(1, opts.ledCount ?? 10)
    const pitch = opts.pitch > 0 ? opts.pitch : 16.667
    const sweep = opts.sweep ?? 90
    // Arc length (radius * sweep in radians) sized to roughly span (ledCount-1)
    // LEDs at pitch, same target as bezier's p0..p1 span.
    const span = Math.max(pitch, (ledCount - 1) * pitch)
    const sweepRad = Math.abs((sweep * Math.PI) / 180) || Math.PI / 2
    const radius = span / sweepRad
    const startAngle = -90 - sweep / 2
    // Offset the circle's own center so the arc's *midpoint* -- not its center
    // of curvature -- sits at `center` (the view-centre stacking point every
    // "Add shape" placement uses), so a fresh arc visually appears where the
    // user clicked instead of ballooning off to one side.
    const midRad = (-90 * Math.PI) / 180
    return {
      type: 'arc',
      center: { x: center.x - radius * Math.cos(midRad), y: center.y - radius * Math.sin(midRad) },
      radius,
      startAngle,
      sweep
    }
  }
  if (type === 'circle') {
    // Fully specified (e.g. a handle drag's patch, or test fixtures): use as given.
    if (opts.center && opts.radius !== undefined) {
      return {
        type: 'circle',
        center: { x: opts.center.x, y: opts.center.y },
        radius: opts.radius,
        startAngle: opts.startAngle ?? 0,
        direction: opts.direction ?? 1
      }
    }
    const center = opts.center || { x: 0, y: 0 }
    const ledCount = Math.max(1, opts.ledCount ?? 10)
    const pitch = opts.pitch > 0 ? opts.pitch : 16.667
    // Circumference sized so ledCount LEDs at pitch roughly wrap it once.
    const radius = (ledCount * pitch) / (2 * Math.PI)
    return {
      type: 'circle',
      center: { x: center.x, y: center.y },
      radius,
      startAngle: opts.startAngle ?? 0,
      direction: opts.direction ?? 1
    }
  }
  if (type === 'polygon') {
    // Fully specified (e.g. a handle drag's patch, or test fixtures): use as given.
    if (opts.center && opts.radius !== undefined) {
      return {
        type: 'polygon',
        center: { x: opts.center.x, y: opts.center.y },
        radius: opts.radius,
        sides: Math.max(3, Math.round(opts.sides ?? 3)),
        rotation: opts.rotation ?? -90
      }
    }
    const center = opts.center || { x: 0, y: 0 }
    const ledCount = Math.max(1, opts.ledCount ?? 10)
    const pitch = opts.pitch > 0 ? opts.pitch : 16.667
    const sides = Math.max(3, Math.round(opts.sides ?? 3))
    // Perimeter sized so ledCount LEDs at pitch roughly wrap it once.
    const perimeter = ledCount * pitch
    const radius = perimeter / (sides * 2 * Math.sin(Math.PI / sides))
    return {
      type: 'polygon',
      center: { x: center.x, y: center.y },
      radius,
      sides,
      rotation: opts.rotation ?? -90
    }
  }
  throw new Error(`unknown geometry type: ${type}`)
}
