<script>
  // Small dialog: N standalone pixels, laid out in a row at the view centre.
  import { addPixels, project } from '../state/project.svelte.js'
  import { gridStep } from '../core/model.js'
  import Help from './Help.svelte'

  let dialogEl
  let count = $state(10)
  let spacing = $state(gridStep(project))
  let channel = $state(0)

  export function open() {
    count = 10
    spacing = gridStep(project)
    dialogEl.showModal()
  }

  function submit(evt) {
    evt.preventDefault()
    addPixels(count, spacing, Math.max(0, channel | 0))
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
    <label>
      <span class="label-row">
        Spacing ({project.units})
        <Help text="Defaults to the grid size." />
      </span>
      <input type="number" min="0.01" step="any" bind:value={spacing} />
    </label>
    <label>
      <span class="label-row">
        Output Expander Channel
        <Help text="Channel for the new pixels. Each pixel is its own item in the Strips list; drag it there to set its address." />
      </span>
      <input type="number" min="0" max="63" step="1" bind:value={channel} />
    </label>
    <p class="hint">Adds individual point LEDs (not a strip), in a row at the view centre. Drag each on the canvas to place it.</p>
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
