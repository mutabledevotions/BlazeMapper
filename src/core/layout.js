// Computes the flat, globally-ordered pixel list the export and canvas both read from.
// Order: channel ascending, then LED address ascending within a channel, then LED
// order along the strip (reversed if the strip says so). Hidden strips are skipped
// entirely -- as before, not even as a gap.
//
// Addresses (phase 3b): each item claims [start, start + ledCount - 1] within its
// channel. An address with no item is a real LED on the wire (a cut-off or
// deliberately hidden spot in the run), so Pixelblaze's dense, index-is-address map
// still needs an entry for it -- a placeholder pixel with `gap: true`. Its
// coordinate is either the previous real LED's (default; the first real LED's, if
// the channel starts with a gap) or the world origin, per
// `project.export.gapPlaceholder` ('previous' | 'origin').

import { sample, bbox } from './geometry/index.js'
import { ensureAddresses } from './address.js'

export function computePixels(project) {
  const addressed = ensureAddresses(project.strips)
  const visible = addressed.filter((s) => !s.hidden)
  const gapMode = (project.export && project.export.gapPlaceholder) || 'previous'
  const origin = { x: project.world ? project.world.x : 0, y: project.world ? project.world.y : 0 }

  const byChannel = new Map()
  for (const strip of visible) {
    if (!byChannel.has(strip.channel)) byChannel.set(strip.channel, [])
    byChannel.get(strip.channel).push(strip)
  }
  const channels = [...byChannel.keys()].sort((a, b) => a - b)

  const pixels = []
  let global = 0

  for (const channel of channels) {
    const items = byChannel
      .get(channel)
      .slice()
      .sort((a, b) => (a.start || 0) - (b.start || 0))

    // slots[address] = { x, y, z, stripId, local, colorType } for a real LED,
    // sparse (undefined) for an address nothing claims -- a gap.
    const slots = new Map()
    let maxEnd = 0
    for (const strip of items) {
      let pts = sample(strip.geom, strip)
      if (strip.reversed) pts = pts.slice().reverse()
      const start = strip.start || 1
      pts.forEach((p, local) => {
        slots.set(start + local, {
          x: p.x,
          y: p.y,
          z: strip.z || 0,
          stripId: strip.id,
          local,
          colorType: strip.colorType
        })
      })
      const end = start + pts.length - 1
      if (end > maxEnd) maxEnd = end
    }

    // Look ahead to the first real LED, for a gap-mode 'previous' channel that
    // starts with a gap (no earlier LED to repeat).
    let firstReal = null
    for (let a = 1; a <= maxEnd; a++) {
      if (slots.has(a)) {
        firstReal = slots.get(a)
        break
      }
    }

    let lastReal = null
    for (let addr = 1; addr <= maxEnd; addr++) {
      const real = slots.get(addr)
      if (real) {
        lastReal = real
        pixels.push({
          x: real.x,
          y: real.y,
          z: real.z,
          stripId: real.stripId,
          local: real.local,
          global,
          channel,
          colorType: real.colorType,
          gap: false
        })
      } else {
        const coord =
          gapMode === 'origin' ? { x: origin.x, y: origin.y, z: 0 } : lastReal || firstReal || { x: origin.x, y: origin.y, z: 0 }
        pixels.push({
          x: coord.x,
          y: coord.y,
          z: coord.z || 0,
          stripId: null,
          local: null,
          global,
          channel,
          colorType: (lastReal || firstReal || {}).colorType,
          gap: true
        })
      }
      global += 1
    }
  }

  return pixels
}

// Bounding box of a list of strips' geometry. Returns null for an empty list.
// Shared by projectBbox (every strip, for view framing) and the canvas's
// selection bbox (just the selected strips, for the group-rotate handle).
export function stripsBbox(strips) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const strip of strips) {
    const b = bbox(strip.geom, strip)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

// Bounding box of every strip's geometry (hidden strips included -- this is used
// for view framing, not export). Returns null for an empty project.
export function projectBbox(project) {
  return stripsBbox(project.strips)
}
