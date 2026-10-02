// Shared localStorage helpers for the small bits of UI-only state that live
// there (sidebar split position, remembered "Add strips" form values). Every
// key uses the `bm.` prefix; readMigrated() falls back to an old `pm.`-prefixed
// key once (BlazeMapper was renamed from PixelMapper), copies it forward under
// the new key, and leaves the old key alone from then on. All access is
// wrapped in try/catch since localStorage can be unavailable (private
// browsing, some file:// contexts).

export function readRaw(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Persistence is a convenience here, not a requirement.
  }
}

// Reads `key`; if absent, reads `oldKey` once and migrates it forward under
// `key` (without deleting `oldKey`). Returns the raw string, or null.
export function readMigrated(key, oldKey) {
  const current = readRaw(key)
  if (current !== null) return current
  const legacy = readRaw(oldKey)
  if (legacy !== null) writeRaw(key, legacy)
  return legacy
}
