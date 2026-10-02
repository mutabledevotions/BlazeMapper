// Circle geometry (phase 5): a full, closed loop. geom = { type: 'circle',
// center, radius, startAngle, direction }: direction 1 = LED order travels
// clockwise (increasing angle, in this app's y-down world), -1 = counter-
// clockwise. Implements the same registry interface as every other geometry --
// sample/handles/moveHandle/translate/scale/bbox/rotate/mirror/scaleAbout/
// curveLength -- so canvas, layout, and export never special-case this shape.
// A circle is a closed path, so its LED placement reuses the closed-curve
// helpers in arclength.js (wrap-around pitch mode, no-duplicate-start fit mode).

import { sampleByFitClosed, sampleByPitchClosed } from './arclength.js'
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

// t in [0, 1) walks the full circle once, starting at startAngle and going
// `direction`'s way around.
function curveFn(geom) {
  return (t) => pointAt(geom, geom.startAngle + geom.direction * t * 360)
}

// Exact circumference -- the "Curve length" readout in StripProps.
export function curveLength(geom) {
  return 2 * Math.PI * geom.radius
}

// Pitch mode: LEDs at i*pitch, wrapping modulo the circumference once that's
// exceeded -- a closed loop has no "past the end" to extrapolate past, unlike
// an open path (StripProps separately warns when ledCount*pitch exceeds the
// circumference). Fit mode: ledCount LEDs evenly spread around the whole
// circle without duplicating the start point.
export function sample(geom, strip) {
  const n = Math.max(0, strip.ledCount | 0)
  const f = curveFn(geom)
  if (strip.spacing === 'fit') return sampleByFitClosed(f, n).points
  return sampleByPitchClosed(f, strip.pitch, n).points
}

export function handles(geom) {
  const start = pointAt(geom, geom.startAngle)
  return [
    { id: 'center', x: geom.center.x, y: geom.center.y },
    { id: 'start', x: start.x, y: start.y }
  ]
}

// Returns a strip patch ({ geom }), like every other geometry's moveHandle.
// 'center' moves the whole circle. 'start' changes radius and startAngle
// (where LED 0 sits) -- Shift snaps the angle to 15 degree steps.
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
  return { ...geom, center: rotatePoint(geom.center, deg, center), startAngle: quantizeAngle(geom.startAngle + deg) }
}

// Mirrors the circle about `center`. axis 'h' flips x, 'v' flips y. Mirroring
// flips chirality, so the direction LED order travels around the loop flips
// too (direction *= -1), keeping the same physical rotational sense.
export function mirror(geom, axis, center) {
  const flip =
    axis === 'h'
      ? { x: center.x * 2 - geom.center.x, y: geom.center.y }
      : { x: geom.center.x, y: center.y * 2 - geom.center.y }
  const startAngle = quantizeAngle(axis === 'h' ? 180 - geom.startAngle : -geom.startAngle)
  return { ...geom, center: flip, startAngle, direction: -geom.direction }
}

// Full geometric scale anchored at `center` (unlocked group-resize mode).
export function scaleAbout(geom, k, center) {
  return {
    ...geom,
    center: { x: center.x + (geom.center.x - center.x) * k, y: center.y + (geom.center.y - center.y) * k },
    radius: geom.radius * k
  }
}

// Bbox is exact (center +/- radius) -- cheaper and tighter than sampling, and
// still has room for the center/start handles since both sit on or inside it.
export function bbox(geom) {
  return {
    minX: geom.center.x - geom.radius,
    minY: geom.center.y - geom.radius,
    maxX: geom.center.x + geom.radius,
    maxY: geom.center.y + geom.radius
  }
}
