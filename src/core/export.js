// Serializes a computed pixel list into the text pasted into the Pixelblaze Mapper tab,
// plus a per-channel summary for cross-checking Output Expander channel assignments.
//
// Pixelblaze normalizes whatever map it's given to 0..1 (Fill or Contain) before
// rendering, so the export normalizes up front instead: each coordinate becomes
// (p - world.origin) / world.size, which makes the exported numbers identical
// regardless of which project unit (mm/in/px) was used to draw.

function roundTo(n, decimals) {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

function normalize(p, world) {
  const size = world.size || 1
  return {
    x: (p.x - world.x) / size,
    y: (p.y - world.y) / size,
    z: (p.z || 0) / size
  }
}

export function toMapJSON(pixels, opts = {}) {
  const world = opts.world || { x: 0, y: 0, size: 1 }
  const decimals = opts.decimals ?? 4
  const forceZ = opts.forceZ ?? false
  const anchors = opts.anchors ?? false
  const includeZ = forceZ || pixels.some((p) => (p.z || 0) !== 0)

  function rowStr(n) {
    const x = roundTo(n.x, decimals)
    const y = roundTo(n.y, decimals)
    if (includeZ) {
      const z = roundTo(n.z, decimals)
      return `[${x},${y},${z}]`
    }
    return `[${x},${y}]`
  }

  const rows = pixels.map((p) => rowStr(normalize(p, world)))

  // Anchors pin the normalized 0,0 and 1,1 world corners into the map so Pixelblaze's
  // own Fill/Contain normalization can't shrink or shift the layout relative to the
  // world box -- experimental, so they're appended as raw rows, never counted as
  // pixels (not part of `pixels`, so the total and channel summary never see them).
  if (anchors) {
    rows.push(rowStr({ x: 0, y: 0, z: 0 }))
    rows.push(rowStr({ x: 1, y: 1, z: 0 }))
  }

  return `[${rows.join(',')}]`
}

// Pixels arrive pre-sorted by channel (see layout.js), so each channel forms one
// contiguous run -- walk it once rather than grouping into a map. `count` is the
// total addresses in the channel including gap placeholders (what the 240/180
// Output Expander limit is actually checked against -- gap LEDs are real LEDs on
// the wire); `used` is just the real (non-gap) LEDs, `gaps` the rest.
export function channelSummary(pixels) {
  const summary = []
  for (const p of pixels) {
    const last = summary[summary.length - 1]
    if (last && last.channel === p.channel) {
      last.count += 1
      if (p.gap) last.gaps += 1
    } else {
      summary.push({ channel: p.channel, colorType: p.colorType, start: p.global, count: 1, gaps: p.gap ? 1 : 0 })
    }
  }
  for (const row of summary) row.used = row.count - row.gaps
  return summary
}
