// Project file serialization (shared by "Save project" and autosave) plus
// the IndexedDB-backed autosave manager. All IndexedDB access is wrapped in
// try/catch: if it's unavailable (private browsing, some file:// contexts),
// callers get a clean failure instead of a thrown error, and the app keeps
// working with autosave simply reported as "unavailable".

import { initThrottleState, onChange as throttleOnChange, checkDue } from '../core/throttle.js'

const DB_NAME = 'blazemapper'
const DB_NAME_LEGACY = 'pixelmapper' // read once on startup if the new db has no record yet
const DB_VERSION = 1
const STORE_NAME = 'autosave'
const RECORD_KEY = 'current'
export const AUTOSAVE_INTERVAL_MS = 5000

// --- Serialization -----------------------------------------------------
// `projectData` and `imageSrcData` are plain, structuredClone-friendly
// snapshots (the caller passes $state.snapshot(...) results) -- this module
// never touches Svelte state directly, so it stays usable from a plain test.
//
// The project's own fields (version, strips, ...) stay at the TOP level of
// the serialized record -- this is the same shape core/import.js's
// detectFormat() looks for (an object with a `strips` array) when deciding
// whether pasted/loaded text is a project file, so a downloaded
// .pixelmap.json round-trips straight back in through Import. `savedAt` and
// the reference image's pixel data (`imageData` -- named so it can't collide
// with the project's own `image` field, the layout transform) ride alongside.

export function serializeProject(projectData, imageSrcData) {
  return {
    ...projectData,
    savedAt: Date.now(),
    imageData:
      imageSrcData && imageSrcData.dataUrl
        ? { dataUrl: imageSrcData.dataUrl, naturalW: imageSrcData.naturalW, naturalH: imageSrcData.naturalH, name: imageSrcData.name }
        : null
  }
}

// Returns { project, imageData, savedAt } from a serialized record (same
// shape whether it came from a downloaded .pixelmap.json or an IndexedDB
// record) -- `project` has `savedAt`/`imageData` split back out.
export function deserializeProject(record) {
  const { savedAt, imageData, ...project } = record
  return {
    project,
    imageData: imageData || null,
    savedAt: savedAt || null
  }
}

// --- IndexedDB -----------------------------------------------------------

function openDb(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    let req
    try {
      req = indexedDB.open(name, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
  })
}

function readRecord(dbName) {
  return openDb(dbName).then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
  )
}

// Resolves to the stored record, or null if there is none or IndexedDB isn't
// available/working. If the current ('blazemapper') db has no record yet,
// falls back to a one-time read of the old 'pixelmapper' db (pre-rename) and,
// if that has a record, migrates it into the new db -- the old db is left
// untouched otherwise, never deleted.
export async function readAutosave() {
  let record = null
  try {
    record = await readRecord(DB_NAME)
  } catch (err) {
    return null
  }
  if (record) return record
  try {
    const legacy = await readRecord(DB_NAME_LEGACY)
    if (legacy) {
      await writeAutosave(legacy)
      return legacy
    }
  } catch (err) {
    // No legacy db, or it failed to open -- nothing to migrate.
  }
  return null
}

// Resolves to true on success, false if IndexedDB is unavailable or the
// write failed for any reason -- callers use this to flip to "unavailable".
export async function writeAutosave(record) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record, RECORD_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch (err) {
    return false
  }
}

export async function clearAutosave() {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(RECORD_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    // Nothing to clean up if IndexedDB never worked in the first place.
  }
}

// --- Autosave manager ------------------------------------------------------
// Wraps the pure throttle state machine (core/throttle.js) with a real timer
// and IndexedDB writes. markDirty() is called on every history commit (see
// project.svelte.js); getSnapshot() must return the current serializeProject()
// result. onStatus(status) reports { kind: 'dirty' | 'saved' | 'unavailable',
// savedAt? } for the export drawer header.

export function createAutosaveManager({ getSnapshot, onStatus, intervalMs = AUTOSAVE_INTERVAL_MS, now = () => Date.now() }) {
  let throttleState = initThrottleState()
  let timer = null
  let unavailable = false

  async function doSave() {
    const record = getSnapshot()
    const ok = await writeAutosave(record)
    if (!ok) {
      unavailable = true
      onStatus({ kind: 'unavailable' })
      return
    }
    onStatus({ kind: 'saved', savedAt: record.savedAt ?? now() })
  }

  function scheduleTimer(dueAt) {
    if (timer) clearTimeout(timer)
    const delay = Math.max(0, dueAt - now())
    timer = setTimeout(() => {
      const t = now()
      const result = checkDue(throttleState, t)
      throttleState = result.state
      if (result.action === 'save') doSave()
    }, delay)
  }

  function markDirty() {
    if (unavailable) return
    onStatus({ kind: 'dirty' })
    const t = now()
    const result = throttleOnChange(throttleState, t, intervalMs)
    throttleState = result.state
    if (result.action === 'save') {
      doSave()
    } else {
      scheduleTimer(throttleState.dueAt)
    }
  }

  function dispose() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  return { markDirty, dispose }
}
