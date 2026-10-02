// Undo/redo: stacks of plain-object snapshots (cap 100 each). This file has
// no dependency on project.svelte.js or Svelte runes -- it's wired to the
// store once, via initHistory({ getSnapshot, restoreSnapshot, onChange }),
// which keeps the module graph one-directional (project.svelte.js imports
// this file, not the other way around) and this file trivially pure to read.
//
// Commit points (see project.svelte.js and Canvas.svelte/Handles.svelte):
//   - commit() at the end of each discrete store action (add/remove/edit/etc).
//   - beginDrag() at pointerdown, commitDrag() at pointerup -- one snapshot
//     per drag gesture, not one per pointermove, and only pushed if the
//     gesture actually changed something.

const CAP = 100

let undoStack = []
let redoStack = []
let dragBefore = null

// The snapshot as of the end of the most recent commit/commitDrag/undo/redo
// (or the pristine initial state, set by initHistory()). Since actions run
// synchronously and only ever mutate the project inside an action function,
// this is exactly "the state right before whichever action is about to call
// commit() next" -- which is what commit() needs to push as the undo point,
// even though it's only called at the END of that action (after the mutation
// already happened).
let lastSnapshot = null

let getSnapshot = () => ({})
let restoreSnapshot = () => {}
let onChange = () => {}

export function initHistory(hooks) {
  getSnapshot = hooks.getSnapshot
  restoreSnapshot = hooks.restoreSnapshot
  onChange = hooks.onChange || (() => {})
  lastSnapshot = getSnapshot()
}

export function commit() {
  const before = lastSnapshot ?? getSnapshot()
  const after = getSnapshot()
  undoStack.push(before)
  if (undoStack.length > CAP) undoStack.shift()
  redoStack = []
  lastSnapshot = after
  onChange()
}

// Drag gestures: call at pointerdown (captures the "before" snapshot directly,
// unlike commit() above) and at pointerup (pushes it only if something
// actually changed). Safe to call commitDrag() unconditionally even if
// beginDrag() was never called for this gesture (e.g. a plain pan or
// marquee) -- it's a no-op then.
export function beginDrag() {
  dragBefore = getSnapshot()
}

export function commitDrag() {
  if (dragBefore === null) return
  const before = dragBefore
  dragBefore = null
  const after = getSnapshot()
  if (JSON.stringify(before) === JSON.stringify(after)) return
  undoStack.push(before)
  if (undoStack.length > CAP) undoStack.shift()
  redoStack = []
  lastSnapshot = after
  onChange()
}

export function cancelDrag() {
  dragBefore = null
}

export function canUndo() {
  return undoStack.length > 0
}

export function canRedo() {
  return redoStack.length > 0
}

export function undo() {
  if (!undoStack.length) return
  const current = lastSnapshot ?? getSnapshot()
  const prev = undoStack.pop()
  redoStack.push(current)
  if (redoStack.length > CAP) redoStack.shift()
  restoreSnapshot(prev)
  lastSnapshot = prev
  onChange()
}

export function redo() {
  if (!redoStack.length) return
  const current = lastSnapshot ?? getSnapshot()
  const next = redoStack.pop()
  undoStack.push(current)
  if (undoStack.length > CAP) undoStack.shift()
  restoreSnapshot(next)
  lastSnapshot = next
  onChange()
}

// Test-only: clears the stacks and re-syncs lastSnapshot to whatever the test
// just set the project to directly (bypassing commit()), so the next commit()
// call in that test computes the right "before" state.
export function resetHistory() {
  undoStack = []
  redoStack = []
  dragBefore = null
  lastSnapshot = getSnapshot()
}
