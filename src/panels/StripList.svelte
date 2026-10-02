<script>
  // Strips grouped by channel (channel header rows), like Illustrator layers.
  // List order within a channel = ascending address (core/address.js's `start`),
  // not raw array order -- project.strips itself is kept in sync with this
  // (see address.js's reorderChannelSlots) so existing array-order-based code
  // keeps working, but this panel displays and drags by address directly.
  // Drag-and-drop computes the drop point's address (previous item's end + 1,
  // or 1 at the channel's start) and hands it to moveStripToAddress, which
  // applies the insert-and-push rule (core/address.js's setStart).
  import { project, selection, selectStrip, selectStrips, toggleSelect, removeStrip, updateStrip, moveStripToAddress } from '../state/project.svelte.js'
  import { endAddress } from '../core/address.js'

  // Channels in ascending order, each with its strips sorted by address.
  const groups = $derived.by(() => {
    const map = new Map()
    for (const strip of project.strips) {
      if (!map.has(strip.channel)) map.set(strip.channel, [])
      map.get(strip.channel).push(strip)
    }
    for (const strips of map.values()) strips.sort((a, b) => (a.start || 0) - (b.start || 0))
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  })

  // Flat displayed order (channel-grouped), used by Shift-click range select.
  const displayOrder = $derived(groups.flatMap(([, strips]) => strips.map((s) => s.id)))

  // Interleaves gap separator rows between items whose addresses aren't
  // contiguous (and before the first item, if its address isn't 1).
  function withGaps(strips) {
    const rows = []
    let cursor = 1
    for (const s of strips) {
      const start = s.start || cursor
      if (start > cursor) rows.push({ kind: 'gap', from: cursor, to: start - 1 })
      rows.push({ kind: 'item', strip: s })
      cursor = endAddress(s) + 1
    }
    return rows
  }

  // Range-select anchor: the last row clicked plainly or Ctrl/Cmd-toggled.
  let anchorId = $state(null)

  let dragId = $state(null)

  function onDragStart(evt, id) {
    dragId = id
    evt.dataTransfer.effectAllowed = 'move'
    evt.dataTransfer.setData('text/plain', id)
  }

  function onDragEnd() {
    dragId = null
  }

  function onRowDragOver(evt) {
    evt.preventDefault()
    evt.dataTransfer.dropEffect = 'move'
  }

  // Every item in `channel` except `excludeId`, sorted by address.
  function channelSortedExcluding(channel, excludeId) {
    return project.strips.filter((s) => s.channel === channel && s.id !== excludeId).sort((a, b) => (a.start || 0) - (b.start || 0))
  }

  function onRowDrop(evt, targetStrip, after) {
    evt.preventDefault()
    const id = evt.dataTransfer.getData('text/plain') || dragId
    if (!id || id === targetStrip.id) return
    const items = channelSortedExcluding(targetStrip.channel, id)
    const idx = items.findIndex((s) => s.id === targetStrip.id)
    const afterId = after ? targetStrip.id : idx > 0 ? items[idx - 1].id : null
    moveStripToAddress(id, targetStrip.channel, afterId)
  }

  function onGroupDrop(evt, channel) {
    evt.preventDefault()
    const id = evt.dataTransfer.getData('text/plain') || dragId
    if (!id) return
    const items = channelSortedExcluding(channel, id)
    const afterId = items.length ? items[items.length - 1].id : null
    moveStripToAddress(id, channel, afterId)
  }

  function toggle(strip, field) {
    updateStrip(strip.id, { [field]: !strip[field] })
  }

  // "12-21" address range, or just "12" for a single-LED item (a pixel).
  function addressLabel(strip) {
    const end = endAddress(strip)
    return strip.start === end ? `${strip.start}` : `${strip.start}-${end}`
  }

  // Plain click: select this row and set it as the range anchor.
  // Ctrl/Cmd-click: toggle this row into or out of the selection and move the
  // anchor here. Shift-click: select the range from the anchor to this row, in
  // displayed (channel-grouped) order.
  function onRowClick(strip, evt) {
    if (evt.shiftKey && anchorId) {
      const a = displayOrder.indexOf(anchorId)
      const b = displayOrder.indexOf(strip.id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        selectStrips(displayOrder.slice(lo, hi + 1))
        return
      }
    }
    if (evt.ctrlKey || evt.metaKey) {
      toggleSelect(strip.id)
      anchorId = strip.id
      return
    }
    selectStrip(strip.id)
    anchorId = strip.id
  }
</script>

<div class="strip-list">
  <h3>Strips</h3>
  {#if project.strips.length === 0}
    <p class="empty">No strips yet. Use "Add strip" or "Add pixels" above.</p>
  {/if}
  {#each groups as [channel, strips] (channel)}
    <div class="channel-group" role="list" ondragover={onRowDragOver} ondrop={(evt) => onGroupDrop(evt, channel)}>
      <div class="channel-header">Channel {channel}</div>
      <ul>
        {#each withGaps(strips) as row (row.kind === 'item' ? row.strip.id : `gap-${row.from}`)}
        {#if row.kind === 'gap'}
          <li class="gap-row" aria-hidden="true">
            <span class="gap-label">gap {row.from}{row.to > row.from ? `-${row.to}` : ''} ({row.to - row.from + 1})</span>
          </li>
        {:else}
          {@const strip = row.strip}
          <li
            class:selected={selection.ids.includes(strip.id)}
            class:dragging={dragId === strip.id}
            draggable="true"
            ondragstart={(evt) => onDragStart(evt, strip.id)}
            ondragend={onDragEnd}
            ondragover={onRowDragOver}
            ondrop={(evt) => onRowDrop(evt, strip, false)}
          >
            <button class="icon-btn" title={strip.hidden ? 'Show' : 'Hide'} onclick={() => toggle(strip, 'hidden')}>
              {#if strip.hidden}
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path d="M1 8c2-3.5 5-5 7-5s5 1.5 7 5c-2 3.5-5 5-7 5s-5-1.5-7-5z" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4" />
                  <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.2" />
                </svg>
              {:else}
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path d="M1 8c2-3.5 5-5 7-5s5 1.5 7 5c-2 3.5-5 5-7 5s-5-1.5-7-5z" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <circle cx="8" cy="8" r="2" fill="currentColor" />
                </svg>
              {/if}
            </button>
            <button class="icon-btn" title={strip.locked ? 'Unlock' : 'Lock'} onclick={() => toggle(strip, 'locked')}>
              {#if strip.locked}
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <rect x="3" y="7" width="10" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.2" />
                </svg>
              {:else}
                <svg viewBox="0 0 16 16" width="14" height="14" opacity="0.5">
                  <rect x="3" y="7" width="10" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <path d="M5 7V5a3 3 0 0 1 5.8-1.1" fill="none" stroke="currentColor" stroke-width="1.2" />
                </svg>
              {/if}
            </button>
            <button class="row" onclick={(evt) => onRowClick(strip, evt)}>
              <span class="swatch" style:background={strip.color}></span>
              <span class="name">{strip.name}</span>
              <span class="meta">{addressLabel(strip)}</span>
            </button>
            <button class="del" title="Delete" onclick={() => removeStrip(strip.id)}>&times;</button>
          </li>
        {/if}
        {/each}
      </ul>
    </div>
  {/each}
</div>

<style>
  .strip-list {
    padding: 0.75rem;
    overflow-y: auto;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .empty {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .channel-group {
    margin-bottom: 0.5rem;
  }
  .channel-header {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    padding: 0.2rem 0.3rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li {
    display: flex;
    align-items: stretch;
    border-radius: 4px;
    overflow: hidden;
  }
  li.selected {
    background: var(--accent-dim);
  }
  li.dragging {
    opacity: 0.4;
  }
  .icon-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 0 0.2rem;
  }
  .icon-btn:hover {
    color: var(--fg);
  }
  .row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: inherit;
    padding: 0.35rem 0.4rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    min-width: 0;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    color: var(--muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  .gap-row {
    display: flex;
    align-items: center;
    padding: 0.1rem 0.4rem;
  }
  .gap-label {
    color: var(--muted);
    font-size: 0.68rem;
    font-style: italic;
    opacity: 0.6;
  }
  .del {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 0 0.5rem;
    font-size: 1rem;
  }
  .del:hover {
    color: #ff6b6b;
  }
</style>
