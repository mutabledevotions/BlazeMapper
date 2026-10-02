<script>
  import {
    project,
    selection,
    keys,
    ui,
    toolState,
    calibration,
    setGrid,
    setUnits,
    toggleSnap,
    setWorld,
    setLockPitch,
    duplicateSelected,
    mirrorSelected,
    rotateSelectedBy
  } from '../state/project.svelte.js'
  import { gridStep } from '../core/model.js'
  import { contextHint } from '../state/hotkeys.js'
  import AddStripsDialog from './AddStripsDialog.svelte'
  import ImagePanel from './ImagePanel.svelte'
  import AddPixelsDialog from './AddPixelsDialog.svelte'
  import Help from './Help.svelte'

  let stripsDialog
  let pixelsDialog
  let imagePanel

  const hasSelection = $derived(selection.ids.length > 0)

  // Snap button shows the *effective* state (grid.snap XOR Alt held), matching
  // what dragging would actually do right now.
  const effectiveSnap = $derived(project.grid.snap !== keys.alt)

  const hintText = $derived.by(() => {
    if (ui.typing) return ''
    if (calibration.active) return contextHint('calibrate')
    if (ui.dragMode === 'endHandle') return contextHint('endHandleDrag')
    if (ui.dragMode === 'groupResize') return contextHint('groupResizeDrag')
    return hasSelection ? contextHint('selection') : contextHint('idle')
  })
</script>

<div class="toolbar">
  <button onclick={() => stripsDialog.open()}>Add strip</button>
  <button onclick={() => pixelsDialog.open()}>Add pixels</button>
  <button disabled title="Phase 5">Add shape</button>
  <button disabled title="Phase 5">Add Bezier</button>
  <button title="Reference image: load, position, opacity, calibrate" onclick={() => imagePanel.toggle()}>Reference image</button>

  <span class="sep"></span>

  <button
    class="snap-indicator"
    class:active={effectiveSnap}
    title="Toggle snap to grid (hotkey: S). Hold Alt while dragging to invert temporarily."
    onclick={toggleSnap}
  >
    Snap {effectiveSnap ? 'on' : 'off'}
    <span class="key-badge" class:active={keys.alt}>Alt</span>
  </button>

  <label class="chk">
    <input type="checkbox" checked={project.grid.show} onchange={(e) => setGrid({ show: e.target.checked })} />
    Grid
  </label>

  <label class="num">
    <span class="label-row">
      Grid divisions
      <Help text="Grid lines per world-box edge. Snap step = world size / divisions." />
    </span>
    <input
      type="number"
      min="1"
      step="1"
      value={project.grid.divisions}
      onchange={(e) => setGrid({ divisions: Math.max(1, parseInt(e.target.value) || 1) })}
    />
  </label>
  <span class="grid-step">({+gridStep(project).toFixed(3)} {project.units}/div)</span>

  <!-- World + Transform cluster: one flex item, so it wraps to the next toolbar
       row as a unit. Each group is nowrap; the cluster only splits into two
       rows when it alone is wider than the toolbar. -->
  <div class="tb-cluster">
  <div class="tb-group world-group">
    <div class="world-fields">
      <span class="label-row world-title">
        World
        <Help
          text="The square world box strips are mapped against, in project units, e.g. a 2m x 2m costume or a 200m x 20m stage. Drag its border or corner handle on the canvas to move or resize it; press F to fit the view to it."
        />
      </span>
      <label class="num">
        X
        <input
          type="number"
          value={project.world.x}
          onchange={(e) => setWorld({ x: parseFloat(e.target.value) || 0 })}
        />
      </label>
      <label class="num">
        Y
        <input
          type="number"
          value={project.world.y}
          onchange={(e) => setWorld({ y: parseFloat(e.target.value) || 0 })}
        />
      </label>
      <label class="num">
        Size
        <input
          type="number"
          min="0.001"
          value={project.world.size}
          onchange={(e) => setWorld({ size: Math.max(0.001, parseFloat(e.target.value) || 1) })}
        />
      </label>
      <span class="units-suffix">{project.units}</span>
    </div>

    <label class="num">
      Units
      <select value={project.units} onchange={(e) => setUnits(e.target.value)}>
        <option value="mm">mm</option>
        <option value="in">in</option>
        <option value="px">px</option>
      </select>
    </label>
  </div>

  <div class="tb-group transform-group">
    <span class="sep"></span>

    <button title="Duplicate selection (Ctrl/Cmd+D)" disabled={!hasSelection} onclick={duplicateSelected}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <rect x="2" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" />
        <rect x="6" y="2" width="8" height="8" rx="1" fill="var(--panel-bg)" stroke="currentColor" stroke-width="1.3" />
      </svg>
    </button>
    <button title="Mirror horizontally" disabled={!hasSelection} onclick={() => mirrorSelected('h')}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 2" />
        <path d="M6 4 L2 8 L6 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M10 4 L14 8 L10 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button title="Mirror vertically" disabled={!hasSelection} onclick={() => mirrorSelected('v')}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 2" />
        <path d="M4 6 L8 2 L12 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 10 L8 14 L12 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button title="Rotate 90° left ([)" disabled={!hasSelection} onclick={() => rotateSelectedBy(-90)}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <path d="M12 8A4 4 0 1 1 8 4" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 1 L8 5 L4.5 3.2 Z" fill="currentColor" />
      </svg>
    </button>
    <button title="Rotate 90° right (])" disabled={!hasSelection} onclick={() => rotateSelectedBy(90)}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <path d="M4 8A4 4 0 1 0 8 4" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 1 L8 5 L11.5 3.2 Z" fill="currentColor" />
      </svg>
    </button>

    <label class="chk">
      <input type="checkbox" checked={toolState.lockPitch} onchange={(e) => setLockPitch(e.target.checked)} />
      Lock pitch
      <Help text="Default on. Locked: positions scale, strip size/pitch/LED count stay fixed. Unlocked: full geometric scale, pitch scales too." />
    </label>
  </div>
  </div>

  <span class="hint-line">{hintText}</span>
</div>

<AddStripsDialog bind:this={stripsDialog} />
<AddPixelsDialog bind:this={pixelsDialog} />
<ImagePanel bind:this={imagePanel} />

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--panel-bg);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .sep {
    width: 1px;
    align-self: stretch;
    background: var(--border);
  }
  .grid-step {
    display: inline-block;
    min-width: 8.5rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .chk,
  .num {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
  }
  .num {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
  .num input,
  .num select {
    width: 4.5rem;
  }
  .label-row {
    width: 100%;
  }
  .world-fields {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .world-fields .world-title {
    align-self: flex-start;
    font-size: 0.85rem;
    color: var(--fg);
    width: auto;
    margin-right: 0.25rem;
  }
  .world-fields .num input {
    width: 4.2rem;
  }
  .units-suffix {
    display: inline-block;
    width: 1.6rem;
    color: var(--muted);
    font-size: 0.78rem;
    padding-bottom: 0.35rem;
  }
  .tb-cluster {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem 1rem;
    min-width: 0;
  }
  .tb-group {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-end;
    gap: 0.75rem;
  }
  button {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    border-radius: 4px;
    padding: 0.4rem 0.8rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  button:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  /* Fixed footprints: text that changes (on/off, step, units) must not
     resize its item and shift the rest of the toolbar. */
  .snap-indicator {
    width: 8.5rem;
    flex-shrink: 0;
    justify-content: center;
    background: var(--input-bg);
    color: var(--muted);
    border: 1px solid var(--border);
    font-weight: 500;
  }
  .snap-indicator.active {
    background: var(--accent-dim);
    color: var(--accent);
    border-color: var(--accent);
  }
  .key-badge {
    /* Always rendered (not conditionally mounted) so the button's width never
       shifts when Alt is pressed or released -- only its color does. */
    background: var(--border);
    color: var(--muted);
    border-radius: 999px;
    padding: 0.05rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 700;
  }
  .key-badge.active {
    background: var(--accent);
    color: #0b0d10;
  }
  .hint-line {
    /* Fixed footprint (not just margin-left: auto) so the line's box never
       collapses or grows as hintText changes (including to '' while typing) --
       that would otherwise shift every other toolbar item that wraps near it. */
    margin-left: auto;
    width: 26rem;
    flex-shrink: 0;
    color: var(--muted);
    font-size: 0.78rem;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
