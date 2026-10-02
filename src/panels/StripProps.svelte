<script>
  import { fmt } from '../core/units.js'
  // Hidden/locked toggles moved to the strip list's layer-style icons (Illustrator-style).
  import {
    project,
    selection,
    updateStrip,
    setSpacing,
    nudgeSelected,
    rotateSelectedBy,
    setStripStart
  } from '../state/project.svelte.js'
  import { PITCH_PRESETS, convert } from '../core/units.js'
  import { quantizeAngle } from '../core/geometry/line.js'
  import { curveLength } from '../core/geometry/bezier.js'
  import { sample } from '../core/geometry/index.js'
  import { stripsBbox } from '../core/layout.js'
  import { gridStep } from '../core/model.js'
  import { endAddress, byteRange } from '../core/address.js'
  import Help from './Help.svelte'

  const strip = $derived(project.strips.find((s) => s.id === selection.primary))
  const isPoints = $derived(strip?.geom.type === 'points')
  const isBezier = $derived(strip?.geom.type === 'bezier')
  const isFit = $derived(strip?.spacing === 'fit')
  const bezierLength = $derived(isBezier ? curveLength(strip.geom) : 0)
  const bezierFitCount = $derived(isBezier && strip.pitch > 0 ? Math.floor(bezierLength / strip.pitch) + 1 : 0)
  const multi = $derived(selection.ids.length > 1)
  const selectedStrips = $derived(project.strips.filter((s) => selection.ids.includes(s.id)))

  // Position readout origin: the group bbox's top-left when multiple strips are
  // selected, otherwise the single strip's own origin (p0, or its first point).
  const originWorld = $derived.by(() => {
    if (multi) {
      const box = stripsBbox(selectedStrips)
      return box ? { x: box.minX, y: box.minY } : null
    }
    if (!strip) return null
    return strip.geom.type === 'points' ? strip.geom.pts[0] || { x: 0, y: 0 } : strip.geom.p0
  })
  const originRel = $derived(
    originWorld ? { x: round(originWorld.x - project.world.x), y: round(originWorld.y - project.world.y) } : null
  )

  function round(n) {
    return Math.round(n * 1000) / 1000
  }

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

  // Editable X/Y move the whole selection by the delta from its current relative
  // position -- works the same whether one or many strips are selected.
  function setOriginX(v) {
    if (!originRel) return
    nudgeSelected(v - originRel.x, 0)
  }
  function setOriginY(v) {
    if (!originRel) return
    nudgeSelected(0, v - originRel.y)
  }

  function nudge(dx, dy, evt) {
    const mult = evt.shiftKey ? 10 : evt.altKey ? 0.1 : 1
    const step = gridStep(project) * mult
    nudgeSelected(dx * step, dy * step)
  }

  function rotateNudge(dir, evt) {
    const step = evt.shiftKey ? 15 : 0.5
    rotateSelectedBy(dir * step)
  }

  // Address readout: "LEDs 12-21" (LED-level, the primary address Pixelblaze
  // and the Output Expander both actually use) plus a secondary "bytes 34-63"
  // readout for anyone thinking in DMX-style byte channels.
  const addrEnd = $derived(strip ? endAddress(strip) : 0)
  const addrLedRange = $derived(strip ? (strip.start === addrEnd ? `${strip.start}` : `${strip.start}-${addrEnd}`) : '')
  const addrBytes = $derived(strip ? byteRange(strip) : null)

  function setAddress(v) {
    if (!strip) return
    const n = Math.max(1, Math.round(v) || 1)
    setStripStart(strip.id, n)
  }

  function nudgeAddress(dir, evt) {
    if (!strip) return
    const mult = evt.shiftKey ? 10 : 1
    setStripStart(strip.id, Math.max(1, strip.start + dir * mult))
  }
</script>

<div class="strip-props">
  <h3>Strip properties</h3>
  {#if !selection.ids.length}
    <p class="empty">Select a strip to edit it.</p>
  {:else}
    {#if multi}
      <p class="empty">{selection.ids.length} items selected</p>
    {:else if strip}
      <label>
        Name
        <input type="text" value={strip.name} onchange={(e) => set('name', e.target.value)} />
      </label>

      <div class="readout">
        <div class="readout-row">
          <label class="num">
            <span class="label-row">
              Address
              <Help text="This item's 1-based LED address within its Output Expander channel. Pixelblaze and the Output Expander address whole LEDs, not color bytes -- setting this claims [start, end] and pushes any other item in the channel that now overlaps to right after whatever displaced it, cascading forward. Untouched gaps are left alone, and a locked item is never pushed (the push jumps past it instead)." />
            </span>
            <input
              type="number"
              min="1"
              disabled={strip.locked}
              value={strip.start}
              onchange={(e) => setAddress(parseFloat(e.target.value))}
            />
          </label>
        </div>
        <div class="nudge-row">
          <button type="button" class="nudge" title="Address -1 (Shift: -10)" disabled={strip.locked} onclick={(e) => nudgeAddress(-1, e)}>&minus;</button>
          <button type="button" class="nudge" title="Address +1 (Shift: +10)" disabled={strip.locked} onclick={(e) => nudgeAddress(1, e)}>&plus;</button>
        </div>
        <p class="addr-readout">
          LEDs {addrLedRange}{#if addrBytes} &middot; bytes {addrBytes.start}-{addrBytes.end}{/if}
        </p>
      </div>
    {/if}

    {#if originRel}
      <div class="readout">
        <div class="readout-row">
          <label class="num">
            X ({project.units})
            <input type="number" step="any" value={fmt(originRel.x)} onchange={(e) => setOriginX(parseFloat(e.target.value) || 0)} />
          </label>
          <label class="num">
            Y ({project.units})
            <input type="number" step="any" value={fmt(originRel.y)} onchange={(e) => setOriginY(parseFloat(e.target.value) || 0)} />
          </label>
          {#if !multi && strip && !isPoints && !isBezier}
            <label class="num">
              Angle (deg)
              <input
                type="number"
                step="0.5"
                value={strip.geom.angle}
                onchange={(e) => setGeom('angle', quantizeAngle(parseFloat(e.target.value) || 0))}
              />
            </label>
          {/if}
        </div>
        <div class="nudge-row">
          <button type="button" class="nudge" title="Nudge up (Shift: 10x, Alt: 1/10)" onclick={(e) => nudge(0, -1, e)}>&uarr;</button>
          <button type="button" class="nudge" title="Nudge down (Shift: 10x, Alt: 1/10)" onclick={(e) => nudge(0, 1, e)}>&darr;</button>
          <button type="button" class="nudge" title="Nudge left (Shift: 10x, Alt: 1/10)" onclick={(e) => nudge(-1, 0, e)}>&larr;</button>
          <button type="button" class="nudge" title="Nudge right (Shift: 10x, Alt: 1/10)" onclick={(e) => nudge(1, 0, e)}>&rarr;</button>
          <button type="button" class="nudge" title="Rotate -0.5° (Shift: 15°)" onclick={(e) => rotateNudge(-1, e)}>&#8634;</button>
          <button type="button" class="nudge" title="Rotate +0.5° (Shift: 15°)" onclick={(e) => rotateNudge(1, e)}>&#8635;</button>
        </div>
      </div>
    {/if}

    {#if !multi && strip}
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

        <label>
          <span class="label-row">
            Spacing
            <Help text="Pitch mode fixes LED spacing to the strip's pitch; length follows LED count. Fit mode spreads the LED count evenly between the two endpoints." />
          </span>
          <select value={strip.spacing} onchange={(e) => setSpacing(strip.id, e.target.value)}>
            <option value="pitch">Pitch (fixed spacing)</option>
            <option value="fit">Fit (spread between endpoints)</option>
          </select>
        </label>

        {#if isBezier}
          <p class="hint">
            Curve length {fmt(bezierLength)} {project.units}{#if !isFit} (fits {bezierFitCount} LEDs at pitch){/if}
          </p>
        {/if}

        {#if !isFit}
          <label>
            <span class="label-row">
              Pitch preset
              <Help text="Common LED strip densities, converted to the project's units." />
            </span>
            <select onchange={onPitchPreset}>
              <option value="custom">custom ({fmt(strip.pitch)} {project.units})</option>
              {#each PITCH_PRESETS as p}
                <option value={+convert(p.pitchMm, 'mm', project.units).toFixed(3)}>{p.perMetre}/m ({+convert(p.pitchMm, 'mm', project.units).toFixed(3)} {project.units})</option>
              {/each}
            </select>
          </label>

          <label>
            <span class="label-row">
              Pitch ({project.units})
              <Help text="Centre-to-centre LED spacing." />
            </span>
            <input
              type="number"
              min="0.1"
              step="any"
              value={fmt(strip.pitch)}
              onchange={(e) => set('pitch', parseFloat(e.target.value) || 0.1)}
            />
          </label>
        {:else}
          <label>
            <span class="label-row">
              Spacing ({project.units}, derived)
              <Help text="Derived from LED count and the distance between the two endpoints. Drag the end handle to change it." />
            </span>
            <input type="number" value={fmt(derivedPitch())} readonly disabled />
          </label>
        {/if}
      {/if}

      <label>
        <span class="label-row">
          Channel
          <Help text="The strip's Output Expander channel (0-63). Pixelblaze indices run continuously, channel 0 first." />
        </span>
        <input
          type="number"
          min="0"
          max="63"
          value={strip.channel}
          onchange={(e) => set('channel', Math.min(63, Math.max(0, parseInt(e.target.value) || 0)))}
        />
      </label>

      <label>
        <span class="label-row">
          Color type
          <Help text="RGBW strips cap their Output Expander channel at 180 pixels instead of 240." />
        </span>
        <select value={strip.colorType} onchange={(e) => set('colorType', e.target.value)}>
          <option value="RGB">RGB</option>
          <option value="RGBW">RGBW</option>
        </select>
      </label>

      {#if !isPoints}
        <label class="chk">
          <input type="checkbox" checked={strip.reversed} onchange={(e) => set('reversed', e.target.checked)} />
          Reversed
          <Help text="Flips wire order along this strip without moving it on the canvas." />
        </label>
      {/if}

      <label>
        <span class="label-row">
          Z ({project.units})
          <Help text="Depth in world units (same units as X/Y, currently shown in the label), not normalized map units. On export Z is divided by the world box size like X and Y. The map switches to [x, y, z] when any item has a non-zero Z (or Force Z is on)." />
        </span>
        <input type="number" step="1" value={fmt(strip.z)} onchange={(e) => set('z', parseFloat(e.target.value) || 0)} />
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
  label.chk :global(.pm-help) {
    margin-left: 0.2rem;
  }
  .readout {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .readout-row {
    display: flex;
    gap: 0.5rem;
  }
  .readout-row .num {
    flex: 1;
    min-width: 0;
  }
  .nudge-row {
    display: flex;
    gap: 0.3rem;
  }
  .nudge {
    flex: 1;
    background: var(--panel-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.25rem 0;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
  }
  .nudge:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .nudge:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .addr-readout {
    margin: 0;
    color: var(--muted);
    font-size: 0.75rem;
  }
</style>
