// Line geometry: pitch mode places LEDs at fixed real-world spacing along an angle.
// Fit mode (p0..p1, N LEDs spread between them) is phase 2; sample() supports it
// here so layout/export never need to change when it lands.

const HANDLE_LEN = 60 // visual length (world units) of the angle handle, independent of strip length

function angleVector(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad), y: Math.sin(rad) }
}

export function sample(geom, strip) {
  const n = Math.max(0, strip.ledCount | 0)
  const pts = []

  if (strip.spacing === 'fit' && geom.p1) {
    if (n === 1) {
      pts.push({ x: geom.p0.x, y: geom.p0.y })
    } else {
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        pts.push({
          x: geom.p0.x + (geom.p1.x - geom.p0.x) * t,
          y: geom.p0.y + (geom.p1.y - geom.p0.y) * t
        })
      }
    }
    return pts
  }

  const v = angleVector(geom.angle)
  for (let i = 0; i < n; i++) {
    pts.push({
      x: geom.p0.x + v.x * strip.pitch * i,
      y: geom.p0.y + v.y * strip.pitch * i
    })
  }
  return pts
}

export function handles(geom) {
  const v = angleVector(geom.angle)
  return [
    { id: 'p0', x: geom.p0.x, y: geom.p0.y },
    { id: 'end', x: geom.p0.x + v.x * HANDLE_LEN, y: geom.p0.y + v.y * HANDLE_LEN }
  ]
}

export function moveHandle(geom, id, pt, opts = {}) {
  const next = { ...geom, p0: { ...geom.p0 } }
  if (id === 'p0') {
    next.p0 = { x: pt.x, y: pt.y }
    return next
  }
  if (id === 'end') {
    let angle = (Math.atan2(pt.y - geom.p0.y, pt.x - geom.p0.x) * 180) / Math.PI
    if (opts.shiftSnap) {
      angle = Math.round(angle / 15) * 15
    }
    next.angle = angle
    return next
  }
  return geom
}

export function translate(geom, dx, dy) {
  const next = { ...geom, p0: { x: geom.p0.x + dx, y: geom.p0.y + dy } }
  if (geom.p1) {
    next.p1 = { x: geom.p1.x + dx, y: geom.p1.y + dy }
  }
  return next
}

export function bbox(geom, strip) {
  const pts = sample(geom, strip)
  if (pts.length === 0) {
    return { minX: geom.p0.x, minY: geom.p0.y, maxX: geom.p0.x, maxY: geom.p0.y }
  }
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
