<script>
  // Import: file picker + paste textarea, format auto-detected as you type/
  // load (core/import.js's detectFormat -- pure, no DOM). A map (relaxed-JSON
  // array) is ready to import immediately; a JS generator function needs an
  // explicit pixelCount + "Evaluate" click (new Function is only ever called
  // from that click, never automatically); a project file needs an in-dialog
  // confirm before it replaces the current project.
  import { importMap, replaceProject } from '../state/project.svelte.js'
  import { detectFormat, evalMapFunction } from '../core/import.js'
  import { deserializeProject } from '../state/persist.js'
  import Help from './Help.svelte'

  let dialogEl
  let text = $state('')
  let channel = $state(0)
  let pixelCount = $state(60)
  let confirmReplace = $state(false)
  let evalError = $state('')
  let evalPoints = $state(null)

  export function open() {
    text = ''
    channel = 0
    pixelCount = 60
    confirmReplace = false
    evalError = ''
    evalPoints = null
    dialogEl.showModal()
  }

  const detected = $derived(detectFormat(text))

  // Clear a stale evaluation whenever the source text changes.
  $effect(() => {
    text
    evalPoints = null
    evalError = ''
  })

  function onFileChange(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      text = String(reader.result || '')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function onEvaluate() {
    evalError = ''
    evalPoints = null
    try {
      evalPoints = evalMapFunction(text, Math.max(1, pixelCount | 0))
    } catch (err) {
      evalError = err.message
    }
  }

  function onImportMap() {
    if (detected.kind === 'map') {
      importMap(detected.points, Math.max(0, channel | 0))
      dialogEl.close()
    } else if (detected.kind === 'function' && evalPoints) {
      importMap(evalPoints, Math.max(0, channel | 0))
      dialogEl.close()
    }
  }

  function onReplaceProject() {
    if (detected.kind !== 'project' || !confirmReplace) return
    // A re-imported "Save project" download carries savedAt/imageData
    // alongside the project's own fields (see persist.js's serializeProject) --
    // split them back out so the project doesn't pick up stray keys.
    const { project: data, imageData } = deserializeProject(detected.data)
    replaceProject(data, imageData)
    dialogEl.close()
  }
</script>

<dialog bind:this={dialogEl} class="pm-dialog">
  <form onsubmit={(e) => e.preventDefault()}>
    <h3>Import</h3>

    <input type="file" accept=".json,.txt,text/plain,application/json" hidden id="import-file" onchange={onFileChange} />
    <label class="file-row" for="import-file">
      <span class="btn-like">Choose file&hellip;</span>
      <span class="hint">or paste below</span>
    </label>

    <label>
      <span class="label-row">
        Map / project JSON, or a generator function
        <Help text="Paste a Pixelblaze map ([[x,y],...] or [[x,y,z],...], relaxed JSON -- comments and a trailing comma are fine), a `function (pixelCount)` generator, or a BlazeMapper project file (.blazemap.json or .pixelmap.json)." />
      </span>
      <textarea rows="8" bind:value={text} placeholder="[[0,0],[10,0],[20,0]]"></textarea>
    </label>

    <p class="detected">
      {#if detected.kind === 'empty'}
        Paste or load a file to begin.
      {:else if detected.kind === 'error'}
        <span class="error">{detected.message}</span>
      {:else if detected.kind === 'map'}
        Detected: Pixelblaze map, {detected.points.length} point{detected.points.length === 1 ? '' : 's'}.
      {:else if detected.kind === 'function'}
        Detected: JS generator function -- set the pixel count and evaluate it below.
      {:else if detected.kind === 'project'}
        Detected: BlazeMapper project file ({Array.isArray(detected.data.strips) ? detected.data.strips.length : 0} strip{Array.isArray(detected.data.strips) && detected.data.strips.length === 1 ? '' : 's'}).
      {/if}
    </p>

    {#if detected.kind === 'map' || detected.kind === 'function'}
      {#if detected.kind === 'function'}
        <label class="inline">
          Pixel count
          <input type="number" min="1" bind:value={pixelCount} />
          <button type="button" onclick={onEvaluate}>Evaluate</button>
        </label>
        {#if evalError}
          <p class="detected"><span class="error">{evalError}</span></p>
        {:else if evalPoints}
          <p class="detected">Evaluated: {evalPoints.length} point{evalPoints.length === 1 ? '' : 's'}.</p>
        {/if}
      {/if}

      <label class="inline">
        <span class="label-row">
          Channel
          <Help text="Output Expander channel for the imported map, as one new points strip named 'Imported map'. Wire order is preserved; it's placed at the next free address on this channel." />
        </span>
        <input type="number" min="0" max="63" step="1" bind:value={channel} />
      </label>

      <div class="actions">
        <button type="button" onclick={() => dialogEl.close()}>Cancel</button>
        <button
          type="button"
          class="primary"
          disabled={detected.kind === 'map' ? false : !evalPoints}
          onclick={onImportMap}
        >
          Import as points strip
        </button>
      </div>
    {:else if detected.kind === 'project'}
      <label class="chk">
        <input type="checkbox" bind:checked={confirmReplace} />
        Replace the current project with this file (use Undo afterwards to get it back)
      </label>
      <div class="actions">
        <button type="button" onclick={() => dialogEl.close()}>Cancel</button>
        <button type="button" class="primary" disabled={!confirmReplace} onclick={onReplaceProject}>Replace project</button>
      </div>
    {:else}
      <div class="actions">
        <button type="button" onclick={() => dialogEl.close()}>Close</button>
      </div>
    {/if}
  </form>
</dialog>

<style>
  .pm-dialog {
    background: var(--panel-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    width: min(28rem, 92vw);
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
  label.chk {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    color: var(--fg);
  }
  label.inline {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
  }
  label.inline input {
    width: 6rem;
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
    cursor: pointer;
  }
  .btn-like {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
  }
  .file-row .hint {
    color: var(--muted);
    font-size: 0.78rem;
  }
  textarea {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.4rem;
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    resize: vertical;
  }
  input[type='number'] {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.3rem 0.4rem;
    font-size: 0.85rem;
  }
  .detected {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .error {
    color: #ff8a65;
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
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
