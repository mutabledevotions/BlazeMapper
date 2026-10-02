// Explicit LED addressing (phase 3b). Pure functions, no DOM/Svelte imports.
//
// Every strip/pixel item gets a 1-based `start` address within its Output
// Expander channel, claiming [start, start + ledCount - 1]. Addresses are
// LED-level (not byte-level): Pixelblaze and the Output Expander both address
// per LED, and the 240 RGB / 180 RGBW per-channel limit is really a byte
// budget (720 bytes) that the UI surfaces as a secondary "bytes" readout.
//
// Editing rule ("insert and push"): setting an item's start to S claims
// [S, S+n). Any other item in the same channel that now overlaps gets pushed
// to start right after the end of whatever displaced it, cascading forward.
// Gaps that aren't touched by an overlap are left alone. Locked items are
// immovable: a push that would land on a locked item instead jumps past its
// end, so the locked item's own address never changes.

// Number of LEDs an item occupies: the points list length for points geometry
// (pixels and imported maps), otherwise the strip's own ledCount field.
export function ledCount(item) {
  if (item.geom && item.geom.type === 'points') return item.geom.pts.length
  return Math.max(0, item.ledCount | 0)
}

// Last address claimed by an item (inclusive). Address-less items (start
// undefined -- not yet migrated) are treated as claiming nothing.
export function endAddress(item) {
  if (typeof item.start !== 'number') return 0
  return item.start + ledCount(item) - 1
}

// Highest address claimed by any item in the given (single-channel) list, or
// 0 if the list is empty / nothing has an address yet. Used to append a new
// item right after a channel's current last address.
export function lastAddress(items) {
  let max = 0
  for (const it of items) {
    const e = endAddress(it)
    if (e > max) max = e
  }
  return max
}

// Packs a list of items (all the same channel, in the given order) into
// sequential addresses starting at 1 with no gaps. Used for first-time
// migration of a channel where nothing has a `start` yet; everyday edits go
// through setStart, which preserves gaps on purpose. Returns new objects
// (does not mutate the input).
export function packChannel(items) {
  let cursor = 1
  return items.map((it) => {
    const start = cursor
    cursor += ledCount(it)
    return { ...it, start }
  })
}

// Advances `addr` past any locked range it falls inside (repeating, in case
// ranges are adjacent), so a pushed item never lands on top of a locked one.
function skipLocked(addr, lockedRanges) {
  let changed = true
  while (changed) {
    changed = false
    for (const r of lockedRanges) {
      if (addr >= r.start && addr <= r.end) {
        addr = r.end + 1
        changed = true
      }
    }
  }
  return addr
}

// Core insert-and-push rule. items: the full project.strips-like array
// (every channel). id: the item being moved. S: its new start address.
// Returns a NEW array (items are shallow-cloned where changed) with:
//   - the target item's start set to S (clamped to >= 1),
//   - every overlapping peer in the same channel pushed forward, cascading,
//     with gaps that aren't part of an overlap left untouched,
//   - locked peers left in place (a push that would land on one jumps past
//     its end instead),
//   - the moved item's channel's items reordered (within their own array
//     slots) so list order matches ascending start again.
// No-ops (returns items unchanged) if the target item is itself locked --
// locked items are immovable, including by their own address field. (A caller
// re-running the cascade after a ledCount change passes the item's own
// unchanged start -- that's allowed even when locked, since the locked item
// itself doesn't move; only its now-larger footprint may push its neighbors.)
export function setStart(items, id, S) {
  const target = items.find((it) => it.id === id)
  if (!target) return items
  const chan = target.channel
  const clampedS = Math.max(1, Math.round(S))
  if (target.locked && clampedS !== target.start) return items
  const n = ledCount(target)

  const peers = items.filter((it) => it.channel === chan && it.id !== id)
  const lockedRanges = peers.filter((it) => it.locked).map((it) => ({ start: it.start, end: endAddress(it) }))

  const movedStart = skipLocked(clampedS, lockedRanges)
  const nextTarget = { ...target, start: movedStart }
  const movedEnd = movedStart + n - 1

  // Sort peers by their current start ascending (stable tiebreak: original
  // array order) so the forward sweep below sees them in address order.
  const orderedPeers = peers
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => (a.it.start || 0) - (b.it.start || 0) || a.idx - b.idx)
    .map((e) => e.it)

  let frontier = movedEnd
  const resolved = new Map() // id -> possibly-updated peer object
  for (const peer of orderedPeers) {
    const peerEnd = endAddress(peer)
    // Entirely before the moved item's new range: untouched, and doesn't
    // extend the cascade frontier (it isn't part of the overlap chain).
    if (peerEnd < movedStart) {
      resolved.set(peer.id, peer)
      continue
    }
    if (peer.locked) {
      // Immovable -- occupies its own address regardless; later pushes jump
      // past its end instead of landing on it.
      frontier = Math.max(frontier, peerEnd)
      resolved.set(peer.id, peer)
      continue
    }
    const len = ledCount(peer)
    let start = peer.start
    if (peer.start <= frontier) {
      start = skipLocked(frontier + 1, lockedRanges)
    }
    const next = start === peer.start ? peer : { ...peer, start }
    frontier = Math.max(frontier, start + len - 1)
    resolved.set(peer.id, next)
  }

  const result = items.map((it) => {
    if (it.id === id) return nextTarget
    if (resolved.has(it.id)) return resolved.get(it.id)
    return it
  })

  return reorderChannelSlots(result, chan)
}

// Re-sorts the items belonging to `channel` into ascending-start order,
// without moving any other channel's items out of their array slots --
// list order within a channel is derived from address, but the array isn't
// re-grouped by channel (other code sorts by channel explicitly, e.g. layout.js).
export function reorderChannelSlots(items, channel) {
  const indices = []
  items.forEach((it, i) => {
    if (it.channel === channel) indices.push(i)
  })
  if (indices.length < 2) return items
  const sorted = indices.map((i) => items[i]).sort((a, b) => (a.start || 0) - (b.start || 0))
  const result = items.slice()
  indices.forEach((slotIdx, k) => {
    result[slotIdx] = sorted[k]
  })
  return result
}

// Migration: assigns `start` to any item missing one, per channel, packing
// each unaddressed item right after its channel's current last address
// (which may itself be mid-migration -- items that already have a start are
// left exactly where they are). Returns a new array; safe to call on an
// already-fully-addressed project (no-op passthrough of existing starts).
export function ensureAddresses(items) {
  const cursors = new Map() // channel -> highest address assigned so far
  let changed = false
  const result = items.map((it) => {
    const cur = cursors.get(it.channel) ?? 0
    if (typeof it.start === 'number') {
      cursors.set(it.channel, Math.max(cur, endAddress(it)))
      return it
    }
    changed = true
    const start = cur + 1
    cursors.set(it.channel, start + ledCount(it) - 1)
    return { ...it, start }
  })
  return changed ? result : items
}

// Bytes-per-LED for a color type -- the secondary "byte address" readout
// (DMX-style), derived from LED address: (start-1)*bpp+1 .. end*bpp.
export function bytesPerLed(colorType) {
  return colorType === 'RGBW' ? 4 : 3
}

export function byteRange(item) {
  const bpp = bytesPerLed(item.colorType)
  const start = (item.start - 1) * bpp + 1
  const end = endAddress(item) * bpp
  return { start, end }
}
