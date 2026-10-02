<script>
  import { project, selection, selectStrip, removeStrip } from '../state/project.svelte.js'
</script>

<div class="strip-list">
  <h3>Strips</h3>
  {#if project.strips.length === 0}
    <p class="empty">No strips yet. Use "Add strip" above.</p>
  {/if}
  <ul>
    {#each project.strips as strip (strip.id)}
      <li class:selected={selection.stripId === strip.id}>
        <button class="row" onclick={() => selectStrip(strip.id)}>
          <span class="swatch" style:background={strip.color}></span>
          <span class="name">{strip.name}</span>
          <span class="meta">ch {strip.channel} &middot; {strip.ledCount} LED</span>
        </button>
        <button class="del" title="Delete" onclick={() => removeStrip(strip.id)}>&times;</button>
      </li>
    {/each}
  </ul>
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
  .row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: inherit;
    padding: 0.35rem 0.5rem;
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
