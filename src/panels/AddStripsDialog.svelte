<script>
  // Native <dialog> modal. "rows" and "matrix" share the same parallel-rows layout
  // code in addStrips() -- matrix just means "count = number of rows".
  import { addStrips, project } from '../state/project.svelte.js'
  import { PITCH_PRESETS, convert } from '../core/units.js'

  let dialogEl

  function defaults() {
    return {
      count: 1,
      ledCount: 10,
      pitch: +convert(1000 / 30, 'mm', project.units).toFixed(3),
      colorType: 'RGB',
      z: 0,
      startChannel: 0,
      channelMode: 'allOne',
      placement: 'rows',
      rowSpacing: +convert(50, 'mm', project.units).toFixed(2),
      serpentine: false,
      offset: +convert(10, 'mm', project.units).toFixed(2)
    }
  }

  // Last submitted values, remembered across opens and reloads. Lengths are
  // stored with the unit they were entered in and converted if units changed.
  const STORE_KEY = 'pm.addStrips.last'
  const LENGTH_FIELDS = ['pitch', 'rowSpacing', 'offset', 'z']

  function loadLast() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY))
      if (!saved || !saved.form) return null
      const f = { ...defaults(), ...saved.form }
      if (saved.units && saved.units !== project.units) {
        for (const k of LENGTH_FIELDS) f[k] = +convert(f[k], saved.units, project.units).toFixed(3)
      }
      return f
    } catch {
      return null
    }
  }

  function saveLast(f) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ units: project.units, form: f }))
    } catch {}
  }

  let form = $state(defaults())

  export function open() {
    form = loadLast() || defaults()
    dialogEl.showModal()
  }

  function onPitchPreset(e) {
    const v = e.target.value
    if (v !== 'custom') form.pitch = parseFloat(v)
  }

  // Keeps the preset <select> showing the matching density (e.g. "30/m") instead
  // of always resetting to "custom" when the form's pitch already equals a preset.
  function presetValue(pitch) {
    for (const p of PITCH_PRESETS) {
      const v = +convert(p.pitchMm, 'mm', project.units).toFixed(3)
      if (Math.abs(v - pitch) < 1e-6) return v
    }
    return 'custom'
  }

  function submit(evt) {
    evt.preventDefault()
    addStrips({ ...form })
    saveLast({ ...form })
    dialogEl.close()
  }
</script>

<dialog bind:this={dialogEl} class="pm-dialog">
  <form onsubmit={submit}>
    <h3>Add strips</h3>
    <div class="grid">
      <label>
        Count
        <input type="number" min="1" bind:value={form.count} />
      </label>
      <label>
        LEDs per strip
        <input type="number" min="1" bind:value={form.ledCount} />
      </label>
      <label title="Common LED strip densities, converted to the project's units.">
        Pitch preset
        <select value={presetValue(form.pitch)} onchange={onPitchPreset}>
          <option value="custom">custom</option>
          {#each PITCH_PRESETS as p}
            <option value={+convert(p.pitchMm, 'mm', project.units).toFixed(3)}>{p.perMetre}/m</option>
          {/each}
        </select>
      </label>
      <label>
        Pitch ({project.units})
        <input type="number" min="0.01" step="any" bind:value={form.pitch} />
      </label>
      <label title="RGBW strips cap their Output Expander channel at 180 pixels instead of 240.">
        Color type
        <select bind:value={form.colorType}>
          <option value="RGB">RGB</option>
          <option value="RGBW">RGBW</option>
        </select>
      </label>
      <label title="Depth coordinate. Export switches to [x,y,z] when any strip has a non-zero Z.">
        Z
        <input type="number" step="1" bind:value={form.z} />
      </label>
      <label title="Output Expander channel (0-7 per board) for the first strip; with one channel per strip, later strips use the next channels.">
        Output Expander Channel
        <input type="number" min="0" max="63" bind:value={form.startChannel} />
      </label>
      <label>
        Channel assignment
        <select bind:value={form.channelMode}>
          <option value="perStrip">One channel per strip</option>
          <option value="allOne">All on one channel</option>
        </select>
      </label>
      <label>
        Placement
        <select bind:value={form.placement}>
          <option value="rows">Rows</option>
          <option value="matrix">Matrix (rows)</option>
          <option value="stacked">Stacked at cursor</option>
        </select>
      </label>
      {#if form.placement === 'stacked'}
        <label>
          Offset per strip ({project.units})
          <input type="number" min="0" step="any" bind:value={form.offset} />
        </label>
      {:else}
        <label>
          Row spacing ({project.units})
          <input type="number" min="0" step="any" bind:value={form.rowSpacing} />
        </label>
        <label class="chk" title="Reverses wire direction on every other row.">
          <input type="checkbox" bind:checked={form.serpentine} />
          Serpentine
        </label>
      {/if}
    </div>
    <p class="hint">Strips are placed at the current view centre.</p>
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
    width: min(28rem, 92vw);
  }
  .pm-dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem 0.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
  label.chk {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    color: var(--fg);
  }
  input,
  select {
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
    margin: 0.6rem 0 0;
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
