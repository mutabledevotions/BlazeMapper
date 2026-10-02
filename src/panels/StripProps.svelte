<script>
  import { project, selection, updateStrip } from '../state/project.svelte.js'
  import { PITCH_PRESETS } from '../core/units.js'

  const strip = $derived(project.strips.find((s) => s.id === selection.stripId))

  function set(field, value) {
    updateStrip(strip.id, { [field]: value })
  }

  function setGeom(field, value) {
    updateStrip(strip.id, { geom: { ...strip.geom, [field]: value } })
  }

  function onPitchPreset(e) {
    const v = e.target.value
    if (v === 'custom') return
    set('pitch', parseFloat(v))
  }
</script>

<div class="strip-props">
  <h3>Strip properties</h3>
  {#if !strip}
    <p class="empty">Select a strip to edit it.</p>
  {:else}
    <label>
      Name
      <input type="text" value={strip.name} onchange={(e) => set('name', e.target.value)} />
    </label>

    <label>
      LED count
      <input
        type="number"
        min="1"
        value={strip.ledCount}
        onchange={(e) => set('ledCount', Math.max(1, parseInt(e.target.value) || 1))}
      />
    </label>

    <label>
      Pitch preset
      <select onchange={onPitchPreset}>
        <option value="custom">custom ({strip.pitch} mm)</option>
        {#each PITCH_PRESETS as p}
          <option value={p.pitchMm}>{p.perMetre}/m ({p.pitchMm} mm)</option>
        {/each}
      </select>
    </label>

    <label>
      Pitch (mm)
      <input
        type="number"
        min="0.1"
        step="0.01"
        value={strip.pitch}
        onchange={(e) => set('pitch', parseFloat(e.target.value) || 0.1)}
      />
    </label>

    <label>
      Channel
      <input
        type="number"
        min="0"
        max="63"
        value={strip.channel}
        onchange={(e) => set('channel', Math.min(63, Math.max(0, parseInt(e.target.value) || 0)))}
      />
    </label>

    <label>
      Color type
      <select value={strip.colorType} onchange={(e) => set('colorType', e.target.value)}>
        <option value="RGB">RGB</option>
        <option value="RGBW">RGBW</option>
      </select>
    </label>

    <label class="chk">
      <input type="checkbox" checked={strip.reversed} onchange={(e) => set('reversed', e.target.checked)} />
      Reversed
    </label>

    <label class="chk">
      <input type="checkbox" checked={strip.hidden} onchange={(e) => set('hidden', e.target.checked)} />
      Hidden
    </label>

    <label class="chk">
      <input type="checkbox" checked={strip.locked} onchange={(e) => set('locked', e.target.checked)} />
      Locked
    </label>

    <label>
      Z
      <input type="number" step="1" value={strip.z} onchange={(e) => set('z', parseFloat(e.target.value) || 0)} />
    </label>

    <label>
      Angle (deg)
      <input
        type="number"
        step="1"
        value={strip.geom.angle}
        onchange={(e) => setGeom('angle', parseFloat(e.target.value) || 0)}
      />
    </label>
  {/if}
</div>

<style>
  .strip-props {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    border-top: 1px solid var(--border);
  }
  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .empty {
    color: var(--muted);
    font-size: 0.85rem;
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
    padding: 0.25rem 0.4rem;
    font-size: 0.85rem;
  }
</style>
