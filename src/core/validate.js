// Pure validation: scans the project and returns a flat warnings list the
// export drawer renders. Never throws, never mutates.
// warning shape: { level: 'warning' | 'error', message, stripId?, channel? }

import { sample } from './geometry/index.js'
import { ensureAddresses, lastAddress } from './address.js'

const CHANNEL_LIMITS = { RGB: 240, RGBW: 180 }

export function validateProject(project) {
  const warnings = []
  const visible = project.strips.filter((s) => !s.hidden)

  for (const strip of project.strips) {
    if (sample(strip.geom, strip).length === 0) {
      warnings.push({ level: 'warning', message: `"${strip.name}" is empty (no pixels)`, stripId: strip.id })
    }
  }

  const byChannel = new Map()
  for (const strip of visible) {
    if (!byChannel.has(strip.channel)) byChannel.set(strip.channel, [])
    byChannel.get(strip.channel).push(strip)
  }

  // Addressed copies, just for the last-address-incl-gaps limit check below --
  // the channel's byte budget is really spent by the last claimed address, not
  // the sum of each strip's own LED count (an unaddressed gap is still a real
  // LED on the wire and still costs a map entry).
  const addressedByChannel = new Map()
  for (const strip of ensureAddresses(project.strips).filter((s) => !s.hidden)) {
    if (!addressedByChannel.has(strip.channel)) addressedByChannel.set(strip.channel, [])
    addressedByChannel.get(strip.channel).push(strip)
  }

  for (const [channel, strips] of byChannel) {
    const colorTypes = new Set(strips.map((s) => s.colorType))
    // The channel's strictest type governs its limit: any RGBW strip caps the
    // whole channel at 180, even if the rest are RGB.
    const strictest = colorTypes.has('RGBW') ? 'RGBW' : 'RGB'
    const limit = CHANNEL_LIMITS[strictest]
    const count = lastAddress(addressedByChannel.get(channel) || [])
    if (count > limit) {
      warnings.push({
        level: 'error',
        message: `Channel ${channel}: last address ${count} (incl. gaps) exceeds the ${limit}-pixel ${strictest} limit per Output Expander channel`,
        channel
      })
    }
    if (colorTypes.size > 1) {
      warnings.push({
        level: 'warning',
        message: `Channel ${channel} mixes color types (${[...colorTypes].sort().join(', ')})`,
        channel
      })
    }
  }

  // Normalized-export sanity check: a pixel outside the world box lands outside
  // 0..1 once exported. Pixelblaze still rescales (Fill/Contain), so this is a
  // warning, not an error -- one per offending strip is plenty, not one per pixel.
  const world = project.world
  if (world && world.size) {
    for (const strip of visible) {
      const pts = sample(strip.geom, strip)
      const outside = pts.some((p) => {
        const nx = (p.x - world.x) / world.size
        const ny = (p.y - world.y) / world.size
        return nx < 0 || nx > 1 || ny < 0 || ny > 1
      })
      if (outside) {
        warnings.push({
          level: 'warning',
          message: `"${strip.name}" has a pixel outside the world box (falls outside 0..1 once exported)`,
          stripId: strip.id
        })
      }
    }
  }

  const seen = new Map()
  for (const strip of visible) {
    const pts = sample(strip.geom, strip)
    for (const p of pts) {
      const key = `${p.x},${p.y},${strip.z || 0}`
      const prior = seen.get(key)
      if (prior) {
        warnings.push({
          level: 'warning',
          message: `Duplicate pixel at (${p.x}, ${p.y}): "${prior}" and "${strip.name}"`,
          stripId: strip.id
        })
      } else {
        seen.set(key, strip.name)
      }
    }
  }

  return warnings
}
