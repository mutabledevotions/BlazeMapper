<script>
  import { project, setGrid, setUnits, toggleSnap, setCanvasSize } from '../state/project.svelte.js'
  import AddStripsDialog from './AddStripsDialog.svelte'
  import AddPixelsDialog from './AddPixelsDialog.svelte'

  let stripsDialog
  let pixelsDialog
</script>

<div class="toolbar">
  <button onclick={() => stripsDialog.open()}>Add strip</button>
  <button onclick={() => pixelsDialog.open()}>Add pixels</button>
  <button disabled title="Phase 5">Add shape</button>
  <button disabled title="Phase 5">Add Bezier</button>

  <span class="sep"></span>

  <button
    class="snap-indicator"
    class:active={project.grid.snap}
    title="Toggle snap to grid (hotkey: S). Hold Alt while dragging to invert temporarily."
    onclick={toggleSnap}
  >
    Snap {project.grid.snap ? 'on' : 'off'}
  </button>

  <label class="chk">
    <input type="checkbox" checked={project.grid.show} onchange={(e) => setGrid({ show: e.target.checked })} />
    Grid
  </label>

  <label class="num">
    Grid size
    <input
      type="number"
      min="0.1"
      step="1"
      value={project.grid.size}
      onchange={(e) => setGrid({ size: parseFloat(e.target.value) || 1 })}
    />
  </label>

  <span class="sep"></span>

  <label class="num" title="Physical canvas bounds, e.g. a 2m x 2m costume or a 200m x 20m stage. Drawn as the dashed boundary rect; press F to fit the view to it.">
    Canvas
    <input
      type="number"
      min="1"
      value={project.canvas.w}
      onchange={(e) => setCanvasSize({ w: parseFloat(e.target.value) || 1 })}
    />
    &times;
    <input
      type="number"
      min="1"
      value={project.canvas.h}
      onchange={(e) => setCanvasSize({ h: parseFloat(e.target.value) || 1 })}
    />
  </label>

  <label class="num">
    Units
    <select value={project.units} onchange={(e) => setUnits(e.target.value)}>
      <option value="mm">mm</option>
      <option value="in">in</option>
      <option value="px">px</option>
    </select>
  </label>
</div>

<AddStripsDialog bind:this={stripsDialog} />
<AddPixelsDialog bind:this={pixelsDialog} />

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
  .chk,
  .num {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
  }
  .num input,
  .num select {
    width: 4.5rem;
  }
  button {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    border-radius: 4px;
    padding: 0.4rem 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .snap-indicator {
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
</style>
