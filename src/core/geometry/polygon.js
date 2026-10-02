// Regular polygon geometry (phase 5): a closed loop along N straight edges
// (not the circumscribed circle's arc) -- LEDs are spaced along the perimeter,
// so e.g. a square's LEDs sit evenly along its four sides, not on an arc
// through its corners. geom = { type: 'polygon', center, radius (circumradius,
// center-to-vertex distance), sides (>=3, default 3 = triangle), rotation
// (degrees, where vertex 0 sits) }. Implements the same registry interface as
// every other geometry -- sample/handles/moveHandle/translate/scale/bbox/
// rotate/mirror/scaleAbout/curveLength -- so canvas, layout, and export never
// special-case this shape. A polygon is a closed path, so its LED placement
// reuses the closed-curve helpers in arclength.js.

import { sampleByFitClosed, sampleByPitchClosed } from './arclength.js'
import { quantizeAngle } from './line.js'

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function toDeg(rad) {
  return (rad * 180) / Math.PI
}

function vertex(geom, i) {
  const angle = geom.rotation + (360 * i) / geom.sides
  const rad = toRad(angle)
  return { x: geom.center.x + geom.radius * Math.cos(rad), y: geom.center.y + geom.radius * Math.sin(rad) }
}

function vertices(geom) {
  const vs = []
  for (let i = 0; i < geom.sides; i++) vs.push(vertex(geom, i))
  return vs
}

// t in [0, 1) walks the perimeter once, edge by edge in vertex order.
function curveFn(geom) {
  const vs = vertices(geom)
  const n = vs.length
  return (t) => {
    const tt = ((t % 1) + 1) % 1
    const f = tt * n
    const i = Math.min(n - 1, Math.floor(f))
    const local = f - i
    const a = vs[i]
    const b = vs[(i + 1) % n]
    return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local }
  }
}

// Exact perimeter: sides * side length, side length = 2*radius*sin(pi/sides).
// The "Curve length" readout in StripProps.
export function curveLength(geom) {
  return geom.sides * 2 * geom.radius * Math.sin(Math.PI / geom.sides)
}

// Pitch mode: LEDs at i*pitch along the perimeter, wrapping modulo it once
// that's exceeded (a closed loop has no "past the end", unlike an open path --
// StripProps separately warns when ledCount*pitch exceeds the perimeter). Fit
// mode: ledCount LEDs evenly spread along the whole perimeter without
// duplicating the start point.
export function sample(geom, strip) {
  const n = Math.max(0, strip.ledCount | 0)
  const f = curveFn(geom)
  if (strip.spacing === 'fit') return sampleByFitClosed(f, n).points
  return sampleByPitchClosed(f, strip.pitch, n).points
}

export function handles(geom) {
  const v0 = vertex(geom, 0)
  return [
    { id: 'center', x: geom.center.x, y: geom.center.y },
    { id: 'vertex0', x: v0.x, y: v0.y }
  ]
}

// Returns a strip patch ({ geom }), like every other geometry's moveHandle.
// 'center' moves the whole polygon. 'vertex0' changes the circumradius and
// rotation (where vertex 0, and so every vertex, sits) -- Shift snaps the
// angle to 15 degree steps.
export function moveHandle(geom, id, pt, opts = {}) {
  if (id === 'center') {
    return { geom: { ...geom, center: { x: pt.x, y: pt.y } } }
  }
  if (id === 'vertex0') {
    const dx = pt.x - geom.center.x
    const dy = pt.y - geom.center.y
    const radius = Math.max(1e-6, Math.hypot(dx, dy))
    let rotation = toDeg(Math.atan2(dy, dx))
    rotation = opts.shiftSnap ? Math.round(rotation / 15) * 15 : quantizeAngle(rotation)
    rotation = ((rotation % 360) + 360) % 360
    return { geom: { ...geom, radius, rotation } }
  }
  return { geom }
}

export function translate(geom, dx, dy) {
  return { ...geom, center: { x: geom.center.x + dx, y: geom.center.y + dy } }
}

// Uniform scale about the origin; used when the project's units change.
export function scale(geom, k) {
  return { ...geom, center: { x: geom.center.x * k, y: geom.center.y * k }, radius: geom.radius * k }
}

function rotatePoint(p, deg, center) {
  const rad = toRad(deg)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

export function rotate(geom, deg, center) {
  return { ...geom, center: rotatePoint(geom.center, deg, center), rotation: quantizeAngle(geom.rotation + deg) }
}

// Mirrors the polygon about `center`. axis 'h' flips x, 'v' flips y.
export function mirror(geom, axis, center) {
  const flip =
    axis === 'h'
      ? { x: center.x * 2 - geom.center.x, y: geom.center.y }
      : { x: geom.center.x, y: center.y * 2 - geom.center.y }
  const rotation = quantizeAngle(axis === 'h' ? 180 - geom.rotation : -geom.rotation)
  return { ...geom, center: flip, rotation }
}

// Full geometric scale anchored at `center` (unlocked group-resize mode).
export function scaleAbout(geom, k, center) {
  return {
    ...geom,
    center: { x: center.x + (geom.center.x - center.x) * k, y: center.y + (geom.center.y - center.y) * k },
    radius: geom.radius * k
  }
}

// Bbox of the polygon's vertices (exact -- the perimeter never bulges past
// them) plus the sampled LEDs, defensively, in case of future non-convex use.
export function bbox(geom, strip) {
  const pts = vertices(geom).concat(sample(geom, strip))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
