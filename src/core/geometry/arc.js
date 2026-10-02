// Circular arc geometry (phase 5). geom = { type: 'arc', center, radius, startAngle,
// sweep }: center/radius define the circle this arc is cut from, startAngle is
// where it begins (degrees, 0 = +x), and sweep is signed degrees traveled from
// there (positive = increasing angle, which traces clockwise in this app's
// y-down world -- same atan2/cos/sin convention as every other geometry here).
// Default sweep 90 is the toolbar's "90 degree curve" preset. Implements the
// same registry interface as every other geometry -- sample/handles/moveHandle/
// translate/scale/bbox/rotate/mirror/scaleAbout/curveLength -- so canvas,
// layout, and export never special-case this shape. An arc is an open path
// (it has a clear start and end), so its LED placement reuses the open-path
// helpers in arclength.js, same as bezier.js.

import { buildArcLengthTable, pointAtLength, sampleByFit } from './arclength.js'
import { quantizeAngle } from './line.js'

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function toDeg(rad) {
  return (rad * 180) / Math.PI
}

function pointAt(geom, deg) {
  const rad = toRad(deg)
  return { x: geom.center.x + geom.radius * Math.cos(rad), y: geom.center.y + geom.radius * Math.sin(rad) }
}

function curveFn(geom) {
  return (t) => pointAt(geom, geom.startAngle + t * geom.sweep)
}

// Exact arc length (radius * sweep in radians) -- the "Curve length" readout
// in StripProps, and more precise than the sampled table.
export function curveLength(geom) {
  return geom.radius * Math.abs(toRad(geom.sweep))
}

function unit(v) {
  const len = Math.hypot(v.x, v.y)
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 1, y: 0 }
}

// Direction the arc is heading at its very end (t=1): the circle's tangent at
// startAngle+sweep, signed by the sweep's own direction of travel -- same idea
// as bezier.js's endTangent.
function endTangent(geom) {
  const rad = toRad(geom.startAngle + geom.sweep)
  const sign = geom.sweep >= 0 ? 1 : -1
  return unit({ x: -Math.sin(rad) * sign, y: Math.cos(rad) * sign })
}

// Fit mode: ledCount LEDs evenly spaced end to end (first at the start point,
// last at the end point). Pitch mode: LEDs at i*pitch along the arc; once that
// exceeds the arc's own length, remaining LEDs continue in a straight line
// along the end tangent, same open-path extrapolation as bezier.js (an arc,
// unlike a full circle, has a real "past the end").
export function sample(geom, strip) {
  const n = Math.max(0, strip.ledCount | 0)
  const f = curveFn(geom)
  if (strip.spacing === 'fit') {
    return sampleByFit(f, n).points
  }
  const table = buildArcLengthTable(f)
  const tangent = endTangent(geom)
  const end = pointAt(geom, geom.startAngle + geom.sweep)
  const pts = []
  for (let i = 0; i < n; i++) {
    const s = i * strip.pitch
    if (s <= table.total) {
      pts.push(pointAtLength(table, s))
    } else {
      const extra = s - table.total
      pts.push({ x: end.x + tangent.x * extra, y: end.y + tangent.y * extra })
    }
  }
  return pts
}

export function handles(geom) {
  const start = pointAt(geom, geom.startAngle)
  const sweepEnd = pointAt(geom, geom.startAngle + geom.sweep)
  return [
    { id: 'center', x: geom.center.x, y: geom.center.y },
    { id: 'start', x: start.x, y: start.y },
    { id: 'sweep', x: sweepEnd.x, y: sweepEnd.y }
  ]
}

// Returns a strip patch ({ geom }), like every other geometry's moveHandle.
// 'center' moves the whole arc. 'start' changes radius and startAngle (the
// sweep stays the same signed value, so the arc's span is preserved).
// 'sweep' changes only the sweep, keeping the current radius/startAngle --
// Shift snaps it to 15 degree steps.
export function moveHandle(geom, id, pt, opts = {}) {
  if (id === 'center') {
    return { geom: { ...geom, center: { x: pt.x, y: pt.y } } }
  }
  if (id === 'start') {
    const dx = pt.x - geom.center.x
    const dy = pt.y - geom.center.y
    const radius = Math.max(1e-6, Math.hypot(dx, dy))
    let startAngle = toDeg(Math.atan2(dy, dx))
    startAngle = opts.shiftSnap ? Math.round(startAngle / 15) * 15 : quantizeAngle(startAngle)
    startAngle = ((startAngle % 360) + 360) % 360
    return { geom: { ...geom, radius, startAngle } }
  }
  if (id === 'sweep') {
    const dx = pt.x - geom.center.x
    const dy = pt.y - geom.center.y
    const angle = toDeg(Math.atan2(dy, dx))
    // Normalize to [0, 360) first, then pick the representation that keeps
    // the same sign as the current sweep -- so a drag near zero degrees
    // doesn't abruptly flip the arc from, say, +1 to -359.
    let sweep = ((angle - geom.startAngle) % 360 + 360) % 360
    if (geom.sweep < 0 && sweep > 0) sweep -= 360
    const step = opts.shiftSnap ? 15 : 0.5
    sweep = Math.round(sweep / step) * step
    return { geom: { ...geom, sweep } }
  }
  return { geom }
}

// Translating an arc only moves its circle's center -- radius/angles define
// the shape relative to it, so every sampled point moves by the same delta.
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
  return { ...geom, center: rotatePoint(geom.center, deg, center), startAngle: quantizeAngle(geom.startAngle + deg) }
}

// Mirrors the arc about `center`. axis 'h' flips x, 'v' flips y. Mirroring
// flips chirality, so the sweep's sign flips too -- otherwise the mirrored
// arc would bow the wrong way relative to its (now flipped) start/end points.
export function mirror(geom, axis, center) {
  const flip =
    axis === 'h'
      ? { x: center.x * 2 - geom.center.x, y: geom.center.y }
      : { x: geom.center.x, y: center.y * 2 - geom.center.y }
  const startAngle = quantizeAngle(axis === 'h' ? 180 - geom.startAngle : -geom.startAngle)
  return { ...geom, center: flip, startAngle, sweep: -geom.sweep }
}

// Full geometric scale anchored at `center` (unlocked group-resize mode).
export function scaleAbout(geom, k, center) {
  return {
    ...geom,
    center: { x: center.x + (geom.center.x - center.x) * k, y: center.y + (geom.center.y - center.y) * k },
    radius: geom.radius * k
  }
}

// Bbox of the sampled LEDs plus the handle points, so canvas pan/zoom bounds
// and the group-selection bbox have room for the drawn center/start/sweep
// handles too, not just the LED dots.
export function bbox(geom, strip) {
  const pts = sample(geom, strip).concat(handles(geom).map((h) => ({ x: h.x, y: h.y })))
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
