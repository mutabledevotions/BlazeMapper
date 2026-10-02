<script>
  // Hidden/locked toggles moved to the strip list's layer-style icons (Illustrator-style).
  import { project, selection, updateStrip, setSpacing } from '../state/project.svelte.js'
  import { PITCH_PRESETS, convert } from '../core/units.js'
  import { sample } from '../core/geometry/index.js'

  const strip = $derived(project.strips.find((s) => s.id === selection.stripId))
  const isPoints = $derived(strip?.geom.type === 'points')
  const isFit = $derived(strip?.spacing === 'fit')

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

  // Fit mode shows the derived centre-to-centre spacing (read-only) rather than
  // the strip's own pitch field, since the pitch field no longer drives spacing.
  function derivedPitch() {
    const pts = sample(strip.geom, strip)
    if (pts.length < 2) return 0
    const a = pts[0]
    const b = pts[1]
    return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1000) / 1000
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

    {#if isPoints}
      <p class="hint">{strip.geom.pts.length} pixel{strip.geom.pts.length === 1 ? '' : 's'}. Drag each point on the canvas to move it.</p>
    {:else}
      <label>
        LED count
        <input
          type="number"
          min="1"
          value={strip.ledCount}
          onchange={(e) => set('ledCount', Math.max(1, parseInt(e.target.value) || 1))}
        />
      </label>

      <label title="Pitch mode fixes LED spacing to the strip's pitch; length follows LED count. Fit mode spreads the LED count evenly between the two endpoints.">
        Spacing
        <select value={strip.spacing} onchange={(e) => setSpacing(strip.id, e.target.value)}>
          <option value="pitch">Pitch (fixed spacing)</option>
          <option value="fit">Fit (spread between endpoints)</option>
        </select>
      </label>

      {#if !isFit}
        <label title="Common LED strip densities, converted to the project's units.">
          Pitch preset
          <select onchange={onPitchPreset}>
            <option value="custom">custom ({strip.pitch} {project.units})</option>
            {#each PITCH_PRESETS as p}
              <option value={+convert(p.pitchMm, 'mm', project.units).toFixed(3)}>{p.perMetre}/m ({+convert(p.pitchMm, 'mm', project.units).toFixed(3)} {project.units})</option>
            {/each}
          </select>
        </label>

        <label title="Centre-to-centre LED spacing.">
          Pitch ({project.units})
          <input
            type="number"
            min="0.1"
            step="0.01"
            value={strip.pitch}
            onchange={(e) => set('pitch', parseFloat(e.target.value) || 0.1)}
          />
        </label>
      {:else}
        <label title="Derived from LED count and the distance between the two endpoints. Drag the end handle to change it.">
          Spacing ({project.units}, derived)
          <input type="number" value={derivedPitch()} readonly disabled />
        </label>
      {/if}
    {/if}

    <label title="The strip's Output Expander channel (0-63). Pixelblaze indices run continuously, channel 0 first.">
      Channel
      <input
        type="number"
        min="0"
        max="63"
        value={strip.channel}
        onchange={(e) => set('channel', Math.min(63, Math.max(0, parseInt(e.target.value) || 0)))}
      />
    </label>

    <label title="RGBW strips cap their Output Expander channel at 180 pixels instead of 240.">
      Color type
      <select value={strip.colorType} onchange={(e) => set('colorType', e.target.value)}>
        <option value="RGB">RGB</option>
        <option value="RGBW">RGBW</option>
      </select>
    </label>

    {#if !isPoints}
      <label class="chk" title="Flips wire order along this strip without moving it on the canvas.">
        <input type="checkbox" checked={strip.reversed} onchange={(e) => set('reversed', e.target.checked)} />
        Reversed
      </label>
    {/if}

    <label title="Depth coordinate. Export switches to [x,y,z] when any strip has a non-zero Z.">
      Z
      <input type="number" step="1" value={strip.z} onchange={(e) => set('z', parseFloat(e.target.value) || 0)} />
    </label>

    {#if !isPoints}
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
  .hint {
    color: var(--muted);
    font-size: 0.8rem;
    margin: 0;
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
  input:disabled {
    opacity: 0.7;
  }
</style>
