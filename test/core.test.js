import { describe, it, expect } from 'vitest'
import { newProject, newStrip } from '../src/core/model.js'
import { sample, handles, moveHandle, translate, scale, bbox } from '../src/core/geometry/index.js'
import { computePixels, projectBbox } from '../src/core/layout.js'
import { toMapJSON, channelSummary } from '../src/core/export.js'
import { validateProject } from '../src/core/validate.js'

describe('geometry/line', () => {
  it('samples LEDs at pitch spacing along angle 0', () => {
    const strip = newStrip('line', { ledCount: 3, pitch: 10, geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    const pts = sample(strip.geom, strip)
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ])
  })

  it('moves p0 handle directly', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: null }
    const next = moveHandle(geom, 'p0', { x: 5, y: 7 }, {}, { ledCount: 3, pitch: 10 }).geom
    expect(next.p0).toEqual({ x: 5, y: 7 })
  })

  it('snaps angle to 15 degrees with shift', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: null }
    const next = moveHandle(geom, 'end', { x: 10, y: 6 }, { shiftSnap: true }, { ledCount: 3, pitch: 10 }).geom
    expect(next.angle % 15).toBe(0)
  })

  it('end handle sits at last LED', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: null }
    const strip = { ledCount: 5, pitch: 10, spacing: 'pitch' }
    expect(handles(geom, strip)[1]).toMatchObject({ x: 40, y: 0 })
  })

  it('end handle without opts.resize only rotates -- ledCount unchanged', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: null }
    const strip = { ledCount: 5, pitch: 10, spacing: 'pitch' }
    const patch = moveHandle(geom, 'end', { x: 0, y: 72 }, {}, strip)
    expect(patch.geom.angle).toBe(90)
    expect(patch.ledCount).toBeUndefined()
  })

  it('end handle with opts.resize also sets ledCount from drag distance', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: null }
    const strip = { ledCount: 5, pitch: 10, spacing: 'pitch' }
    const patch = moveHandle(geom, 'end', { x: 0, y: 72 }, { resize: true }, strip)
    expect(patch).toMatchObject({ ledCount: 8, geom: { angle: 90 } })
  })

  it('fit mode end handle moves p1 regardless of resize', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: { x: 40, y: 0 } }
    const strip = { ledCount: 5, pitch: 10, spacing: 'fit' }
    const patch = moveHandle(geom, 'end', { x: 10, y: 20 }, {}, strip)
    expect(patch.geom.p1).toEqual({ x: 10, y: 20 })
    expect(patch.ledCount).toBeUndefined()
  })

  it('exposes p0 and end handles', () => {
    const geom = { type: 'line', p0: { x: 1, y: 2 }, angle: 0, p1: null }
    const hs = handles(geom, { ledCount: 3, pitch: 10 })
    expect(hs.map((h) => h.id)).toEqual(['p0', 'end'])
  })
})

describe('layout computePixels', () => {
  it('orders by channel then list order, skips hidden strips', () => {
    const project = newProject()
    const a = newStrip('line', { ledCount: 2, pitch: 10, channel: 1, geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    const b = newStrip('line', { ledCount: 2, pitch: 10, channel: 0, geom: { p0: { x: 0, y: 100 }, angle: 0 } })
    const c = newStrip('line', { ledCount: 2, pitch: 10, channel: 1, hidden: true, geom: { p0: { x: 0, y: 200 }, angle: 0 } })
    project.strips.push(a, b, c)

    const pixels = computePixels(project)
    expect(pixels.map((p) => p.stripId)).toEqual([b.id, b.id, a.id, a.id])
    expect(pixels.map((p) => p.global)).toEqual([0, 1, 2, 3])
  })

  it('respects reversed order within a strip', () => {
    const project = newProject()
    const a = newStrip('line', { ledCount: 3, pitch: 10, reversed: true, geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    project.strips.push(a)
    const pixels = computePixels(project)
    expect(pixels.map((p) => p.x)).toEqual([20, 10, 0])
  })
})

describe('export', () => {
  it('formats map JSON without z when all z are zero', () => {
    const pixels = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 5, z: 0 }
    ]
    expect(toMapJSON(pixels, { round: 2 })).toBe('[[0,0],[10,5]]')
  })

  it('includes z when any pixel has non-zero z', () => {
    const pixels = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 5, z: 3 }
    ]
    expect(toMapJSON(pixels, { round: 2 })).toBe('[[0,0,0],[10,5,3]]')
  })

  it('forces z when forceZ is set', () => {
    const pixels = [{ x: 1, y: 2, z: 0 }]
    expect(toMapJSON(pixels, { round: 2, forceZ: true })).toBe('[[1,2,0]]')
  })

  it('summarizes contiguous channel runs', () => {
    const pixels = [
      { channel: 0, colorType: 'RGB', global: 0 },
      { channel: 0, colorType: 'RGB', global: 1 },
      { channel: 1, colorType: 'RGBW', global: 2 }
    ]
    expect(channelSummary(pixels)).toEqual([
      { channel: 0, colorType: 'RGB', start: 0, count: 2 },
      { channel: 1, colorType: 'RGBW', start: 2, count: 1 }
    ])
  })
})

describe('geometry/points', () => {
  it('samples the raw point list', () => {
    const strip = newStrip('points', { geom: { pts: [{ x: 0, y: 0 }, { x: 5, y: 10 }] } })
    expect(sample(strip.geom, strip)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 10 }
    ])
  })

  it('exposes one handle per point and moves it independently', () => {
    const strip = newStrip('points', { geom: { pts: [{ x: 0, y: 0 }, { x: 5, y: 10 }] } })
    const hs = handles(strip.geom, strip)
    expect(hs).toEqual([
      { id: 'pt:0', x: 0, y: 0 },
      { id: 'pt:1', x: 5, y: 10 }
    ])
    const patch = moveHandle(strip.geom, 'pt:1', { x: 99, y: 99 }, {}, strip)
    expect(patch.geom.pts).toEqual([{ x: 0, y: 0 }, { x: 99, y: 99 }])
  })

  it('translates and scales every point', () => {
    const geom = { type: 'points', pts: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    expect(translate(geom, 10, -1).pts).toEqual([{ x: 11, y: 1 }, { x: 13, y: 3 }])
    expect(scale(geom, 2).pts).toEqual([{ x: 2, y: 4 }, { x: 6, y: 8 }])
  })

  it('bbox covers all points, and layout/export need no special-casing', () => {
    const geom = { type: 'points', pts: [{ x: -5, y: 2 }, { x: 5, y: -3 }] }
    expect(bbox(geom)).toEqual({ minX: -5, minY: -3, maxX: 5, maxY: 2 })

    const project = newProject()
    const strip = newStrip('points', { channel: 2, geom: { pts: [{ x: 1, y: 1 }, { x: 2, y: 2 }] } })
    project.strips.push(strip)
    const pixels = computePixels(project)
    expect(pixels.map((p) => [p.x, p.y])).toEqual([[1, 1], [2, 2]])
    expect(projectBbox(project)).toEqual({ minX: 1, minY: 1, maxX: 2, maxY: 2 })
  })
})

describe('validate', () => {
  it('flags a channel over the RGB limit', () => {
    const project = newProject()
    project.strips.push(newStrip('line', { ledCount: 241, pitch: 1, channel: 0, colorType: 'RGB' }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => w.level === 'error' && w.channel === 0)).toBe(true)
  })

  it('uses the strictest colorType on a channel for the limit (mixed RGBW drops it to 180)', () => {
    const project = newProject()
    project.strips.push(newStrip('line', { ledCount: 190, pitch: 1, channel: 0, colorType: 'RGB' }))
    project.strips.push(newStrip('line', { ledCount: 1, pitch: 1, channel: 0, colorType: 'RGBW', geom: { p0: { x: 0, y: 500 }, angle: 0 } }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => w.level === 'error' && w.channel === 0 && /180/.test(w.message))).toBe(true)
  })

  it('flags mixed colorType on a channel', () => {
    const project = newProject()
    project.strips.push(newStrip('line', { ledCount: 2, pitch: 1, channel: 0, colorType: 'RGB' }))
    project.strips.push(newStrip('line', { ledCount: 2, pitch: 1, channel: 0, colorType: 'RGBW', geom: { p0: { x: 0, y: 500 }, angle: 0 } }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => w.level === 'warning' && /mixes color types/.test(w.message))).toBe(true)
  })

  it('flags exact duplicate pixel coordinates', () => {
    const project = newProject()
    project.strips.push(newStrip('line', { ledCount: 2, pitch: 10, channel: 0, geom: { p0: { x: 0, y: 0 }, angle: 0 } }))
    project.strips.push(newStrip('line', { ledCount: 2, pitch: 10, channel: 1, geom: { p0: { x: 0, y: 0 }, angle: 0 } }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => /Duplicate pixel/.test(w.message))).toBe(true)
  })

  it('flags an empty strip', () => {
    const project = newProject()
    project.strips.push(newStrip('points', { geom: { pts: [] } }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => /is empty/.test(w.message))).toBe(true)
  })

  it('reports nothing for a simple valid project', () => {
    const project = newProject()
    project.strips.push(newStrip('line', { ledCount: 10, pitch: 10, channel: 0 }))
    expect(validateProject(project)).toEqual([])
  })
})

import { quantizeAngle } from '../src/core/geometry/line.js'
describe('angle quantization', () => {
  it('rounds to 0.5 deg and wraps to 0..360', () => {
    expect(quantizeAngle(12.26)).toBe(12.5)
    expect(quantizeAngle(-90.2)).toBe(270)
    expect(quantizeAngle(720.1)).toBe(0)
  })
})
