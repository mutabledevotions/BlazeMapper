// Single project store (Svelte 5 runes) plus named action functions.
// No undo/redo yet (phase 4). Keep all mutation behind these actions so
// history.js can later wrap them without canvas/panel code changing.

import { newProject, newStrip, gridStep } from '../core/model.js'
import {
  translate as geomTranslate,
  moveHandle as geomMoveHandle,
  scale as geomScale,
  rotate as geomRotate,
  sample as geomSample
} from '../core/geometry/index.js'
import { convert } from '../core/units.js'

export const project = $state(newProject())

// Multi-select: ids is the full selected set, primary is the one Strip properties
// edits (and the one Handles are drawn for, when ids.length === 1).
export const selection = $state({ ids: [], primary: null })

// Current view centre in world units, kept up to date by Canvas.svelte on every
// pan/zoom. "Add strip"/"Add pixels" place new geometry here instead of the origin.
export const view = $state({ x: 0, y: 0 })

export function setView(x, y) {
  view.x = x
  view.y = y
}

// Live modifier-key state, set by a single window listener (App.svelte) and read
// anywhere that needs to show effective-state feedback (Snap button, drag badges,
// cursor, the hotkey hint line). Cleared on window blur so a key doesn't get
// stuck "held" after an Alt-Tab or devtools focus steal.
export const keys = $state({ alt: false, shift: false, meta: false, ctrl: false, space: false })

export function setKeyState(patch) {
  Object.assign(keys, patch)
}

export function clearKeys() {
  keys.alt = false
  keys.shift = false
  keys.meta = false
  keys.ctrl = false
  keys.space = false
}

// Transient UI context other components need to read without prop-drilling:
// dragMode drives the toolbar's hotkey hint line, typing hides it.
export const ui = $state({ dragMode: null, typing: false })

export function setDragMode(mode) {
  ui.dragMode = mode
}

export function setTyping(v) {
  ui.typing = v
}

// Group-resize "Lock pitch" toggle (default on). Not part of the project model --
// it's a tool preference, not saved layout data.
export const toolState = $state({ lockPitch: true })

export function setLockPitch(v) {
  toolState.lockPitch = v
}

export function addStrip(geomType = 'line', opts = {}) {
  const strip = newStrip(geomType, opts)
  project.strips.push(strip)
  selectStrip(strip.id)
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

  if (created.length) selectStrips(created.map((s) => s.id))
  return created
}

// "Add pixels": one points strip, N pixels in a row at the view centre.
export function addPixelsStrip(count, spacing) {
  const n = Math.max(1, count | 0)
  const step = spacing > 0 ? spacing : gridStep(project)
  const startX = view.x - ((n - 1) * step) / 2
  const pts = []
  for (let i = 0; i < n; i++) pts.push({ x: startX + i * step, y: view.y })

  const strip = newStrip('points', { pitch: step, geom: { pts } })
  project.strips.push(strip)
  selectStrip(strip.id)
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
  deselect(id)
}

// --- Selection -------------------------------------------------------------
// selection = { ids: [], primary }. primary drives Strip properties and, when
// it's the only selected strip, the single-strip Handles; ids drives every
// highlight and the group bbox / rotate handle.

export function selectStrip(id) {
  if (id === null || id === undefined) {
    clearSelection()
    return
  }
  selection.ids = [id]
  selection.primary = id
}

// Replaces (or, additive, merges into) the selection -- used by the canvas
// marquee and by "Add strip(s)"/"Add pixels" selecting what they just created.
export function selectStrips(ids, additive = false) {
  if (!additive) {
    selection.ids = [...ids]
    selection.primary = ids.length ? ids[ids.length - 1] : null
    return
  }
  const set = new Set(selection.ids)
  for (const id of ids) set.add(id)
  selection.ids = [...set]
  if (ids.length) selection.primary = ids[ids.length - 1]
}

// Shift/Cmd-click: adds id if absent, removes it if present.
export function toggleSelect(id) {
  const set = new Set(selection.ids)
  if (set.has(id)) {
    set.delete(id)
    selection.ids = [...set]
    if (selection.primary === id) selection.primary = selection.ids[selection.ids.length - 1] ?? null
  } else {
    set.add(id)
    selection.ids = [...set]
    selection.primary = id
  }
}

export function clearSelection() {
  selection.ids = []
  selection.primary = null
}

function deselect(id) {
  if (!selection.ids.includes(id)) return
  selection.ids = selection.ids.filter((x) => x !== id)
  if (selection.primary === id) selection.primary = selection.ids[selection.ids.length - 1] ?? null
}

// Delete/Backspace: removes every currently selected strip.
export function removeSelected() {
  for (const id of selection.ids) {
    const i = project.strips.findIndex((s) => s.id === id)
    if (i !== -1) project.strips.splice(i, 1)
  }
  clearSelection()
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

// Group drag: translates every given (already-filtered-to-unlocked) strip by
// the same delta in one call, so the canvas doesn't need a per-strip loop.
export function translateStrips(ids, dx, dy) {
  for (const id of ids) translateStrip(id, dx, dy)
}

// Group rotate handle: rotates every selected, unlocked strip about `center`.
// Locked strips are skipped rather than blocking the whole gesture.
export function rotateSelected(deg, center) {
  for (const id of selection.ids) {
    const strip = project.strips.find((s) => s.id === id)
    if (!strip || strip.locked) continue
    strip.geom = geomRotate(strip.geom, deg, center)
  }
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
// Grid is divisions-based (no unit of its own), so only the world box, strip
// geometry, and pitch need rescaling.
export function setUnits(units) {
  const from = project.units
  if (from === units) return
  const k = convert(1, from, units)
  for (const strip of project.strips) {
    strip.geom = geomScale(strip.geom, k)
    strip.pitch = round3(strip.pitch * k)
  }
  project.world.x = round3(project.world.x * k)
  project.world.y = round3(project.world.y * k)
  project.world.size = round3(project.world.size * k)
  project.units = units
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

export function setExport(patch) {
  Object.assign(project.export, patch)
}

export function setGrid(patch) {
  Object.assign(project.grid, patch)
}

export function toggleSnap() {
  project.grid.snap = !project.grid.snap
}

// World box: strips never move when the box moves or resizes.
export function setWorld(patch) {
  Object.assign(project.world, patch)
}

export function moveWorldOrigin(dx, dy) {
  project.world.x += dx
  project.world.y += dy
}

// Bottom-right corner handle: resizes with the top-left (x, y) fixed.
export function resizeWorld(size) {
  project.world.size = Math.max(1e-6, size)
}
