<script>
  // Grid display/snap-step controls. Non-modal floating <dialog>, modelled on
  // ImagePanel.svelte: opened/closed by the `open` prop (Toolbar.svelte owns
  // which of the three popups -- Grid/World/Reference image -- is current).
  // Snap itself stays a toolbar button, not here, since it needs the live
  // Alt-held badge next to it.
  import { project, setGrid } from '../state/project.svelte.js'
  import { gridStep } from '../core/model.js'
  import Help from './Help.svelte'

  let { open = false, onClose = () => {} } = $props()

  let dialogEl

  $effect(() => {
    if (!dialogEl) return
    if (open && !dialogEl.open) dialogEl.show()
    else if (!open && dialogEl.open) dialogEl.close()
  })
</script>

<dialog bind:this={dialogEl} class="floating-panel grid-dialog" onclose={onClose}>
  <div class="panel-body">
    <div class="head">
      <h3>Grid</h3>
      <button class="close" title="Close" onclick={onClose}>×</button>
    </div>

    <label class="chk">
      <input type="checkbox" checked={project.grid.show} onchange={(e) => setGrid({ show: e.target.checked })} />
      Show grid
    </label>

    <label>
      <span class="label-row">
        Divisions
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

    <p class="step">Step: {+gridStep(project).toFixed(3)} {project.units} / division</p>
  </div>
</dialog>

<style>
  .grid-dialog {
    width: 220px;
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
  .step {
    margin: 0;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
</style>
