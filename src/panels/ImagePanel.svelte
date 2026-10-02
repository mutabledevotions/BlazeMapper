<script>
  // Reference image controls: load/replace/remove, visible/lock, opacity,
  // rotation, scale, fit-to-world, and two-point calibration. Lives in the
  // left sidebar's bottom pane, stacked under Strip properties (that pane
  // already scrolls, so this just adds to its content rather than needing a
  // third resizable split).
  import {
    project,
    imageSrc,
    calibration,
    loadImage,
    updateImage,
    removeImage,
    startCalibration,
    cancelCalibration,
    calibrateImage
  } from '../state/project.svelte.js'
  import { fitToBox } from '../core/image.js'
  import { quantizeAngle } from '../core/geometry/line.js'
  import Help from './Help.svelte'

  let fileInput
  let realDistance = $state('')

  function onFileChange(e) {
    const file = e.target.files && e.target.files[0]
    if (file) loadImage(file)
    e.target.value = '' // allow re-selecting the same file later
  }

  function fitToWorld() {
    if (!project.image || !imageSrc.naturalW) return
    updateImage(fitToBox(imageSrc.naturalW, imageSrc.naturalH, project.world))
  }

  function toggleCalibrate() {
    if (calibration.active) {
      cancelCalibration()
      realDistance = ''
    } else {
      startCalibration()
    }
  }

  function confirmCalibration() {
    const dist = parseFloat(realDistance)
    if (dist > 0 && calibration.points.length === 2) {
      calibrateImage(calibration.points[0], calibration.points[1], dist)
    }
    cancelCalibration()
    realDistance = ''
  }

  function cancelCalibrationForm() {
    cancelCalibration()
    realDistance = ''
  }
</script>

<div class="image-panel">
  <h3>Reference image</h3>

  <input bind:this={fileInput} type="file" accept="image/*" hidden onchange={onFileChange} />
  <div class="row">
    <button type="button" onclick={() => fileInput.click()}>{project.image ? 'Replace image' : 'Load image'}</button>
    {#if project.image}
      <button type="button" class="danger" onclick={removeImage}>Remove</button>
    {/if}
  </div>

  {#if imageSrc.name}
    <p class="filename" title={imageSrc.name}>{imageSrc.name}</p>
  {/if}

  {#if project.image}
    <label class="chk">
      <input type="checkbox" checked={project.image.visible} onchange={(e) => updateImage({ visible: e.target.checked })} />
      Visible
    </label>

    <label class="chk">
      <input type="checkbox" checked={project.image.locked} onchange={(e) => updateImage({ locked: e.target.checked })} />
      Lock
      <Help text="Locked images ignore drag, scale, and rotate on the canvas, so clicks reach strips and the marquee instead. Hotkey: I." />
    </label>

    <label>
      Opacity
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={project.image.opacity}
        oninput={(e) => updateImage({ opacity: parseFloat(e.target.value) })}
      />
    </label>

    <label>
      Rotation (deg)
      <input
        type="number"
        step="0.5"
        value={project.image.rotation}
        onchange={(e) => updateImage({ rotation: quantizeAngle(parseFloat(e.target.value) || 0) })}
      />
    </label>

    <label>
      <span class="label-row">
        Scale ({project.units}/px)
        <Help text="World units per source image pixel. Drag the image's corner handle to scale it, or use Calibrate scale against a known real-world distance." />
      </span>
      <input
        type="number"
        min="0.000001"
        step="any"
        value={project.image.scale}
        onchange={(e) => updateImage({ scale: Math.max(1e-6, parseFloat(e.target.value) || project.image.scale) })}
      />
    </label>

    <div class="row">
      <button type="button" title="Fit the image into the world box, centred" onclick={fitToWorld}>Fit to world</button>
    </div>

    <div class="label-row">
      <span>Calibrate scale</span>
      <Help text="Click two points on the image a known real-world distance apart, then enter that distance. The image scales about its own centre so those two points end up exactly that far apart." />
    </div>
    <div class="row">
      <button type="button" title="Click two points a known distance apart on the canvas" onclick={toggleCalibrate}>
        {calibration.active ? 'Cancel calibration' : 'Calibrate scale'}
      </button>
    </div>

    {#if calibration.points.length === 2}
      <div class="calib-form">
        <label>
          Real distance ({project.units})
          <input type="number" min="0" step="any" bind:value={realDistance} />
        </label>
        <div class="row">
          <button type="button" onclick={confirmCalibration}>Apply</button>
          <button type="button" class="danger" onclick={cancelCalibrationForm}>Cancel</button>
        </div>
      </div>
    {/if}
  {:else}
    <p class="hint">Load a photo or drawing to trace strips over.</p>
  {/if}
</div>

<style>
  .image-panel {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
  }
  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .filename {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .row {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  button {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    border-radius: 4px;
    padding: 0.35rem 0.6rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.8rem;
  }
  button:hover {
    filter: brightness(1.1);
  }
  button.danger {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
  }
  .calib-form {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
</style>
