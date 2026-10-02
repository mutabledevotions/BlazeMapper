// Single project store (Svelte 5 runes) plus named action functions.
// No undo/redo yet (phase 4). Keep all mutation behind these actions so
// history.js can later wrap them without canvas/panel code changing.

import { newProject, newStrip } from '../core/model.js'
import {
  translate as geomTranslate,
  moveHandle as geomMoveHandle,
  scale as geomScale,
  sample as geomSample
} from '../core/geometry/index.js'
import { convert, GRID_DEFAULTS } from '../core/units.js'

export const project = $state(newProject())

export const selection = $state({ stripId: null })

// Current view centre in world units, kept up to date by Canvas.svelte on every
// pan/zoom. "Add strip"/"Add pixels" place new geometry here instead of the origin.
export const view = $state({ x: 0, y: 0 })

export function setView(x, y) {
  view.x = x
  view.y = y
}

export function addStrip(geomType = 'line', opts = {}) {
  const strip = newStrip(geomType, opts)
  project.strips.push(strip)
  selection.stripId = strip.id
  return strip
}

// Batch placement for AddStripsDialog. opts:
//   count, ledCount, pitch, colorType, z, startChannel, channelMode: 'perStrip' | 'allOne'
//   placement: 'rows' | 'matrix' | 'stacked', rowSpacing, serpentine, offset
export function addStrips(opts) {
  const count = Math.max(1, opts.count | 0)
  const ledCount = Math.max(1, opts.ledCount | 0)
  const pitch = opts.pitch > 0 ? opts.pitch : 1
  const created = []
  const cx = view.x
  const cy = view.y
  const rowSpacing = opts.rowSpacing > 0 ? opts.rowSpacing : pitch * 3
  const offset = opts.offset > 0 ? opts.offset : pitch

  for (let i = 0; i < count; i++) {
    let p0
    if (opts.placement === 'stacked') {
      p0 = { x: cx + i * offset, y: cy + i * offset }
    } else {
      // rows and matrix share layout: N parallel rows, serpentine optional.
      const totalH = (count - 1) * rowSpacing
      const rowLen = (ledCount - 1) * pitch
      p0 = { x: cx - rowLen / 2, y: cy - totalH / 2 + i * rowSpacing }
    }
    const reversed = Boolean(opts.serpentine) && opts.placement !== 'stacked' && i % 2 === 1
    const channel = opts.channelMode === 'allOne' ? opts.startChannel ?? 0 : (opts.startChannel ?? 0) + i

    const strip = newStrip('line', {
      ledCount,
      pitch,
      colorType: opts.colorType || 'RGB',
      z: opts.z ?? 0,
      channel,
      reversed,
      geom: { p0, angle: 0 }
    })
    project.strips.push(strip)
    created.push(strip)
  }

  if (created.length) selection.stripId = created[created.length - 1].id
  return created
}

// "Add pixels": one points strip, N pixels in a row at the view centre.
export function addPixelsStrip(count, spacing) {
  const n = Math.max(1, count | 0)
  const step = spacing > 0 ? spacing : project.grid.size
  const startX = view.x - ((n - 1) * step) / 2
  const pts = []
  for (let i = 0; i < n; i++) pts.push({ x: startX + i * step, y: view.y })

  const strip = newStrip('points', { pitch: step, geom: { pts } })
  project.strips.push(strip)
  selection.stripId = strip.id
  return strip
}

export function updateStrip(id, patch) {
  const strip = project.strips.find((s) => s.id === id)
  if (!strip) return
  Object.assign(strip, patch)
}

// Switches a line strip's spacing mode. Entering 'fit' seeds p1 at the strip's
// current last-LED position so the visible length doesn't jump.
export function setSpacing(id, mode) {
  const strip = project.strips.find((s) => s.id === id)
  if (!strip || strip.locked) return
  if (mode === 'fit' && strip.spacing !== 'fit') {
    const pts = geomSample(strip.geom, strip)
    const last = pts[pts.length - 1] || strip.geom.p0
    strip.geom = { ...strip.geom, p1: { x: last.x, y: last.y } }
  }
  strip.spacing = mode
}

export function removeStrip(id) {
  const i = project.strips.findIndex((s) => s.id === id)
  if (i === -1) return
  project.strips.splice(i, 1)
  if (selection.stripId === id) selection.stripId = null
}

export function selectStrip(id) {
  selection.stripId = id
}

export function moveHandle(id, handleId, pt, opts = {}) {
  const strip = project.strips.find((s) => s.id === id)
  if (!strip || strip.locked) return
  Object.assign(strip, geomMoveHandle(strip.geom, handleId, pt, opts, strip))
}

export function translateStrip(id, dx, dy) {
  const strip = project.strips.find((s) => s.id === id)
  if (!strip || strip.locked) return
  strip.geom = geomTranslate(strip.geom, dx, dy)
}

// Reorders project.strips (the array order used for export). targetIndex is an
// index into the array *after* removal of `id`. Passing `channel` also moves the
// strip into that channel (drag across channel groups in the strip list).
export function reorderStrip(id, targetIndex, channel) {
  const i = project.strips.findIndex((s) => s.id === id)
  if (i === -1) return
  const [strip] = project.strips.splice(i, 1)
  if (channel !== undefined) strip.channel = channel
  const clamped = Math.max(0, Math.min(targetIndex, project.strips.length))
  project.strips.splice(clamped, 0, strip)
}

// Converts every length in the project so the physical layout is unchanged.
// Grid resets to a sensible step for the new unit rather than e.g. 0.3937 in.
export function setUnits(units) {
  const from = project.units
  if (from === units) return
  const k = convert(1, from, units)
  for (const strip of project.strips) {
    strip.geom = geomScale(strip.geom, k)
    strip.pitch = round3(strip.pitch * k)
  }
  project.canvas.w = round3(project.canvas.w * k)
  project.canvas.h = round3(project.canvas.h * k)
  project.grid.size = GRID_DEFAULTS[units]
  project.units = units
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

export function setGrid(patch) {
  Object.assign(project.grid, patch)
}

export function toggleSnap() {
  project.grid.snap = !project.grid.snap
}

export function setCanvasSize(patch) {
  Object.assign(project.canvas, patch)
}
