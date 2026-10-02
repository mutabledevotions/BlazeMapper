// Geometry registry. Each geometry type (line, points, arc, bezier, circle, polygon, ...)
// implements the same functions. Canvas, layout, and export code only ever
// go through this registry, so adding a new shape (phase 5) means adding a file
// and one entry here -- no other code changes.

import * as line from './line.js'
import * as points from './points.js'

const REGISTRY = {
  line,
  points
}

function impl(geom) {
  const g = REGISTRY[geom.type]
  if (!g) throw new Error(`unknown geometry type: ${geom.type}`)
  return g
}

export function sample(geom, strip) {
  return impl(geom).sample(geom, strip)
}

export function handles(geom, strip) {
  return impl(geom).handles(geom, strip)
}

// Returns a strip patch { geom, ...fields } so a handle can also resize the strip.
export function moveHandle(geom, id, pt, opts, strip) {
  return impl(geom).moveHandle(geom, id, pt, opts || {}, strip)
}

export function scale(geom, k) {
  return impl(geom).scale(geom, k)
}

export function translate(geom, dx, dy) {
  return impl(geom).translate(geom, dx, dy)
}

export function bbox(geom, strip) {
  return impl(geom).bbox(geom, strip)
}

// Rotates the geometry's control points about `center` (world units), in degrees.
export function rotate(geom, deg, center) {
  return impl(geom).rotate(geom, deg, center)
}

// Mirrors the geometry about `center`. axis: 'h' (flip x) or 'v' (flip y).
export function mirror(geom, axis, center) {
  return impl(geom).mirror(geom, axis, center)
}

// Full geometric scale anchored at `center` -- the unlocked group-resize mode.
// Locked-pitch resize is handled in the store (it only moves each strip's
// origin and leaves pitch/ledCount/angle alone), so it doesn't go through here.
export function scaleAbout(geom, k, center) {
  return impl(geom).scaleAbout(geom, k, center)
}

export function registerGeometry(type, implementation) {
  REGISTRY[type] = implementation
}
