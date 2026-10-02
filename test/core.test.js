import { describe, it, expect } from 'vitest'
import { newProject, newStrip } from '../src/core/model.js'
import { sample, handles, moveHandle } from '../src/core/geometry/index.js'
import { computePixels } from '../src/core/layout.js'
import { toMapJSON, channelSummary } from '../src/core/export.js'

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

  it('end handle sits at last LED and resizes the strip', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: null }
    const strip = { ledCount: 5, pitch: 10, spacing: 'pitch' }
    expect(handles(geom, strip)[1]).toMatchObject({ x: 40, y: 0 })
    expect(moveHandle(geom, 'end', { x: 0, y: 72 }, {}, strip)).toMatchObject({ ledCount: 8, geom: { angle: 90 } })
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
