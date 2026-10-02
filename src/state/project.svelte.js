// Single project store (Svelte 5 runes) plus named action functions.
// No undo/redo yet (phase 4). Keep all mutation behind these actions so
// history.js can later wrap them without canvas/panel code changing.

import { newProject, newStrip } from '../core/model.js'
import { translate as geomTranslate, moveHandle as geomMoveHandle, scale as geomScale } from '../core/geometry/index.js'
import { convert, GRID_DEFAULTS } from '../core/units.js'

export const project = $state(newProject())

export const selection = $state({ stripId: null })

export function addStrip(geomType = 'line', opts = {}) {
  const strip = newStrip(geomType, opts)
  project.strips.push(strip)
  selection.stripId = strip.id
  return strip
}

export function updateStrip(id, patch) {
  const strip = project.strips.find((s) => s.id === id)
  if (!strip) return
  Object.assign(strip, patch)
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
  project.grid.size = GRID_DEFAULTS[units]
  project.units = units
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

export function setGrid(patch) {
  Object.assign(project.grid, patch)
}
