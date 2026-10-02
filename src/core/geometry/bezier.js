// Cubic bezier geometry (phase 5). geom = { type: 'bezier', p0, c0, c1, p1 }:
// p0/p1 are the curve's anchor ends, c0/c1 their control points. Implements
// the same registry interface as line.js/points.js -- sample/handles/
// moveHandle/translate/scale/bbox/rotate/mirror/scaleAbout -- so canvas,
// layout, and export never special-case this shape.

import { buildArcLengthTable, pointAtLength, sampleByFit, curveLength as arcCurveLength } from './arclength.js'

function cubicAt(p0, c0, c1, p1, t) {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
    y: a * p0.y + b * c0.y + c * c1.y + d * p1.y
  }
}

function curveFn(geom) {
  return (t) => cubicAt(geom.p0, geom.c0, geom.c1, geom.p1, t)
}

function unit(v) {
  const len = Math.hypot(v.x, v.y)
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 1, y: 0 }
}

// Direction the curve is heading at its very end (t=1): 3*(p1-c1) for a cubic,
// which degenerates to p1-p0 if c1 sits exactly on p1 (a zero-length handle).
function endTangent(geom) {
  const d = { x: geom.p1.x - geom.c1.x, y: geom.p1.y - geom.c1.y }
  if (Math.hypot(d.x, d.y) > 1e-9) return unit(d)
  return unit({ x: geom.p1.x - geom.p0.x, y: geom.p1.y - geom.p0.y })
}

// Total length of the curve (arc-length approximation, 256-sample table).
// Exported for StripProps' "Curve length" readout.
export function curveLength(geom) {
  return arcCurveLength(curveFn(geom))
}

// Fit mode: ledCount LEDs evenly spaced end to end (first at p0, last at p1).
// Pitch mode: ledCount is fixed (set by the LED count field, like every other
// strip) and LEDs sit at i*pitch along the curve's own arc length; once that
// exceeds the curve's length, remaining LEDs continue in a straight line along
// the end tangent at p1, so a strip longer than its curve still gets real,
// evenly spaced LEDs instead of bunching up at the last sampled point.
export function sample(geom, strip) {
  const n = Math.max(0, strip.ledCount | 0)
  const f = curveFn(geom)
  if (strip.spacing === 'fit') {
    return sampleByFit(f, n).points
  }
  const table = buildArcLengthTable(f)
  const tangent = endTangent(geom)
  const pts = []
  for (let i = 0; i < n; i++) {
    const s = i * strip.pitch
    if (s <= table.total) {
      pts.push(pointAtLength(table, s))
    } else {
      const extra = s - table.total
      pts.push({ x: geom.p1.x + tangent.x * extra, y: geom.p1.y + tangent.y * extra })
    }
  }
  return pts
}

// handles/moveHandle both take (geom, strip) like every other geometry, even
// though strip is unused here, to match the registry's call signature.
export function handles(geom) {
  return [
    { id: 'p0', x: geom.p0.x, y: geom.p0.y },
    { id: 'c0', x: geom.c0.x, y: geom.c0.y },
    { id: 'c1', x: geom.c1.x, y: geom.c1.y },
    { id: 'p1', x: geom.p1.x, y: geom.p1.y }
  ]
}

// Snaps a control handle's angle, measured from its own anchor (p0 for c0,
// p1 for c1), to 15 degree steps -- same idea as a line strip's Shift-snap,
// just measured from the anchor instead of from geom.p0 with a stored angle.
function snapToAnchor(anchor, pt) {
  const dx = pt.x - anchor.x
  const dy = pt.y - anchor.y
  const dist = Math.hypot(dx, dy)
  const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 15) * 15
  const rad = (angle * Math.PI) / 180
  return { x: anchor.x + Math.cos(rad) * dist, y: anchor.y + Math.sin(rad) * dist }
}

// Returns a strip patch ({ geom }), like every other geometry's moveHandle.
// p0 drags c0 along with it (same delta) and p1 drags c1 along with it, so
// the curve's shape relative to its own end doesn't jump when you move an
// anchor; c0/c1 move independently. Shift on a control handle (c0/c1) snaps
// its angle from its anchor (p0/p1) to 15 degree steps.
export function moveHandle(geom, id, pt, opts = {}) {
  if (id === 'p0') {
    const dx = pt.x - geom.p0.x
    const dy = pt.y - geom.p0.y
    return { geom: { ...geom, p0: { x: pt.x, y: pt.y }, c0: { x: geom.c0.x + dx, y: geom.c0.y + dy } } }
  }
  if (id === 'p1') {
    const dx = pt.x - geom.p1.x
    const dy = pt.y - geom.p1.y
    return { geom: { ...geom, p1: { x: pt.x, y: pt.y }, c1: { x: geom.c1.x + dx, y: geom.c1.y + dy } } }
  }
  if (id === 'c0' || id === 'c1') {
    const anchor = id === 'c0' ? geom.p0 : geom.p1
    const target = opts.shiftSnap ? snapToAnchor(anchor, pt) : pt
    return { geom: { ...geom, [id]: { x: target.x, y: target.y } } }
  }
  return { geom }
}

export function translate(geom, dx, dy) {
  const shift = (p) => ({ x: p.x + dx, y: p.y + dy })
  return { ...geom, p0: shift(geom.p0), c0: shift(geom.c0), c1: shift(geom.c1), p1: shift(geom.p1) }
}

// Uniform scale about the origin; used when the project's units change.
export function scale(geom, k) {
  const sc = (p) => ({ x: p.x * k, y: p.y * k })
  return { ...geom, p0: sc(geom.p0), c0: sc(geom.c0), c1: sc(geom.c1), p1: sc(geom.p1) }
}

function rotatePoint(p, deg, center) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

export function rotate(geom, deg, center) {
  return {
    ...geom,
    p0: rotatePoint(geom.p0, deg, center),
    c0: rotatePoint(geom.c0, deg, center),
    c1: rotatePoint(geom.c1, deg, center),
    p1: rotatePoint(geom.p1, deg, center)
  }
}

// Mirrors every control point about `center`. axis 'h' flips x, 'v' flips y.
export function mirror(geom, axis, center) {
  const flip =
    axis === 'h'
      ? (p) => ({ x: center.x * 2 - p.x, y: p.y })
      : (p) => ({ x: p.x, y: center.y * 2 - p.y })
  return { ...geom, p0: flip(geom.p0), c0: flip(geom.c0), c1: flip(geom.c1), p1: flip(geom.p1) }
}

// Full geometric scale anchored at `center` (unlocked group-resize mode).
export function scaleAbout(geom, k, center) {
  const sc = (p) => ({ x: center.x + (p.x - center.x) * k, y: center.y + (p.y - center.y) * k })
  return { ...geom, p0: sc(geom.p0), c0: sc(geom.c0), c1: sc(geom.c1), p1: sc(geom.p1) }
}

// Bbox of the sampled LEDs plus the four control points, so canvas pan/zoom
// bounds and the group-selection bbox have room for the drawn control handles
// too, not just the LED dots (a curve's control points can sit outside the
// sampled LED span).
export function bbox(geom, strip) {
  const pts = sample(geom, strip).concat([geom.p0, geom.c0, geom.c1, geom.p1])
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
