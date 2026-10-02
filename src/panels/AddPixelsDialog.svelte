<script>
  // Small dialog: N standalone pixels, laid out in a row at the view centre.
  import { addPixelsStrip, project } from '../state/project.svelte.js'

  let dialogEl
  let count = $state(10)
  let spacing = $state(project.grid.size)

  export function open() {
    count = 10
    spacing = project.grid.size
    dialogEl.showModal()
  }

  function submit(evt) {
    evt.preventDefault()
    addPixelsStrip(count, spacing)
    dialogEl.close()
  }
</script>

<dialog bind:this={dialogEl} class="pm-dialog">
  <form onsubmit={submit}>
    <h3>Add pixels</h3>
    <label>
      Count
      <input type="number" min="1" bind:value={count} />
    </label>
    <label title="Defaults to the grid size.">
      Spacing ({project.units})
      <input type="number" min="0.01" step="0.1" bind:value={spacing} />
    </label>
    <p class="hint">Each pixel becomes a draggable point on the canvas, placed at the current view centre.</p>
    <div class="actions">
      <button type="button" onclick={() => dialogEl.close()}>Cancel</button>
      <button type="submit" class="primary">Add</button>
    </div>
  </form>
</dialog>

<style>
  .pm-dialog {
    background: var(--panel-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    width: min(20rem, 92vw);
  }
  .pm-dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }
  input {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.3rem 0.4rem;
    font-size: 0.85rem;
  }
  .hint {
    color: var(--muted);
    font-size: 0.78rem;
    margin: 0.4rem 0 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  button {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
  }
  button.primary {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    font-weight: 600;
  }
</style>
