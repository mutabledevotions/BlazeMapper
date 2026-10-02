// Single project store (Svelte 5 runes) plus named action functions.
// No undo/redo yet (phase 4). Keep all mutation behind these actions so
// history.js can later wrap them without canvas/panel code changing.

import { newProject, newStrip } from '../core/model.js'
import { translate as geomTranslate, moveHandle as geomMoveHandle } from '../core/geometry/index.js'

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
  strip.geom = geomMoveHandle(strip.geom, handleId, pt, opts)
}

export function translateStrip(id, dx, dy) {
  const strip = project.strips.find((s) => s.id === id)
  if (!strip || strip.locked) return
  strip.geom = geomTranslate(strip.geom, dx, dy)
}

export function setUnits(units) {
  project.units = units
}

export function setGrid(patch) {
  Object.assign(project.grid, patch)
}
