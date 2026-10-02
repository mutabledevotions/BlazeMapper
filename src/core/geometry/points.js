// Points geometry: a freeform list of individual pixels (the "Add pixels" tool,
// and the eventual home for imported Pixelblaze maps). geom = { type: 'points', pts: [{x,y}, ...] }.
// Each point is its own handle, id `pt:<index>`, draggable independently.
// Signatures match every other geometry module even where a parameter (strip, opts) is unused,
// since the registry in index.js calls all geometries the same way.

export function sample(geom) {
  return geom.pts.map((p) => ({ x: p.x, y: p.y }))
}

export function handles(geom) {
  return geom.pts.map((p, i) => ({ id: `pt:${i}`, x: p.x, y: p.y }))
}

// Returns a strip patch ({ geom }) like every other geometry's moveHandle.
export function moveHandle(geom, id, pt) {
  const i = Number(id.slice(3))
  if (!Number.isInteger(i) || i < 0 || i >= geom.pts.length) return { geom }
  const pts = geom.pts.slice()
  pts[i] = { x: pt.x, y: pt.y }
  return { geom: { ...geom, pts } }
}

export function translate(geom, dx, dy) {
  return { ...geom, pts: geom.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
}

export function scale(geom, k) {
  return { ...geom, pts: geom.pts.map((p) => ({ x: p.x * k, y: p.y * k })) }
}

// Rotates every point about `center`, in degrees.
export function rotate(geom, deg, center) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    ...geom,
    pts: geom.pts.map((p) => {
      const dx = p.x - center.x
      const dy = p.y - center.y
      return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
    })
  }
}

export function bbox(geom) {
  if (geom.pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of geom.pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
