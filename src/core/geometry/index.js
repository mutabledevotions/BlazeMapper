// Geometry registry. Each geometry type (line, points, arc, bezier, circle, polygon, ...)
// implements the same four functions. Canvas, layout, and export code only ever
// go through this registry, so adding a new shape (phase 5) means adding a file
// and one entry here -- no other code changes.

import * as line from './line.js'

const REGISTRY = {
  line
}

function impl(geom) {
  const g = REGISTRY[geom.type]
  if (!g) throw new Error(`unknown geometry type: ${geom.type}`)
  return g
}

export function sample(geom, strip) {
  return impl(geom).sample(geom, strip)
}

export function handles(geom) {
  return impl(geom).handles(geom)
}

export function moveHandle(geom, id, pt, opts = {}) {
  return impl(geom).moveHandle(geom, id, pt, opts)
}

export function translate(geom, dx, dy) {
  return impl(geom).translate(geom, dx, dy)
}

export function bbox(geom, strip) {
  return impl(geom).bbox(geom, strip)
}

export function registerGeometry(type, implementation) {
  REGISTRY[type] = implementation
}
