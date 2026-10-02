// Pure validation: scans the project and returns a flat warnings list the
// export drawer renders. Never throws, never mutates.
// warning shape: { level: 'warning' | 'error', message, stripId?, channel? }

import { sample } from './geometry/index.js'

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

  for (const [channel, strips] of byChannel) {
    let count = 0
    const colorTypes = new Set()
    for (const strip of strips) {
      count += sample(strip.geom, strip).length
      colorTypes.add(strip.colorType)
    }
    // The channel's strictest type governs its limit: any RGBW strip caps the
    // whole channel at 180, even if the rest are RGB.
    const strictest = colorTypes.has('RGBW') ? 'RGBW' : 'RGB'
    const limit = CHANNEL_LIMITS[strictest]
    if (count > limit) {
      warnings.push({
        level: 'error',
        message: `Channel ${channel}: ${count} pixels exceeds the ${limit}-pixel ${strictest} limit per Output Expander channel`,
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
