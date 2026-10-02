// Data model factories. Pure functions, plain objects only (structuredClone-friendly).

let idCounter = 0

// Unique-enough id for a session; not persisted-stable across machines, fine for local use.
function nextId(prefix) {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

export function newProject() {
  return {
    version: 1,
    units: 'mm',
    grid: { size: 10, snap: true, show: true },
    canvas: { w: 2000, h: 2000 },
    strips: [],
    export: { round: 2, forceZ: false }
  }
}

const STRIP_COLORS = ['#4fc3f7', '#ff8a65', '#aed581', '#ba68c8', '#ffd54f', '#4db6ac', '#f06292', '#90a4ae']

export function newStrip(geomType = 'line', opts = {}) {
  const id = nextId('strip')
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
    geom: null
  }
  base.geom = newGeom(geomType, opts.geom)
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
  throw new Error(`unknown geometry type: ${type}`)
}
