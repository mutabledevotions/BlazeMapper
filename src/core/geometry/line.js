// Line geometry: pitch mode places LEDs at fixed real-world spacing along an angle.
// Fit mode (p0..p1, N LEDs spread between them) is phase 2; sample() supports it
// here so layout/export never need to change when it lands.

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

// Where the far-end handle sits: the last LED (fit mode: p1).
function endPoint(geom, strip) {
  if (strip.spacing === 'fit' && geom.p1) return { ...geom.p1 }
  const v = angleVector(geom.angle)
  const len = Math.max(1, (strip.ledCount | 0) - 1) * strip.pitch
  return { x: geom.p0.x + v.x * len, y: geom.p0.y + v.y * len }
}

export function handles(geom, strip) {
  const end = endPoint(geom, strip)
  return [
    { id: 'p0', x: geom.p0.x, y: geom.p0.y },
    { id: 'end', x: end.x, y: end.y }
  ]
}

// Returns a strip patch ({ geom, ...other strip fields }), not just a geom,
// because the end handle also resizes the strip (ledCount in pitch mode).
export function moveHandle(geom, id, pt, opts = {}, strip) {
  if (id === 'p0') {
    return { geom: { ...geom, p0: { x: pt.x, y: pt.y } } }
  }
  if (id === 'end') {
    if (strip.spacing === 'fit') {
      return { geom: { ...geom, p1: { x: pt.x, y: pt.y } } }
    }
    const dx = pt.x - geom.p0.x
    const dy = pt.y - geom.p0.y
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI
    if (opts.shiftSnap) angle = Math.round(angle / 15) * 15
    // Default: rotate only, length (ledCount) fixed. opts.resize (Ctrl/Cmd held)
    // also sets ledCount from the drag distance, the old always-resize behaviour.
    if (!opts.resize) {
      return { geom: { ...geom, angle } }
    }
    const ledCount = Math.max(1, Math.round(Math.hypot(dx, dy) / strip.pitch) + 1)
    return { geom: { ...geom, angle }, ledCount }
  }
  return { geom }
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

// Uniform scale about the origin; used when the project's units change.
export function scale(geom, k) {
  const next = { ...geom, p0: { x: geom.p0.x * k, y: geom.p0.y * k } }
  if (geom.p1) next.p1 = { x: geom.p1.x * k, y: geom.p1.y * k }
  return next
}
