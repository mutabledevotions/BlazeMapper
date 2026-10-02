// Serializes a computed pixel list into the text pasted into the Pixelblaze Mapper tab,
// plus a per-channel summary for cross-checking Output Expander channel assignments.

function roundTo(n, decimals) {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

export function toMapJSON(pixels, opts = {}) {
  const round = opts.round ?? 2
  const forceZ = opts.forceZ ?? false
  const includeZ = forceZ || pixels.some((p) => (p.z || 0) !== 0)

  const rows = pixels.map((p) => {
    const x = roundTo(p.x, round)
    const y = roundTo(p.y, round)
    if (includeZ) {
      const z = roundTo(p.z || 0, round)
      return `[${x},${y},${z}]`
    }
    return `[${x},${y}]`
  })

  return `[${rows.join(',')}]`
}

// Pixels arrive pre-sorted by channel (see layout.js), so each channel forms one
// contiguous run -- walk it once rather than grouping into a map.
export function channelSummary(pixels) {
  const summary = []
  for (const p of pixels) {
    const last = summary[summary.length - 1]
    if (last && last.channel === p.channel) {
      last.count += 1
    } else {
      summary.push({ channel: p.channel, colorType: p.colorType, start: p.global, count: 1 })
    }
  }
  return summary
}
