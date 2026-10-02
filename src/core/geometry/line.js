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

// Angles are stored in 0.5 deg steps (720 per turn); finer precision is noise.
export function quantizeAngle(deg) {
  const a = Math.round(deg * 2) / 2
  return ((a % 360) + 360) % 360
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
    angle = opts.shiftSnap ? Math.round(angle / 15) * 15 : quantizeAngle(angle)
    angle = ((angle % 360) + 360) % 360
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

function rotatePoint(p, deg, center) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

// Rotates p0 (and p1, in fit mode) about `center`; angle is quantized the same
// way a handle drag quantizes it, so group rotation and direct dragging agree.
export function rotate(geom, deg, center) {
  const next = { ...geom, p0: rotatePoint(geom.p0, deg, center), angle: quantizeAngle(geom.angle + deg) }
  if (geom.p1) next.p1 = rotatePoint(geom.p1, deg, center)
  return next
}

// Mirrors p0 (and p1, in fit mode) about `center`. axis 'h' flips x (left-right),
// 'v' flips y (up-down). Wire order along the strip is unchanged -- only the
// geometry moves -- so the direction vector flips too: a horizontal flip of
// (cos a, sin a) is (-cos a, sin a), i.e. angle 180-a; a vertical flip is
// (cos a, -sin a), i.e. angle -a. Both go through quantizeAngle for consistency
// with every other angle-producing transform.
export function mirror(geom, axis, center) {
  const flip =
    axis === 'h'
      ? (p) => ({ x: center.x * 2 - p.x, y: p.y })
      : (p) => ({ x: p.x, y: center.y * 2 - p.y })
  const next = { ...geom, p0: flip(geom.p0), angle: quantizeAngle(axis === 'h' ? 180 - geom.angle : -geom.angle) }
  if (geom.p1) next.p1 = flip(geom.p1)
  return next
}

// Full geometric scale anchored at `center` (unlocked group-resize mode): both
// p0 and p1 move. Pitch is scaled separately by the caller (store action),
// since this module has no opinion on the strip's other fields.
export function scaleAbout(geom, k, center) {
  const sc = (p) => ({ x: center.x + (p.x - center.x) * k, y: center.y + (p.y - center.y) * k })
  const next = { ...geom, p0: sc(geom.p0) }
  if (geom.p1) next.p1 = sc(geom.p1)
  return next
}
