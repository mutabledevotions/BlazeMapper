<script>
  // World box controls (origin + size + units). Non-modal floating <dialog>,
  // same pattern as GridPanel/ImagePanel. The box itself is still dragged
  // directly on the canvas (border/label to move, corner handle to resize);
  // these fields are the precise/keyboard-entry equivalent.
  import { fmt } from '../core/units.js'
  import { project, setWorld, setUnits } from '../state/project.svelte.js'
  import Help from './Help.svelte'

  let { open = false, onClose = () => {} } = $props()

  let dialogEl

  $effect(() => {
    if (!dialogEl) return
    if (open && !dialogEl.open) dialogEl.show()
    else if (!open && dialogEl.open) dialogEl.close()
  })
</script>

<dialog bind:this={dialogEl} class="floating-panel world-dialog" onclose={onClose}>
  <div class="panel-body">
    <div class="head">
      <h3>World</h3>
      <button class="close" title="Close" onclick={onClose}>×</button>
    </div>

    <p class="hint">
      The square world box strips are mapped against, in project units -- e.g. a 2m x 2m costume or a 200m x 20m
      stage. Drag its border or corner handle on the canvas to move or resize it; press F to fit the view to it.
    </p>

    <div class="fields">
      <label class="num">
        X
        <input type="number" value={fmt(project.world.x)} onchange={(e) => setWorld({ x: parseFloat(e.target.value) || 0 })} />
      </label>
      <label class="num">
        Y
        <input type="number" value={fmt(project.world.y)} onchange={(e) => setWorld({ y: parseFloat(e.target.value) || 0 })} />
      </label>
      <label class="num">
        Size
        <input
          type="number"
          min="0.001"
          value={fmt(project.world.size)}
          onchange={(e) => setWorld({ size: Math.max(0.001, parseFloat(e.target.value) || 1) })}
        />
      </label>
      <span class="units-suffix">{project.units}</span>
    </div>

    <label>
      <span class="label-row">
        Units
        <Help text="Labels only -- the normalized export is identical whether the project is drawn in mm, in, or px." />
      </span>
      <select value={project.units} onchange={(e) => setUnits(e.target.value)}>
        <option value="mm">mm</option>
        <option value="in">in</option>
        <option value="px">px</option>
      </select>
    </label>
  </div>
</dialog>

<style>
  .world-dialog {
    width: 260px;
  }
  .hint {
    color: var(--muted);
    font-size: 0.78rem;
    margin: 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .fields {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .fields .num input {
    width: 4.2rem;
  }
  .units-suffix {
    display: inline-block;
    color: var(--muted);
    font-size: 0.78rem;
    padding-bottom: 0.35rem;
  }
</style>
