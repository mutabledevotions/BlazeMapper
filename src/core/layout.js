// Computes the flat, globally-ordered pixel list the export and canvas both read from.
// Order: channel ascending, then strip list order within a channel, then LED order
// (reversed if the strip says so). Hidden strips are skipped entirely.

import { sample } from './geometry/index.js'

export function computePixels(project) {
  const visible = project.strips.filter((s) => !s.hidden)

  // Stable sort by channel, keeping original list order as the tiebreak.
  const ordered = visible
    .map((strip, idx) => ({ strip, idx }))
    .sort((a, b) => a.strip.channel - b.strip.channel || a.idx - b.idx)
    .map((e) => e.strip)

  const pixels = []
  let global = 0

  for (const strip of ordered) {
    let pts = sample(strip.geom, strip)
    if (strip.reversed) pts = pts.slice().reverse()

    pts.forEach((p, local) => {
      pixels.push({
        x: p.x,
        y: p.y,
        z: strip.z || 0,
        stripId: strip.id,
        local,
        global,
        channel: strip.channel,
        colorType: strip.colorType
      })
      global += 1
    })
  }

  return pixels
}
