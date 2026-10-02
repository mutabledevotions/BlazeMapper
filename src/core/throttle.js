// Pure trailing-throttle decision logic for autosave. No timers, no clock
// access, no DOM -- the caller supplies `now` (ms) explicitly, which makes
// this trivial to unit test with made-up timestamps instead of real waits.
//
// Behaviour (autosave, every committed change marks the project dirty):
// the first change after a quiet period of `intervalMs` saves immediately;
// any further changes before the next save is due just update `dueAt` (a
// no-op after the first), folding into one trailing save at that time.
//
// state: { lastSavedAt: number (ms; -Infinity if never saved),
//          dueAt: number | null (ms timestamp of a pending trailing save) }

export function initThrottleState() {
  return { lastSavedAt: -Infinity, dueAt: null }
}

// Call on every change (e.g. every history commit). Returns { state, action }
// where action is 'save' (save right now, at `now`) or 'wait' (nothing to do
// yet -- state.dueAt says when the trailing save should fire).
export function onChange(state, now, intervalMs) {
  if (now - state.lastSavedAt >= intervalMs) {
    return { state: { lastSavedAt: now, dueAt: null }, action: 'save' }
  }
  const dueAt = state.dueAt ?? state.lastSavedAt + intervalMs
  return { state: { ...state, dueAt }, action: 'wait' }
}

// Call when a previously scheduled trailing save's timer fires (or on any
// periodic check). Returns { state, action }; action is 'save' only if a
// trailing save was actually due by `now`.
export function checkDue(state, now) {
  if (state.dueAt !== null && now >= state.dueAt) {
    return { state: { lastSavedAt: now, dueAt: null }, action: 'save' }
  }
  return { state, action: 'wait' }
}
