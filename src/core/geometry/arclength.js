// Arc-length helpers shared by every curved geometry (bezier now; arc/circle/
// polygon later -- phase 5 continues to add shapes). Pure math, no DOM/Svelte.
//
// A curve is any function f(t) -> {x, y} for t in [0, 1]. Since most curves
// have no closed-form arc length, this builds a piecewise-linear lookup table
// by sampling f at even t steps, then answers "where is arc length s along
// the curve" by walking that table and linearly interpolating within the
// bracketing segment -- the standard fixed-table arc-length parameterization
// used by vector drawing/animation tools.

// Samples f at `samples` even steps (default 256) and returns the lookup
// table: pts[i] = f(i / (samples - 1)), lens[i] = cumulative straight-line
// length from pts[0] to pts[i], and total = lens[last] (the curve's full
// length as approximated by this polyline).
export function buildArcLengthTable(f, samples = 256) {
  const n = Math.max(2, samples | 0)
  const pts = new Array(n)
  const lens = new Array(n)
  pts[0] = f(0)
  lens[0] = 0
  let prev = pts[0]
  for (let i = 1; i < n; i++) {
    const t = i / (n - 1)
    const p = f(t)
    lens[i] = lens[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y)
    pts[i] = p
    prev = p
  }
  return { pts, lens, total: lens[n - 1] }
}

// Convenience: just the total length, for callers that don't need to walk it
// point-by-point (e.g. a "curve length" readout).
export function curveLength(f, samples = 256) {
  return buildArcLengthTable(f, samples).total
}

// Point at arc length `s` along the table, clamped to [0, total] -- callers
// that need to continue past the curve's end (e.g. a pitch-mode strip longer
// than the curve) handle that extrapolation themselves using the curve's own
// end tangent, since this table has no opinion past t=1.
export function pointAtLength(table, s) {
  const { pts, lens, total } = table
  if (total <= 0 || s <= 0) return { x: pts[0].x, y: pts[0].y }
  if (s >= total) return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
  // Binary search for the first index whose cumulative length is >= s.
  let lo = 0
  let hi = lens.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (lens[mid] < s) lo = mid + 1
    else hi = mid
  }
  const i = Math.max(1, lo)
  const segLen = lens[i] - lens[i - 1]
  const frac = segLen > 1e-9 ? (s - lens[i - 1]) / segLen : 0
  const a = pts[i - 1]
  const b = pts[i]
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac }
}

// Pitch mode: LED i at arc length i * pitch from the start, stopping once
// that length exceeds the curve's own length (does not extrapolate past the
// end -- a shape whose LED count should instead keep going past the curve,
// like bezier.js's strip-fixed-ledCount mode, builds its own loop around
// pointAtLength + an end-tangent extrapolation instead of calling this).
export function sampleByPitch(f, pitch, opts = {}) {
  const table = buildArcLengthTable(f, opts.samples)
  const points = []
  const step = pitch > 0 ? pitch : 1e-6
  for (let s = 0; s <= table.total; s += step) {
    points.push(pointAtLength(table, s))
  }
  return { points, length: table.total, table }
}

// Fit mode: `count` points evenly spread from one end of the curve to the
// other (first point at t=0, last at t=1 by arc length, not parameter t).
export function sampleByFit(f, count, opts = {}) {
  const table = buildArcLengthTable(f, opts.samples)
  const n = Math.max(0, count | 0)
  const points = []
  for (let i = 0; i < n; i++) {
    const s = n > 1 ? (table.total * i) / (n - 1) : 0
    points.push(pointAtLength(table, s))
  }
  return { points, length: table.total, table }
}
