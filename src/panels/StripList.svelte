<script>
  // Strips grouped by channel (channel header rows), like Illustrator layers.
  // Drag-and-drop reorders within a channel group or moves a strip into another
  // group (which sets strip.channel). Order within a channel = array order in
  // project.strips; reorderStrip() does the actual array surgery.
  import { project, selection, selectStrip, selectStrips, toggleSelect, removeStrip, updateStrip, reorderStrip } from '../state/project.svelte.js'

  // Channels in ascending order, each with its strips in current array order.
  const groups = $derived.by(() => {
    const map = new Map()
    for (const strip of project.strips) {
      if (!map.has(strip.channel)) map.set(strip.channel, [])
      map.get(strip.channel).push(strip)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  })

  // Flat displayed order (channel-grouped), used by Shift-click range select.
  const displayOrder = $derived(groups.flatMap(([, strips]) => strips.map((s) => s.id)))

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

  function onRowDrop(evt, targetStrip, after) {
    evt.preventDefault()
    const id = evt.dataTransfer.getData('text/plain') || dragId
    if (!id || id === targetStrip.id) return
    const fromIndex = project.strips.findIndex((s) => s.id === id)
    const targetIndex = project.strips.findIndex((s) => s.id === targetStrip.id)
    let insertAt = after ? targetIndex + 1 : targetIndex
    if (fromIndex !== -1 && fromIndex < insertAt) insertAt -= 1
    reorderStrip(id, insertAt, targetStrip.channel)
  }

  function channelEndIndex(channel) {
    let idx = project.strips.length
    for (let i = project.strips.length - 1; i >= 0; i--) {
      if (project.strips[i].channel === channel) {
        idx = i + 1
        break
      }
    }
    return idx
  }

  function onGroupDrop(evt, channel) {
    evt.preventDefault()
    const id = evt.dataTransfer.getData('text/plain') || dragId
    if (!id) return
    const fromIndex = project.strips.findIndex((s) => s.id === id)
    let insertAt = channelEndIndex(channel)
    if (fromIndex !== -1 && fromIndex < insertAt) insertAt -= 1
    reorderStrip(id, insertAt, channel)
  }

  function toggle(strip, field) {
    updateStrip(strip.id, { [field]: !strip[field] })
  }

  function ledLabel(strip) {
    return strip.geom.type === 'points' ? strip.geom.pts.length : strip.ledCount
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
        {#each strips as strip (strip.id)}
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
              <span class="meta">{ledLabel(strip)} LED</span>
            </button>
            <button class="del" title="Delete" onclick={() => removeStrip(strip.id)}>&times;</button>
          </li>
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
