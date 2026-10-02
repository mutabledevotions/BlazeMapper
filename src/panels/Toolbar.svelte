<script>
  import { project, addStrip, setGrid, setUnits } from '../state/project.svelte.js'

  function onAddStrip() {
    addStrip('line', { geom: { p0: { x: 0, y: 0 }, angle: 0 } })
  }
</script>

<div class="toolbar">
  <button onclick={onAddStrip}>Add strip</button>

  <label class="chk">
    <input type="checkbox" checked={project.grid.show} onchange={(e) => setGrid({ show: e.target.checked })} />
    Grid
  </label>

  <label class="chk">
    <input type="checkbox" checked={project.grid.snap} onchange={(e) => setGrid({ snap: e.target.checked })} />
    Snap
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

  <label class="num">
    Units
    <select value={project.units} onchange={(e) => setUnits(e.target.value)}>
      <option value="mm">mm</option>
      <option value="in">in</option>
      <option value="px">px</option>
    </select>
  </label>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--panel-bg);
    border-bottom: 1px solid var(--border);
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
  button:hover {
    filter: brightness(1.1);
  }
</style>
