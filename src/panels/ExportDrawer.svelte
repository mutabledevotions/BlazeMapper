<script>
  // Collapsible bottom drawer (replaces the old right-sidebar export panel).
  // Header bar (pixel count, warnings badge, Copy) stays visible when collapsed.
  // Resizable by dragging the top edge.
  import { project, setExport } from '../state/project.svelte.js'
  import { computePixels } from '../core/layout.js'
  import { toMapJSON, channelSummary } from '../core/export.js'
  import { validateProject } from '../core/validate.js'
  import Help from './Help.svelte'

  const LIMITS = { RGB: 240, RGBW: 180 }

  const pixels = $derived(computePixels(project))
  const mapJSON = $derived(toMapJSON(pixels, { ...project.export, world: project.world }))
  const summary = $derived(channelSummary(pixels))
  const warnings = $derived(validateProject(project))
  const hasError = $derived(warnings.some((w) => w.level === 'error'))

  let collapsed = $state(true)
  let height = $state(260)
  let resizing = null

  let textareaEl
  let copyStatus = $state('')

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(mapJSON)
      copyStatus = 'Copied'
    } catch (err) {
      // Clipboard API can be unavailable (older WebKit, file:// in some browsers); fall back to select+execCommand.
      textareaEl.select()
      document.execCommand('copy')
      copyStatus = 'Copied'
    }
    setTimeout(() => (copyStatus = ''), 1500)
  }

  function onDownload() {
    const blob = new Blob([mapJSON], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pixelmap.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function onResizeStart(evt) {
    resizing = { startY: evt.clientY, startHeight: height }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeEnd)
  }
  function onResizeMove(evt) {
    if (!resizing) return
    const dy = resizing.startY - evt.clientY
    height = Math.min(640, Math.max(140, resizing.startHeight + dy))
  }
  function onResizeEnd() {
    resizing = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
  }
</script>

<div class="export-drawer" style:height={collapsed ? 'auto' : `${height}px`}>
  {#if !collapsed}
    <div class="resize-handle" onpointerdown={onResizeStart} title="Drag to resize"></div>
  {/if}
  <div class="header">
    <button class="collapse" onclick={() => (collapsed = !collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
      {collapsed ? '▲' : '▼'}
    </button>
    <span class="count">{pixels.length} pixel{pixels.length === 1 ? '' : 's'}</span>
    {#if warnings.length}
      <span class="badge" class:error={hasError}>{warnings.length} warning{warnings.length === 1 ? '' : 's'}</span>
    {/if}
    <span class="spacer"></span>
    <button onclick={onCopy}>{copyStatus || 'Copy'}</button>
    <button onclick={onDownload}>Download .json</button>
  </div>

  {#if !collapsed}
    <div class="body">
      <div class="main">
        <textarea bind:this={textareaEl} readonly>{mapJSON}</textarea>
        <p class="hint">
          Coordinates are normalized to the world box (0..1). Pixelblaze still rescales the map itself (Fill or Contain) --
          use <strong>Contain</strong> in the Mapper tab to keep the world box's aspect ratio instead of stretching it.
        </p>
        <label class="chk">
          <input
            type="checkbox"
            checked={project.export.anchors}
            onchange={(e) => setExport({ anchors: e.target.checked })}
          />
          Anchor world corners (experimental)
          <Help text="Experimental, untested on real hardware: appends the world box's own [0,0] and [1,1] corners to the map so Pixelblaze's Fill/Contain normalization can't shift or shrink the layout. Not counted in the pixel total or channel summary." />
        </label>
        <label class="gap-opt">
          <span class="label-row">
            Gap placeholder
            <Help text="Pixelblaze's map is dense (array index = LED index), so an unaddressed LED on the wire still needs a map entry. 'Previous LED' repeats the coordinate of the last real LED before the gap (the first real LED, if the channel starts with a gap). 'World origin' puts gap placeholders at the world box's origin instead. Either way, gap LEDs count toward the channel's total and the 240 RGB / 180 RGBW limit." />
          </span>
          <select value={project.export.gapPlaceholder} onchange={(e) => setExport({ gapPlaceholder: e.target.value })}>
            <option value="previous">Previous LED</option>
            <option value="origin">World origin</option>
          </select>
        </label>
      </div>

      <div class="side">
        <table class="summary">
          <thead>
            <tr>
              <th>Ch</th>
              <th>Type</th>
              <th>Start</th>
              <th>Used</th>
              <th>Gaps</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {#each summary as row}
              <tr class:over={row.count > LIMITS[row.colorType]}>
                <td>{row.channel}</td>
                <td>{row.colorType}</td>
                <td>{row.start}</td>
                <td>{row.used}</td>
                <td>{row.gaps}</td>
                <td>{row.count}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#if warnings.length}
          <div class="warnings">
            {#each warnings as w}
              <div class="warning" class:error={w.level === 'error'}>{w.message}</div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .export-drawer {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--panel-bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .resize-handle {
    position: absolute;
    top: -3px;
    left: 0;
    right: 0;
    height: 6px;
    cursor: ns-resize;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    border-bottom: 1px solid var(--border);
  }
  .collapse {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0.1rem 0.3rem;
  }
  .count {
    color: var(--muted);
  }
  .badge {
    background: #4a2c20;
    color: #ffcc80;
    border-radius: 999px;
    padding: 0.1rem 0.6rem;
    font-size: 0.75rem;
  }
  .badge.error {
    background: #5a1f1f;
    color: #ff8a80;
  }
  .spacer {
    flex: 1;
  }
  .header button:not(.collapse) {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    border-radius: 4px;
    padding: 0.3rem 0.7rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .body {
    flex: 1;
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    min-height: 0;
  }
  .main {
    flex: 1.3;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-height: 0;
  }
  textarea {
    flex: 1;
    box-sizing: border-box;
    resize: none;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem;
  }
  .main .hint {
    color: var(--muted);
    font-size: 0.75rem;
    margin: 0;
  }
  .gap-opt {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .main .chk {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--fg);
  }
  .side {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    min-width: 0;
  }
  .summary {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .summary th,
  .summary td {
    text-align: left;
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--border);
  }
  .summary tr.over {
    color: #ff8a65;
  }
  .warnings {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .warning {
    background: #4a2c20;
    color: #ffcc80;
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    font-size: 0.78rem;
  }
  .warning.error {
    background: #5a1f1f;
    color: #ff8a80;
  }
</style>
