<script>
  import { project, setGrid, setUnits, toggleSnap, setWorld } from '../state/project.svelte.js'
  import { gridStep } from '../core/model.js'
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

  <label class="num" title="Grid lines per world-box edge. Snap step = world size / divisions.">
    Grid divisions
    <input
      type="number"
      min="1"
      step="1"
      value={project.grid.divisions}
      onchange={(e) => setGrid({ divisions: Math.max(1, parseInt(e.target.value) || 1) })}
    />
  </label>
  <span class="grid-step">({+gridStep(project).toFixed(3)} {project.units}/div)</span>

  <span class="sep"></span>

  <label class="num" title="The square world box strips are mapped against, in project units, e.g. a 2m x 2m costume or a 200m x 20m stage (set width via height on a non-square run). Drag its border or corner handle on the canvas to move or resize it; press F to fit the view to it.">
    World
    <input
      type="number"
      min="1"
      value={project.world.x}
      onchange={(e) => setWorld({ x: parseFloat(e.target.value) || 0 })}
      title="World origin X"
    />
    <input
      type="number"
      min="1"
      value={project.world.y}
      onchange={(e) => setWorld({ y: parseFloat(e.target.value) || 0 })}
      title="World origin Y"
    />
    &times;
    <input
      type="number"
      min="0.001"
      value={project.world.size}
      onchange={(e) => setWorld({ size: Math.max(0.001, parseFloat(e.target.value) || 1) })}
      title="World box size (square)"
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
  .grid-step {
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
