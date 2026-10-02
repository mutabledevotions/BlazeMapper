import { describe, it, expect, beforeEach } from 'vitest'
import { newProject, newStrip } from '../src/core/model.js'
import {
  sample,
  handles,
  moveHandle,
  translate,
  scale,
  bbox,
  rotate,
  mirror,
  scaleAbout,
  curveLength as registryCurveLength
} from '../src/core/geometry/index.js'
import { curveLength as arcCurveLength } from '../src/core/geometry/arc.js'
import { curveLength as circleCurveLength } from '../src/core/geometry/circle.js'
import { curveLength as polygonCurveLength } from '../src/core/geometry/polygon.js'
import { computePixels, projectBbox } from '../src/core/layout.js'
import { toMapJSON, channelSummary } from '../src/core/export.js'
import { validateProject } from '../src/core/validate.js'
import { fitToBox, calibrateScale, imageCorners, imageBbox, convertImageUnits } from '../src/core/image.js'
import { ledCount, endAddress, lastAddress, packChannel, setStart, ensureAddresses } from '../src/core/address.js'
import { detectFormat, parseRelaxedJSON, fitPointsToWorld, evalMapFunction } from '../src/core/import.js'
import { initThrottleState, onChange as throttleOnChange, checkDue } from '../src/core/throttle.js'
import { serializeProject, deserializeProject } from '../src/state/persist.js'
import { commit, undo, redo, canUndo, canRedo, resetHistory, beginDrag, commitDrag } from '../src/state/history.js'
import { buildArcLengthTable } from '../src/core/geometry/arclength.js'
import { curveLength as bezierCurveLength } from '../src/core/geometry/bezier.js'
import {
  project,
  selection,
  selectStrips,
  clearSelection,
  duplicateSelected,
  scaleSelected
} from '../src/state/project.svelte.js'

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

  it('emits gap placeholders for unclaimed addresses, repeating the previous LED by default', () => {
    const project = newProject()
    const a = newStrip('line', { ledCount: 2, pitch: 10, channel: 0, geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    a.start = 1
    const b = newStrip('line', { ledCount: 2, pitch: 10, channel: 0, geom: { p0: { x: 100, y: 0 }, angle: 0 } })
    b.start = 5 // leaves addresses 3-4 as a gap
    project.strips.push(a, b)
    const pixels = computePixels(project)
    expect(pixels.map((p) => p.gap)).toEqual([false, false, true, true, false, false])
    // Gap pixels (global 2,3) repeat the previous real LED -- a's last point (10,0).
    expect(pixels[2]).toMatchObject({ x: 10, y: 0, gap: true })
    expect(pixels[3]).toMatchObject({ x: 10, y: 0, gap: true })
    expect(pixels.length).toBe(6)
  })

  it('a channel that starts with a gap uses the first real LED\'s coordinate', () => {
    const project = newProject()
    const a = newStrip('line', { ledCount: 2, pitch: 10, channel: 0, geom: { p0: { x: 50, y: 0 }, angle: 0 } })
    a.start = 3 // addresses 1-2 are a leading gap
    project.strips.push(a)
    const pixels = computePixels(project)
    expect(pixels.map((p) => p.gap)).toEqual([true, true, false, false])
    expect(pixels[0]).toMatchObject({ x: 50, y: 0, gap: true })
  })

  it('gapPlaceholder "origin" puts gaps at the world origin instead', () => {
    const project = newProject()
    project.world = { x: 7, y: 9, size: 100 }
    project.export.gapPlaceholder = 'origin'
    const a = newStrip('line', { ledCount: 1, pitch: 10, channel: 0, geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    a.start = 3
    project.strips.push(a)
    const pixels = computePixels(project)
    expect(pixels[0]).toMatchObject({ x: 7, y: 9, gap: true })
    expect(pixels[1]).toMatchObject({ x: 7, y: 9, gap: true })
    expect(pixels[2]).toMatchObject({ x: 0, y: 0, gap: false })
  })
})

describe('export', () => {
  it('normalizes to (p - world.origin) / world.size, without z when all z are zero', () => {
    const pixels = [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 100, z: 0 }
    ]
    const world = { x: 0, y: 0, size: 200 }
    expect(toMapJSON(pixels, { world, decimals: 2 })).toBe('[[0,0],[0.25,0.5]]')
  })

  it('applies the world origin offset before normalizing', () => {
    const pixels = [{ x: 110, y: 60, z: 0 }]
    const world = { x: 10, y: 10, size: 100 }
    expect(toMapJSON(pixels, { world, decimals: 2 })).toBe('[[1,0.5]]')
  })

  it('normalizes z by world.size too, and includes it when any pixel has non-zero z', () => {
    const pixels = [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 50, z: 25 }
    ]
    const world = { x: 0, y: 0, size: 100 }
    expect(toMapJSON(pixels, { world, decimals: 2 })).toBe('[[0,0,0],[0.5,0.5,0.25]]')
  })

  it('forces z when forceZ is set', () => {
    const pixels = [{ x: 10, y: 20, z: 0 }]
    const world = { x: 0, y: 0, size: 100 }
    expect(toMapJSON(pixels, { world, decimals: 2, forceZ: true })).toBe('[[0.1,0.2,0]]')
  })

  it('rounds to 4 decimals by default', () => {
    const pixels = [{ x: 1, y: 1, z: 0 }]
    const world = { x: 0, y: 0, size: 3 }
    expect(toMapJSON(pixels, { world })).toBe('[[0.3333,0.3333]]')
  })

  it('appends anchor corners when requested, outside the pixel total / channel summary', () => {
    const pixels = [{ x: 10, y: 10, z: 0, channel: 0, colorType: 'RGB', global: 0 }]
    const world = { x: 0, y: 0, size: 100 }
    const json = toMapJSON(pixels, { world, decimals: 2, anchors: true })
    expect(json).toBe('[[0.1,0.1],[0,0],[1,1]]')
    expect(pixels.length).toBe(1)
    expect(channelSummary(pixels)).toEqual([{ channel: 0, colorType: 'RGB', start: 0, count: 1, gaps: 0, used: 1 }])
  })

  it('summarizes contiguous channel runs', () => {
    const pixels = [
      { channel: 0, colorType: 'RGB', global: 0 },
      { channel: 0, colorType: 'RGB', global: 1 },
      { channel: 1, colorType: 'RGBW', global: 2 }
    ]
    expect(channelSummary(pixels)).toEqual([
      { channel: 0, colorType: 'RGB', start: 0, count: 2, gaps: 0, used: 2 },
      { channel: 1, colorType: 'RGBW', start: 2, count: 1, gaps: 0, used: 1 }
    ])
  })

  it('counts gap placeholders toward the channel total, separately from used', () => {
    const pixels = [
      { channel: 0, colorType: 'RGB', global: 0, gap: false },
      { channel: 0, colorType: 'RGB', global: 1, gap: true },
      { channel: 0, colorType: 'RGB', global: 2, gap: false }
    ]
    expect(channelSummary(pixels)).toEqual([{ channel: 0, colorType: 'RGB', start: 0, count: 3, gaps: 1, used: 2 }])
  })
})

describe('geometry rotate', () => {
  it('line: rotates p0 about a center and adds to angle (quantized)', () => {
    const geom = { type: 'line', p0: { x: 10, y: 0 }, angle: 0, p1: null }
    const next = rotate(geom, 90, { x: 0, y: 0 })
    expect(next.p0.x).toBeCloseTo(0)
    expect(next.p0.y).toBeCloseTo(10)
    expect(next.angle).toBe(90)
  })

  it('points: rotates every point about a center', () => {
    const geom = { type: 'points', pts: [{ x: 10, y: 0 }, { x: 0, y: 10 }] }
    const next = rotate(geom, 90, { x: 0, y: 0 })
    expect(next.pts[0].x).toBeCloseTo(0)
    expect(next.pts[0].y).toBeCloseTo(10)
    expect(next.pts[1].x).toBeCloseTo(-10)
    expect(next.pts[1].y).toBeCloseTo(0)
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

  it('flags a strip with a pixel outside the world box (0..1 normalized)', () => {
    const project = newProject()
    project.world = { x: 0, y: 0, size: 100 }
    project.strips.push(newStrip('line', { ledCount: 2, pitch: 10, geom: { p0: { x: 95, y: 0 }, angle: 0 } }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => /outside the world box/.test(w.message))).toBe(true)
  })

  it('does not flag a strip fully inside the world box', () => {
    const project = newProject()
    project.world = { x: 0, y: 0, size: 100 }
    project.strips.push(newStrip('line', { ledCount: 2, pitch: 10, geom: { p0: { x: 0, y: 0 }, angle: 0 } }))
    const warnings = validateProject(project)
    expect(warnings.some((w) => /outside the world box/.test(w.message))).toBe(false)
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

describe('geometry mirror', () => {
  it('line: horizontal flip negates x about center, keeps y, angle -> 180-angle', () => {
    const geom = { type: 'line', p0: { x: 10, y: 5 }, angle: 30, p1: null }
    const next = mirror(geom, 'h', { x: 0, y: 0 })
    expect(next.p0).toEqual({ x: -10, y: 5 })
    expect(next.angle).toBe(150)
  })

  it('line: vertical flip negates y about center, keeps x, angle -> -angle', () => {
    const geom = { type: 'line', p0: { x: 10, y: 5 }, angle: 30, p1: null }
    const next = mirror(geom, 'v', { x: 0, y: 0 })
    expect(next.p0).toEqual({ x: 10, y: -5 })
    expect(next.angle).toBe(330)
  })

  it('line fit mode: mirrors p1 along with p0', () => {
    const geom = { type: 'line', p0: { x: 0, y: 0 }, angle: 0, p1: { x: 40, y: 0 } }
    const next = mirror(geom, 'h', { x: 20, y: 0 })
    expect(next.p0).toEqual({ x: 40, y: 0 })
    expect(next.p1).toEqual({ x: 0, y: 0 })
  })

  it('points: mirrors every point about the given center', () => {
    const geom = { type: 'points', pts: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }
    const h = mirror(geom, 'h', { x: 5, y: 0 })
    expect(h.pts).toEqual([{ x: 10, y: 0 }, { x: 0, y: 10 }])
    const v = mirror(geom, 'v', { x: 0, y: 5 })
    expect(v.pts).toEqual([{ x: 0, y: 10 }, { x: 10, y: 0 }])
  })
})

describe('geometry scaleAbout', () => {
  it('line: scales both p0 and p1 away from the anchor', () => {
    const geom = { type: 'line', p0: { x: 10, y: 0 }, angle: 0, p1: { x: 20, y: 0 } }
    const next = scaleAbout(geom, 2, { x: 0, y: 0 })
    expect(next.p0).toEqual({ x: 20, y: 0 })
    expect(next.p1).toEqual({ x: 40, y: 0 })
  })

  it('points: scales every point away from the anchor', () => {
    const geom = { type: 'points', pts: [{ x: 10, y: 10 }] }
    const next = scaleAbout(geom, 0.5, { x: 0, y: 0 })
    expect(next.pts).toEqual([{ x: 5, y: 5 }])
  })
})

describe('store: scaleSelected locked vs unlocked pitch scaling', () => {
  beforeEach(() => {
    project.strips.splice(0, project.strips.length)
    clearSelection()
  })

  it('locked: scales p0 about the anchor but leaves pitch, ledCount, and angle unchanged', () => {
    const s = newStrip('line', { ledCount: 5, pitch: 10, geom: { p0: { x: 10, y: 0 }, angle: 0 } })
    project.strips.push(s)
    selectStrips([s.id])
    scaleSelected(2, { x: 0, y: 0 }, true)
    const after = project.strips[0]
    expect(after.geom.p0).toEqual({ x: 20, y: 0 })
    expect(after.pitch).toBe(10)
    expect(after.ledCount).toBe(5)
    expect(after.geom.angle).toBe(0)
  })

  it('locked, fit mode: p1 is carried by the same translation as p0, not scaled independently', () => {
    const s = newStrip('line', {
      ledCount: 3,
      pitch: 10,
      spacing: 'fit',
      geom: { p0: { x: 10, y: 0 }, angle: 0, p1: { x: 30, y: 0 } }
    })
    project.strips.push(s)
    selectStrips([s.id])
    scaleSelected(2, { x: 0, y: 0 }, true)
    const after = project.strips[0]
    // p0: 10 -> 20 (dx +10); p1 carried by the same +10, not scaled to 60.
    expect(after.geom.p0).toEqual({ x: 20, y: 0 })
    expect(after.geom.p1).toEqual({ x: 40, y: 0 })
  })

  it('unlocked: full geometric scale, and pitch scales too', () => {
    const s = newStrip('line', { ledCount: 5, pitch: 10, geom: { p0: { x: 10, y: 0 }, angle: 0 } })
    project.strips.push(s)
    selectStrips([s.id])
    scaleSelected(2, { x: 0, y: 0 }, false)
    const after = project.strips[0]
    expect(after.geom.p0).toEqual({ x: 20, y: 0 })
    expect(after.pitch).toBe(20)
  })

  it('skips locked strips', () => {
    const s = newStrip('line', { ledCount: 5, pitch: 10, locked: true, geom: { p0: { x: 10, y: 0 }, angle: 0 } })
    project.strips.push(s)
    selectStrips([s.id])
    scaleSelected(2, { x: 0, y: 0 }, false)
    expect(project.strips[0].geom.p0).toEqual({ x: 10, y: 0 })
  })
})

describe('core/image: fitToBox', () => {
  it('contains the image centred in a square world box, picking the limiting axis', () => {
    // 2000x1000 image into a 2000x2000 box: height is the limiting axis (scale 2),
    // width would need scale 1 -- Contain picks the smaller (2 vs 1) -> 1.
    const fit = fitToBox(2000, 1000, { x: 0, y: 0, size: 2000 })
    expect(fit.scale).toBe(1)
    expect(fit.x).toBe(1000)
    expect(fit.y).toBe(1000)
  })

  it('picks the width-limited scale when the image is tall and narrow', () => {
    const fit = fitToBox(1000, 2000, { x: 0, y: 0, size: 2000 })
    expect(fit.scale).toBe(1)
  })

  it('centres on the world box origin, not just (0,0)', () => {
    const fit = fitToBox(1000, 1000, { x: 500, y: 500, size: 1000 })
    expect(fit).toEqual({ x: 1000, y: 1000, scale: 1 })
  })
})

describe('core/image: calibrateScale', () => {
  it('scales so |p1-p2| becomes realDistance, keeping their midpoint fixed', () => {
    const image = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.5, locked: false, visible: true }
    // Two points 10 world units apart, midpoint (5, 0); real distance is 50 -> k = 5.
    const result = calibrateScale(image, { x: 0, y: 0 }, { x: 10, y: 0 }, 50)
    expect(result.scale).toBe(5)
    // Image centre (0,0) scales away from anchor (5,0) by k=5: 5 + (0-5)*5 = -20.
    expect(result.x).toBeCloseTo(-20)
    expect(result.y).toBeCloseTo(0)
  })

  it('keeps the midpoint itself fixed under the same transform', () => {
    const image = { x: 5, y: 0, scale: 1, rotation: 0, opacity: 0.5, locked: false, visible: true }
    // Image centre already at the midpoint -- scaling about it leaves it put.
    const result = calibrateScale(image, { x: 0, y: 0 }, { x: 10, y: 0 }, 20)
    expect(result.x).toBeCloseTo(5)
    expect(result.y).toBeCloseTo(0)
    expect(result.scale).toBe(2)
  })

  it('returns null when the two points coincide', () => {
    const image = { x: 0, y: 0, scale: 1, rotation: 0 }
    expect(calibrateScale(image, { x: 3, y: 3 }, { x: 3, y: 3 }, 50)).toBeNull()
  })

  it('returns null for a non-positive real distance', () => {
    const image = { x: 0, y: 0, scale: 1, rotation: 0 }
    expect(calibrateScale(image, { x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toBeNull()
  })
})

describe('core/image: corners, bbox, unit conversion', () => {
  it('unrotated corners are the axis-aligned half-extents around the centre', () => {
    const image = { x: 100, y: 100, scale: 2, rotation: 0 }
    // naturalW=10, naturalH=20 -> world w=20, h=40 -> half-extents 10, 20
    const corners = imageCorners(image, 10, 20)
    expect(corners).toEqual([
      { x: 90, y: 80 },
      { x: 110, y: 80 },
      { x: 110, y: 120 },
      { x: 90, y: 120 }
    ])
  })

  it('a 90 degree rotation swaps the bbox width/height', () => {
    const image = { x: 0, y: 0, scale: 1, rotation: 90 }
    const bbox = imageBbox(image, 100, 40) // world 100x40, rotated 90 -> bbox 40x100
    expect(bbox.maxX - bbox.minX).toBeCloseTo(40)
    expect(bbox.maxY - bbox.minY).toBeCloseTo(100)
  })

  it('an unrotated bbox matches the plain half-extents', () => {
    const image = { x: 5, y: -5, scale: 1, rotation: 0 }
    const bbox = imageBbox(image, 10, 10)
    expect(bbox).toEqual({ minX: 0, minY: -10, maxX: 10, maxY: 0 })
  })

  it('convertImageUnits scales x, y, and scale by the same factor', () => {
    const image = { x: 100, y: 50, scale: 2 }
    expect(convertImageUnits(image, 0.5)).toEqual({ x: 50, y: 25, scale: 1 })
  })
})

describe('store: duplicateSelected', () => {
  beforeEach(() => {
    project.strips.splice(0, project.strips.length)
    clearSelection()
    project.grid.divisions = 20
    project.world = { x: 0, y: 0, size: 2000 }
  })

  it('clones with new ids, "<name> copy", offset by one grid step, inserted right after the original', () => {
    const a = newStrip('line', { name: 'Strip 1', geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    const b = newStrip('line', { name: 'Strip 2', geom: { p0: { x: 100, y: 0 }, angle: 0 } })
    project.strips.push(a, b)
    selectStrips([a.id])

    const newIds = duplicateSelected()
    expect(newIds.length).toBe(1)
    expect(newIds[0]).not.toBe(a.id)

    const ids = project.strips.map((s) => s.id)
    expect(ids).toEqual([a.id, newIds[0], b.id])

    const copy = project.strips[1]
    expect(copy.name).toBe('Strip 1 copy')
    const step = project.world.size / project.grid.divisions
    expect(copy.geom.p0).toEqual({ x: step, y: step })
    expect(selection.ids).toEqual(newIds)
  })

  it('duplicates every selected strip and skips locked ones', () => {
    const a = newStrip('line', { name: 'A', geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    const b = newStrip('line', { name: 'B', locked: true, geom: { p0: { x: 50, y: 0 }, angle: 0 } })
    project.strips.push(a, b)
    selectStrips([a.id, b.id])

    const newIds = duplicateSelected()
    expect(newIds.length).toBe(1)
    expect(project.strips.length).toBe(3)
    expect(project.strips.some((s) => s.name === 'B copy')).toBe(false)
  })
})
function strip(id, channel, start, ledCount) {
  return { id, channel, start, ledCount, locked: false, colorType: 'RGB' }
}

describe('core/address: ledCount / endAddress', () => {
  it('ledCount reads the points list length for points geometry', () => {
    const item = { ledCount: 99, geom: { type: 'points', pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }
    expect(ledCount(item)).toBe(2)
  })

  it('ledCount reads strip.ledCount for non-points geometry', () => {
    const item = { ledCount: 7, geom: { type: 'line' } }
    expect(ledCount(item)).toBe(7)
  })

  it('endAddress is start + ledCount - 1', () => {
    expect(endAddress(strip('a', 0, 5, 10))).toBe(14)
  })

  it('lastAddress finds the max end across a channel, 0 when empty', () => {
    expect(lastAddress([strip('a', 0, 1, 10), strip('b', 0, 20, 5)])).toBe(24)
    expect(lastAddress([])).toBe(0)
  })
})

describe('core/address: packChannel', () => {
  it('assigns sequential starts from 1, no gaps', () => {
    const items = [strip('a', 0, undefined, 3), strip('b', 0, undefined, 5)]
    const packed = packChannel(items)
    expect(packed.map((i) => [i.id, i.start])).toEqual([
      ['a', 1],
      ['b', 4]
    ])
  })
})

describe('core/address: setStart -- plan examples', () => {
  // Strips 1-10 / 12-21 / 30-39 (ledCount 10 each, gap at 11 and 22-29).
  function baseItems() {
    return [strip('s1', 0, 1, 10), strip('s2', 0, 12, 10), strip('s3', 0, 30, 10)]
  }

  it('move strip 3 to 11 -> 3 at 11-20, 2 pushed to 21-30, 1 untouched', () => {
    const next = setStart(baseItems(), 's3', 11)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.s1.start).toBe(1)
    expect(byId.s3.start).toBe(11)
    expect(endAddress(byId.s3)).toBe(20)
    expect(byId.s2.start).toBe(21)
    expect(endAddress(byId.s2)).toBe(30)
  })

  it('move strip 2 to 1 -> 2 at 1-10, 1 pushed to 11-20, 3 untouched', () => {
    const next = setStart(baseItems(), 's2', 1)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.s2.start).toBe(1)
    expect(endAddress(byId.s2)).toBe(10)
    expect(byId.s1.start).toBe(11)
    expect(endAddress(byId.s1)).toBe(20)
    expect(byId.s3.start).toBe(30)
  })

  it.each([31, 29, 23])('nudging strip 3 to %i just moves it (no overlap, no push)', (S) => {
    const next = setStart(baseItems(), 's3', S)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.s3.start).toBe(S)
    expect(byId.s1.start).toBe(1)
    expect(byId.s2.start).toBe(12)
  })
})

describe('core/address: setStart -- cascade and growth', () => {
  it('cascades through more than one overlapping peer', () => {
    // a:1-5, b:6-10, c:11-15, d:20-24. Moving d to 1 should push a,b,c forward in turn.
    const items = [strip('a', 0, 1, 5), strip('b', 0, 6, 5), strip('c', 0, 11, 5), strip('d', 0, 20, 5)]
    const next = setStart(items, 'd', 1)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.d.start).toBe(1)
    expect(byId.a.start).toBe(6)
    expect(byId.b.start).toBe(11)
    expect(byId.c.start).toBe(16)
  })

  it('growing an item\'s ledCount re-pushes a now-overlapping later item', () => {
    // a:1-10, b:11-20. Growing a to 15 LEDs (end 15) overlaps b -> b pushes to 16.
    let items = [strip('a', 0, 1, 10), strip('b', 0, 11, 10)]
    items = items.map((i) => (i.id === 'a' ? { ...i, ledCount: 15 } : i))
    const next = setStart(items, 'a', 1) // re-run push after the ledCount change
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.a.start).toBe(1)
    expect(endAddress(byId.a)).toBe(15)
    expect(byId.b.start).toBe(16)
  })

  it('shrinking ledCount never pushes -- a smaller claim just opens a gap', () => {
    let items = [strip('a', 0, 1, 10), strip('b', 0, 11, 10)]
    items = items.map((i) => (i.id === 'a' ? { ...i, ledCount: 3 } : i))
    const next = setStart(items, 'a', 1)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.a.start).toBe(1)
    expect(byId.b.start).toBe(11)
  })

  it('locked peer is never moved; the push jumps past its end', () => {
    // a:1-10, L(locked):11-20, b:21-30. Moving c to 5 overlaps a and (if pushed
    // past) would land on L -- L must stay put, and a lands right after it.
    const items = [strip('a', 0, 1, 10), { ...strip('L', 0, 11, 10), locked: true }, strip('b', 0, 21, 10), strip('c', 0, 50, 10)]
    const next = setStart(items, 'c', 1)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.c.start).toBe(1)
    expect(byId.L.start).toBe(11) // untouched
    expect(byId.a.start).toBe(21) // pushed past L's end (20), not into it
    expect(byId.b.start).toBe(31)
  })

  it('setStart on a locked item is a no-op', () => {
    const items = [{ ...strip('a', 0, 1, 10), locked: true }, strip('b', 0, 11, 10)]
    const next = setStart(items, 'a', 50)
    expect(next).toBe(items)
  })

  it('a locked item\'s own unchanged start still re-runs the cascade for its neighbors', () => {
    // Growing a locked strip's ledCount keeps it in place but should still push
    // a now-overlapping neighbor forward.
    let items = [{ ...strip('a', 0, 1, 10), locked: true }, strip('b', 0, 11, 10)]
    items = items.map((i) => (i.id === 'a' ? { ...i, ledCount: 15 } : i))
    const next = setStart(items, 'a', 1) // same start as before -- not a move
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.a.start).toBe(1)
    expect(byId.b.start).toBe(16)
  })
})

describe('core/address: ensureAddresses migration', () => {
  it('packs items missing start after the channel\'s current last address', () => {
    const items = [strip('a', 0, 1, 10), { id: 'b', channel: 0, ledCount: 5 }, { id: 'c', channel: 1, ledCount: 2 }]
    const next = ensureAddresses(items)
    const byId = Object.fromEntries(next.map((i) => [i.id, i]))
    expect(byId.a.start).toBe(1)
    expect(byId.b.start).toBe(11)
    expect(byId.c.start).toBe(1)
  })

  it('is a no-op (same reference) when every item already has a start', () => {
    const items = [strip('a', 0, 1, 10)]
    expect(ensureAddresses(items)).toBe(items)
  })
})

describe('core/import: relaxed JSON', () => {
  it('parses the Pixelblaze doc example (trailing comma)', () => {
    expect(parseRelaxedJSON('[[0,0],[100,100],]')).toEqual([
      [0, 0],
      [100, 100]
    ])
  })

  it('strips // and /* */ comments', () => {
    const text = `[
      [0,0], // first
      /* second */ [10,0]
    ]`
    expect(parseRelaxedJSON(text)).toEqual([
      [0, 0],
      [10, 0]
    ])
  })

  it('detectFormat parses a 2D map', () => {
    const d = detectFormat('[[0,0],[10,10],]')
    expect(d.kind).toBe('map')
    expect(d.points).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 }
    ])
  })

  it('detectFormat parses a 3D map', () => {
    const d = detectFormat('[[0,0,0],[1,2,3]]')
    expect(d.kind).toBe('map')
    expect(d.points).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 }
    ])
  })

  it('detectFormat recognizes a generator function without evaluating it', () => {
    expect(detectFormat('function (pixelCount) { return []; }').kind).toBe('function')
  })

  it('evalMapFunction only runs on request and returns points', () => {
    const src = 'function (pixelCount) { var a = []; for (var i = 0; i < pixelCount; i++) a.push([i, 0]); return a; }'
    expect(evalMapFunction(src, 3)).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 }
    ])
  })

  it('detectFormat recognizes a project file (an object with a strips array)', () => {
    expect(detectFormat(JSON.stringify({ version: 1, strips: [] })).kind).toBe('project')
  })

  it('detectFormat reports an error for malformed JSON', () => {
    expect(detectFormat('[[0,0]').kind).toBe('error')
  })

  it('detectFormat reports an error for an array of non-coordinate entries', () => {
    expect(detectFormat('[1,2,3]').kind).toBe('error')
  })

  it('detectFormat reports "empty" for blank input', () => {
    expect(detectFormat('   ').kind).toBe('empty')
  })
})

describe('core/import: fitPointsToWorld', () => {
  it('fits (contain, keep aspect) and centers into the world box', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 50, z: 0 }
    ]
    const world = { x: 0, y: 0, size: 200 }
    // bbox 100x50 (centre 50,25); contain into 200x200 picks the limiting
    // axis (100-wide) -> scale 2; world box centre is (100,100).
    const fitted = fitPointsToWorld(points, world)
    expect(fitted[0]).toEqual({ x: 0, y: 50, z: 0 })
    expect(fitted[1]).toEqual({ x: 200, y: 150, z: 0 })
  })

  it('returns an empty array for no points', () => {
    expect(fitPointsToWorld([], { x: 0, y: 0, size: 100 })).toEqual([])
  })
})

describe('state/persist: serialize/deserialize round-trip', () => {
  it('keeps the project fields at the top level and splits the image data back out', () => {
    const projectData = { version: 1, units: 'mm', strips: [{ id: 'a' }] }
    const imageSrcData = { dataUrl: 'data:image/png;base64,xx', naturalW: 10, naturalH: 20, name: 'photo.png' }
    const record = serializeProject(projectData, imageSrcData)
    expect(record.version).toBe(1)
    expect(record.strips).toEqual([{ id: 'a' }])
    expect(typeof record.savedAt).toBe('number')
    expect(record.imageData).toEqual(imageSrcData)

    const result = deserializeProject(record)
    expect(result.project).toEqual(projectData)
    expect(result.imageData).toEqual(imageSrcData)
    expect(result.savedAt).toBe(record.savedAt)
  })

  it('imageData is null when there is no reference image', () => {
    const record = serializeProject({ version: 1, strips: [] }, { dataUrl: null })
    expect(record.imageData).toBeNull()
  })
})

describe('core/throttle: autosave trailing throttle', () => {
  it('saves immediately on the first change', () => {
    const result = throttleOnChange(initThrottleState(), 1000, 5000)
    expect(result.action).toBe('save')
    expect(result.state).toEqual({ lastSavedAt: 1000, dueAt: null })
  })

  it('later changes inside the window schedule one trailing save instead of another immediate one', () => {
    let state = throttleOnChange(initThrottleState(), 1000, 5000).state
    const r1 = throttleOnChange(state, 2000, 5000)
    expect(r1.action).toBe('wait')
    expect(r1.state.dueAt).toBe(6000)
    const r2 = throttleOnChange(r1.state, 3000, 5000) // folds into the same trailing save
    expect(r2.action).toBe('wait')
    expect(r2.state.dueAt).toBe(6000)
  })

  it('checkDue only fires once the trailing save time has passed', () => {
    let state = throttleOnChange(initThrottleState(), 1000, 5000).state
    state = throttleOnChange(state, 2000, 5000).state // dueAt = 6000
    expect(checkDue(state, 5999).action).toBe('wait')
    const fired = checkDue(state, 6000)
    expect(fired.action).toBe('save')
    expect(fired.state).toEqual({ lastSavedAt: 6000, dueAt: null })
  })

  it('a change after the interval has fully elapsed saves immediately again', () => {
    const state = throttleOnChange(initThrottleState(), 1000, 5000).state
    expect(throttleOnChange(state, 6500, 5000).action).toBe('save')
  })
})

describe('state/history: undo/redo', () => {
  beforeEach(() => {
    project.strips.splice(0, project.strips.length)
    clearSelection()
    resetHistory()
  })

  it('commit() pushes a snapshot; undo restores the prior state, redo reapplies it', () => {
    project.strips.push(newStrip('line', { name: 'A', geom: { p0: { x: 0, y: 0 }, angle: 0 } }))
    commit()
    expect(canUndo()).toBe(true)
    expect(canRedo()).toBe(false)

    project.strips.push(newStrip('line', { name: 'B', geom: { p0: { x: 50, y: 0 }, angle: 0 } }))
    commit()
    expect(project.strips.length).toBe(2)

    undo()
    expect(project.strips.length).toBe(1)
    expect(project.strips[0].name).toBe('A')
    expect(canRedo()).toBe(true)

    redo()
    expect(project.strips.length).toBe(2)
    expect(project.strips[1].name).toBe('B')
  })

  it('a new commit after an undo clears the redo stack', () => {
    project.strips.push(newStrip('line', { name: 'A' }))
    commit()
    project.strips.push(newStrip('line', { name: 'B' }))
    commit()
    undo()
    expect(canRedo()).toBe(true)
    project.strips.push(newStrip('line', { name: 'C' }))
    commit()
    expect(canRedo()).toBe(false)
  })

  it('restoring a snapshot drops selection ids for strips that no longer exist', () => {
    const a = newStrip('line', { name: 'A' })
    project.strips.push(a)
    commit()
    selectStrips([a.id])

    const b = newStrip('line', { name: 'B' })
    project.strips.push(b)
    commit()
    selectStrips([a.id, b.id])

    undo() // back to just [a] -- b.id is no longer a valid selection
    expect(selection.ids).toEqual([a.id])
  })

  it('beginDrag/commitDrag push one entry per gesture, and commitDrag is a no-op when nothing changed', () => {
    const a = newStrip('line', { name: 'A', geom: { p0: { x: 0, y: 0 }, angle: 0 } })
    project.strips.push(a)
    commit()
    resetHistory() // clean slate for the assertions below

    beginDrag()
    commitDrag() // nothing mutated since beginDrag() -- no-op
    expect(canUndo()).toBe(false)

    beginDrag()
    a.geom = { ...a.geom, p0: { x: 10, y: 10 } }
    commitDrag()
    expect(canUndo()).toBe(true)

    undo()
    expect(project.strips[0].geom.p0).toEqual({ x: 0, y: 0 })
  })
})

describe('core/geometry/arclength', () => {
  it('arc length of a straight-line "curve" equals its chord length', () => {
    const f = (t) => ({ x: t * 100, y: 0 })
    const table = buildArcLengthTable(f)
    expect(table.total).toBeCloseTo(100, 3)
  })
})

describe('core/geometry/bezier', () => {
  function curvyGeom() {
    // A visibly bowed S: p0/p1 100 apart, controls offset +-40 perpendicular.
    return {
      type: 'bezier',
      p0: { x: 0, y: 0 },
      c0: { x: 33, y: -40 },
      c1: { x: 67, y: 40 },
      p1: { x: 100, y: 0 }
    }
  }

  it('pitch mode spaces consecutive LEDs within 2% of the strip pitch', () => {
    const geom = curvyGeom()
    const strip = { ledCount: 15, pitch: 6, spacing: 'pitch' }
    const pts = sample(geom, strip)
    expect(pts.length).toBe(15)
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      expect(Math.abs(d - strip.pitch) / strip.pitch).toBeLessThan(0.02)
    }
  })

  it('pitch mode continues past the curve end along the end tangent', () => {
    // A short, nearly-straight curve with a strip far longer than it (in LEDs
    // at this pitch) -- later LEDs must keep real, even spacing in a straight
    // line continuing from p1, not bunch up at the last sampled point.
    const geom = { type: 'bezier', p0: { x: 0, y: 0 }, c0: { x: 3, y: 0 }, c1: { x: 7, y: 0 }, p1: { x: 10, y: 0 } }
    const strip = { ledCount: 10, pitch: 5, spacing: 'pitch' }
    const pts = sample(geom, strip)
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      expect(d).toBeCloseTo(5, 1)
    }
    // Past the curve (length 10), LEDs should continue along +x (the end tangent).
    expect(pts[9].y).toBeCloseTo(0, 6)
    expect(pts[9].x).toBeGreaterThan(geom.p1.x)
  })

  it('fit mode places the first and last LED exactly at p0 and p1', () => {
    const geom = curvyGeom()
    const strip = { ledCount: 8, spacing: 'fit' }
    const pts = sample(geom, strip)
    expect(pts[0]).toEqual({ x: geom.p0.x, y: geom.p0.y })
    expect(pts[pts.length - 1].x).toBeCloseTo(geom.p1.x, 6)
    expect(pts[pts.length - 1].y).toBeCloseTo(geom.p1.y, 6)
  })

  it('exposes p0/c0/c1/p1 handles', () => {
    const geom = curvyGeom()
    expect(handles(geom, {}).map((h) => h.id)).toEqual(['p0', 'c0', 'c1', 'p1'])
  })

  it('moving p0 carries c0 with it; c1/p1 untouched', () => {
    const geom = curvyGeom()
    const patch = moveHandle(geom, 'p0', { x: 10, y: 10 }, {})
    expect(patch.geom.p0).toEqual({ x: 10, y: 10 })
    // c0 moved by the same delta (+10, +10) as p0.
    expect(patch.geom.c0).toEqual({ x: geom.c0.x + 10, y: geom.c0.y + 10 })
    expect(patch.geom.c1).toEqual(geom.c1)
    expect(patch.geom.p1).toEqual(geom.p1)
  })

  it('moving p1 carries c1 with it', () => {
    const geom = curvyGeom()
    const patch = moveHandle(geom, 'p1', { x: 110, y: -10 }, {})
    expect(patch.geom.p1).toEqual({ x: 110, y: -10 })
    expect(patch.geom.c1).toEqual({ x: geom.c1.x + 10, y: geom.c1.y - 10 })
    expect(patch.geom.p0).toEqual(geom.p0)
  })

  it('moving c0/c1 moves only that control point', () => {
    const geom = curvyGeom()
    const patch = moveHandle(geom, 'c1', { x: 70, y: 50 }, {})
    expect(patch.geom.c1).toEqual({ x: 70, y: 50 })
    expect(patch.geom.c0).toEqual(geom.c0)
    expect(patch.geom.p0).toEqual(geom.p0)
    expect(patch.geom.p1).toEqual(geom.p1)
  })

  it('shift-snaps a control handle angle (from its own anchor) to 15 degrees', () => {
    const geom = { type: 'bezier', p0: { x: 0, y: 0 }, c0: { x: 10, y: 0 }, c1: { x: 90, y: 0 }, p1: { x: 100, y: 0 } }
    const patch = moveHandle(geom, 'c0', { x: 10, y: 6 }, { shiftSnap: true })
    const angle = (Math.atan2(patch.geom.c0.y - geom.p0.y, patch.geom.c0.x - geom.p0.x) * 180) / Math.PI
    expect(Math.round(angle) % 15).toBe(0)
  })

  it('rotate/mirror/scaleAbout transform every control point', () => {
    const geom = curvyGeom()
    const center = { x: 50, y: 0 }

    const rotated = rotate(geom, 90, center)
    expect(rotated.p0.x).toBeCloseTo(50);
    expect(rotated.p0.y).toBeCloseTo(-50)
    expect(rotated.p1.x).toBeCloseTo(50)
    expect(rotated.p1.y).toBeCloseTo(50)

    const mirroredH = mirror(geom, 'h', center)
    expect(mirroredH.p0).toEqual({ x: 100, y: 0 })
    expect(mirroredH.p1).toEqual({ x: 0, y: 0 })
    expect(mirroredH.c0).toEqual({ x: center.x * 2 - geom.c0.x, y: geom.c0.y })

    const scaled = scaleAbout(geom, 2, center)
    expect(scaled.p0).toEqual({ x: center.x + (geom.p0.x - center.x) * 2, y: geom.p0.y })
    expect(scaled.p1).toEqual({ x: center.x + (geom.p1.x - center.x) * 2, y: geom.p1.y })
    expect(scaled.c0.x).toBeCloseTo(center.x + (geom.c0.x - center.x) * 2)
  })

  it('translate and scale move every control point together', () => {
    const geom = curvyGeom()
    const moved = translate(geom, 5, -5)
    expect(moved.p0).toEqual({ x: 5, y: -5 })
    expect(moved.p1).toEqual({ x: 105, y: -5 })
    const scaled = scale(geom, 2)
    expect(scaled.p0).toEqual({ x: 0, y: 0 })
    expect(scaled.p1).toEqual({ x: 200, y: 0 })
  })

  it('curveLength() matches the arc-length table total', () => {
    const geom = curvyGeom()
    expect(bezierCurveLength(geom)).toBeGreaterThan(100) // bowed, so longer than the chord
  })

  it('newStrip defaults a bezier whose p0..p1 span roughly (ledCount-1)*pitch', () => {
    const strip = newStrip('bezier', { ledCount: 11, pitch: 10, geom: { center: { x: 0, y: 0 } } })
    const span = Math.hypot(strip.geom.p1.x - strip.geom.p0.x, strip.geom.p1.y - strip.geom.p0.y)
    expect(span).toBeCloseTo(100, 6)
  })

  it('layout.computePixels works with a bezier strip and explicit addresses', () => {
    const project = newProject()
    const strip = newStrip('bezier', {
      ledCount: 6,
      pitch: 10,
      channel: 0,
      spacing: 'fit',
      geom: { p0: { x: 0, y: 0 }, c0: { x: 20, y: -20 }, c1: { x: 40, y: 20 }, p1: { x: 60, y: 0 } }
    })
    strip.start = 1
    project.strips.push(strip)
    const pixels = computePixels(project)
    expect(pixels.length).toBe(6)
    expect(pixels[0]).toMatchObject({ x: 0, y: 0, channel: 0, gap: false })
    expect(pixels[5]).toMatchObject({ x: 60, y: 0, channel: 0, gap: false })
    expect(pixels.map((p) => p.global)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('core/geometry/arc', () => {
  function quarterArc() {
    // Quarter circle, radius 100, from 0deg to 90deg (sweep 90).
    return { type: 'arc', center: { x: 0, y: 0 }, radius: 100, startAngle: 0, sweep: 90 }
  }

  it('pitch mode spaces consecutive LEDs within 2% of the strip pitch', () => {
    const geom = quarterArc()
    const strip = { ledCount: 12, pitch: 10, spacing: 'pitch' }
    const pts = sample(geom, strip)
    expect(pts.length).toBe(12)
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      expect(Math.abs(d - strip.pitch) / strip.pitch).toBeLessThan(0.02)
    }
  })

  it('pitch mode continues past the arc end along the end tangent', () => {
    const geom = quarterArc() // length = 100 * pi/2 ~= 157.08
    const strip = { ledCount: 20, pitch: 10, spacing: 'pitch' }
    const pts = sample(geom, strip)
    const end = { x: geom.center.x + geom.radius * Math.cos(Math.PI / 2), y: geom.center.y + geom.radius * Math.sin(Math.PI / 2) }
    const last = pts[pts.length - 1]
    // Past the arc (length ~157), later LEDs keep even ~10-unit spacing.
    const d = Math.hypot(last.x - pts[pts.length - 2].x, last.y - pts[pts.length - 2].y)
    expect(d).toBeCloseTo(10, 1)
    // The end tangent at 90deg (increasing-angle travel) points in -x, so
    // extrapolated LEDs continue in a straight line off to -x at y ~= end.y.
    expect(last.x).toBeLessThan(end.x)
    expect(last.y).toBeCloseTo(end.y, 0)
  })

  it('fit mode places the first and last LED exactly at the arc endpoints', () => {
    const geom = quarterArc()
    const strip = { ledCount: 8, spacing: 'fit' }
    const pts = sample(geom, strip)
    expect(pts[0].x).toBeCloseTo(100, 6)
    expect(pts[0].y).toBeCloseTo(0, 6)
    expect(pts[pts.length - 1].x).toBeCloseTo(0, 6)
    expect(pts[pts.length - 1].y).toBeCloseTo(100, 6)
  })

  it('exposes center/start/sweep handles', () => {
    const geom = quarterArc()
    expect(handles(geom, {}).map((h) => h.id)).toEqual(['center', 'start', 'sweep'])
  })

  it('moving the center handle translates the whole arc', () => {
    const geom = quarterArc()
    const patch = moveHandle(geom, 'center', { x: 10, y: -10 }, {})
    expect(patch.geom.center).toEqual({ x: 10, y: -10 })
    expect(patch.geom.radius).toBe(100)
    expect(patch.geom.sweep).toBe(90)
  })

  it('moving the start handle changes radius and start angle, not sweep', () => {
    const geom = quarterArc()
    const patch = moveHandle(geom, 'start', { x: 0, y: 50 }, {})
    expect(patch.geom.radius).toBeCloseTo(50, 6)
    expect(patch.geom.startAngle).toBeCloseTo(90, 1)
    expect(patch.geom.sweep).toBe(90)
  })

  it('moving the sweep handle changes only sweep, shift-snapping to 15 degrees', () => {
    const geom = quarterArc()
    // Drag to straight down (+y from center) -- that's 90deg from start (0deg),
    // but nudge it off so a non-snapped drag would not land on a 15deg step.
    const patch = moveHandle(geom, 'sweep', { x: -5, y: 100 }, { shiftSnap: true })
    expect(patch.geom.radius).toBe(100)
    expect(patch.geom.startAngle).toBe(0)
    expect(Math.round(patch.geom.sweep * 2) % 15).toBe(0)
  })

  it('translate moves only the center; rotate/mirror/scaleAbout behave as documented', () => {
    const geom = quarterArc()
    const moved = translate(geom, 5, -5)
    expect(moved.center).toEqual({ x: 5, y: -5 })
    expect(moved.radius).toBe(100)

    const rotated = rotate(geom, 90, { x: 0, y: 0 })
    expect(rotated.center.x).toBeCloseTo(0, 6)
    expect(rotated.center.y).toBeCloseTo(0, 6)
    expect(rotated.startAngle).toBeCloseTo(90, 1)

    const mirroredH = mirror(geom, 'h', { x: 0, y: 0 })
    expect(mirroredH.sweep).toBe(-90)

    const scaled = scaleAbout(geom, 2, { x: 0, y: 0 })
    expect(scaled.radius).toBe(200)
  })

  it('scale(k) scales center and radius about the origin', () => {
    const geom = { type: 'arc', center: { x: 10, y: 0 }, radius: 50, startAngle: 0, sweep: 90 }
    const scaled = scale(geom, 2)
    expect(scaled.center).toEqual({ x: 20, y: 0 })
    expect(scaled.radius).toBe(100)
  })

  it('curveLength() is radius * |sweep in radians| -- matches both the module export and the registry', () => {
    const geom = quarterArc()
    const expected = 100 * (Math.PI / 2)
    expect(arcCurveLength(geom)).toBeCloseTo(expected, 6)
    expect(registryCurveLength(geom)).toBeCloseTo(expected, 6)
  })

  it('newStrip sizes a default arc so its arc length is roughly (ledCount-1)*pitch', () => {
    const strip = newStrip('arc', { ledCount: 11, pitch: 10, geom: { center: { x: 0, y: 0 } } })
    expect(arcCurveLength(strip.geom)).toBeCloseTo(100, 4)
  })

  it('layout.computePixels works with an arc strip', () => {
    const project = newProject()
    const strip = newStrip('arc', {
      ledCount: 8,
      pitch: 10,
      channel: 2,
      spacing: 'fit',
      geom: { center: { x: 0, y: 0 }, radius: 100, startAngle: 0, sweep: 90 }
    })
    strip.start = 1
    project.strips.push(strip)
    const pixels = computePixels(project)
    expect(pixels.length).toBe(8)
    expect(pixels[0]).toMatchObject({ x: 100, y: 0, channel: 2, gap: false })
    expect(pixels[7].x).toBeCloseTo(0, 6)
    expect(pixels[7].y).toBeCloseTo(100, 6)
  })
})

describe('core/geometry/circle', () => {
  function unitCircle(radius = 100) {
    return { type: 'circle', center: { x: 0, y: 0 }, radius, startAngle: 0, direction: 1 }
  }

  it('pitch mode spaces consecutive LEDs within 2% of the strip pitch', () => {
    const geom = unitCircle()
    const pitch = (2 * Math.PI * 100) / 20 // circumference / 20, so 20 LEDs wrap exactly once
    const strip = { ledCount: 20, pitch, spacing: 'pitch' }
    const pts = sample(geom, strip)
    expect(pts.length).toBe(20)
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      expect(Math.abs(d - pitch) / pitch).toBeLessThan(0.02)
    }
  })

  it('pitch mode wraps around instead of extrapolating once LEDs exceed the circumference', () => {
    const geom = unitCircle()
    const circumference = 2 * Math.PI * 100
    const pitch = circumference / 10
    // ledCount of 25 wraps the loop 2.5 times -- every point must still sit on the circle.
    const strip = { ledCount: 25, pitch, spacing: 'pitch' }
    const pts = sample(geom, strip)
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 1)
    }
  })

  it('fit mode places ledCount LEDs evenly around without duplicating the start point', () => {
    const geom = unitCircle()
    const strip = { ledCount: 12, spacing: 'fit' }
    const pts = sample(geom, strip)
    expect(pts.length).toBe(12)
    expect(pts[0].x).toBeCloseTo(100, 6)
    expect(pts[0].y).toBeCloseTo(0, 6)
    // The 12th point must NOT coincide with the first (no duplicated start).
    const last = pts[11]
    expect(Math.hypot(last.x - pts[0].x, last.y - pts[0].y)).toBeGreaterThan(1)
    // Evenly spaced: consecutive points are each ~30deg apart (360/12), within
    // the arc-length table's own sampling resolution (256 samples/turn).
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      const expected = 2 * 100 * Math.sin(Math.PI / 12)
      expect(Math.abs(d - expected) / expected).toBeLessThan(0.01)
    }
  })

  it('exposes center/start handles', () => {
    expect(handles(unitCircle(), {}).map((h) => h.id)).toEqual(['center', 'start'])
  })

  it('moving the start handle changes radius and start angle', () => {
    const geom = unitCircle()
    const patch = moveHandle(geom, 'start', { x: 0, y: 50 }, {})
    expect(patch.geom.radius).toBeCloseTo(50, 6)
    expect(patch.geom.startAngle).toBeCloseTo(90, 1)
  })

  it('rotate/mirror/scaleAbout transform center, angle, and direction as documented', () => {
    const geom = unitCircle()
    const center = { x: 0, y: 0 }

    const rotated = rotate(geom, 90, center)
    expect(rotated.startAngle).toBeCloseTo(90, 1)

    const mirroredH = mirror(geom, 'h', center)
    expect(mirroredH.direction).toBe(-1)

    const scaled = scaleAbout(geom, 2, center)
    expect(scaled.radius).toBe(200)
  })

  it('curveLength() is 2*pi*radius -- matches both the module export and the registry', () => {
    const geom = unitCircle(100)
    expect(circleCurveLength(geom)).toBeCloseTo(2 * Math.PI * 100, 6)
    expect(registryCurveLength(geom)).toBeCloseTo(2 * Math.PI * 100, 6)
  })

  it('newStrip sizes a default circle so its circumference is roughly ledCount*pitch', () => {
    const strip = newStrip('circle', { ledCount: 20, pitch: 10, geom: { center: { x: 0, y: 0 } } })
    expect(circleCurveLength(strip.geom)).toBeCloseTo(200, 4)
  })

  it('layout.computePixels works with a circle strip (closed, no duplicated start)', () => {
    const project = newProject()
    const strip = newStrip('circle', {
      ledCount: 10,
      pitch: 10,
      channel: 1,
      spacing: 'fit',
      geom: { center: { x: 0, y: 0 }, radius: 100, startAngle: 0, direction: 1 }
    })
    strip.start = 1
    project.strips.push(strip)
    const pixels = computePixels(project)
    expect(pixels.length).toBe(10)
    expect(pixels[0]).toMatchObject({ x: 100, y: 0, channel: 1, gap: false })
    // No pixel duplicates pixel 0's coordinate (closed loop, no repeated start).
    for (let i = 1; i < pixels.length; i++) {
      expect(Math.hypot(pixels[i].x - pixels[0].x, pixels[i].y - pixels[0].y)).toBeGreaterThan(1)
    }
  })
})

describe('core/geometry/polygon', () => {
  function triangle(radius = 100) {
    return { type: 'polygon', center: { x: 0, y: 0 }, radius, sides: 3, rotation: 0 }
  }

  it('pitch mode spaces consecutive LEDs within 2% of the strip pitch', () => {
    const geom = triangle()
    const perimeter = 3 * 2 * 100 * Math.sin(Math.PI / 3)
    const pitch = perimeter / 21 // wraps exactly once over 21 LEDs
    const strip = { ledCount: 21, pitch, spacing: 'pitch' }
    const pts = sample(geom, strip)
    expect(pts.length).toBe(21)
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      expect(Math.abs(d - pitch) / pitch).toBeLessThan(0.02)
    }
  })

  it('fit mode places ledCount LEDs evenly along the perimeter without duplicating the start point', () => {
    const geom = triangle()
    const strip = { ledCount: 9, spacing: 'fit' } // 3 per side, exactly
    const pts = sample(geom, strip)
    expect(pts.length).toBe(9)
    const last = pts[8]
    expect(Math.hypot(last.x - pts[0].x, last.y - pts[0].y)).toBeGreaterThan(1)
  })

  it('a square (4 sides) places LEDs along its 4 straight edges, not a circle', () => {
    const geom = { type: 'polygon', center: { x: 0, y: 0 }, radius: 100, sides: 4, rotation: 0 }
    const strip = { ledCount: 8, spacing: 'fit' } // 2 per edge
    const pts = sample(geom, strip)
    // Every sampled point must sit on the square's bounding box edge (|x| or |y| == radius*cos(45)),
    // not at radius distance from the center (which an arc-based sampling would produce instead).
    const vertexDist = 100 // the square's own vertices sit at exactly radius 100
    const onBoxEdge = pts.every((p) => Math.abs(p.x) < vertexDist + 1e-6 && Math.abs(p.y) < vertexDist + 1e-6)
    expect(onBoxEdge).toBe(true)
  })

  it('exposes center/vertex0 handles', () => {
    expect(handles(triangle(), {}).map((h) => h.id)).toEqual(['center', 'vertex0'])
  })

  it('moving the vertex0 handle changes radius and rotation', () => {
    const geom = triangle()
    const patch = moveHandle(geom, 'vertex0', { x: 0, y: 50 }, {})
    expect(patch.geom.radius).toBeCloseTo(50, 6)
    expect(patch.geom.rotation).toBeCloseTo(90, 1)
  })

  it('rotate/mirror/scaleAbout transform center, rotation, and radius as documented', () => {
    const geom = triangle()
    const center = { x: 0, y: 0 }

    const rotated = rotate(geom, 90, center)
    expect(rotated.rotation).toBeCloseTo(90, 1)

    const mirroredH = mirror(geom, 'h', center)
    expect(mirroredH.rotation).toBeCloseTo(180, 1)

    const scaled = scaleAbout(geom, 2, center)
    expect(scaled.radius).toBe(200)
  })

  it('curveLength() is the exact perimeter -- matches both the module export and the registry', () => {
    const geom = triangle(100)
    const expected = 3 * 2 * 100 * Math.sin(Math.PI / 3)
    expect(polygonCurveLength(geom)).toBeCloseTo(expected, 6)
    expect(registryCurveLength(geom)).toBeCloseTo(expected, 6)
  })

  it('newStrip sizes a default polygon so its perimeter is roughly ledCount*pitch', () => {
    const strip = newStrip('polygon', { ledCount: 15, pitch: 10, geom: { center: { x: 0, y: 0 } } })
    expect(polygonCurveLength(strip.geom)).toBeCloseTo(150, 4)
    expect(strip.geom.sides).toBe(3)
  })

  it('layout.computePixels works with a polygon strip (closed, no duplicated start)', () => {
    const project = newProject()
    const strip = newStrip('polygon', {
      ledCount: 9,
      pitch: 10,
      channel: 3,
      spacing: 'fit',
      geom: { center: { x: 0, y: 0 }, radius: 100, sides: 3, rotation: 0 }
    })
    strip.start = 1
    project.strips.push(strip)
    const pixels = computePixels(project)
    expect(pixels.length).toBe(9)
    expect(pixels[0]).toMatchObject({ x: 100, y: 0, channel: 3, gap: false })
    for (let i = 1; i < pixels.length; i++) {
      expect(Math.hypot(pixels[i].x - pixels[0].x, pixels[i].y - pixels[0].y)).toBeGreaterThan(1)
    }
  })
})
