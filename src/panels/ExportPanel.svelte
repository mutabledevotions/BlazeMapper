<script>
  import { project } from '../state/project.svelte.js'
  import { computePixels } from '../core/layout.js'
  import { toMapJSON, channelSummary } from '../core/export.js'

  const LIMITS = { RGB: 240, RGBW: 180 }

  const pixels = $derived(computePixels(project))
  const mapJSON = $derived(toMapJSON(pixels, project.export))
  const summary = $derived(channelSummary(pixels))

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
</script>

<div class="export-panel">
  <h3>Export</h3>

  <textarea bind:this={textareaEl} readonly rows="8">{mapJSON}</textarea>

  <div class="actions">
    <button onclick={onCopy}>{copyStatus || 'Copy'}</button>
    <button onclick={onDownload}>Download .json</button>
  </div>

  <div class="total">Total pixels: {pixels.length}</div>

  <table class="summary">
    <thead>
      <tr>
        <th>Ch</th>
        <th>Type</th>
        <th>Start</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      {#each summary as row}
        <tr class:over={row.count > LIMITS[row.colorType]}>
          <td>{row.channel}</td>
          <td>{row.colorType}</td>
          <td>{row.start}</td>
          <td>{row.count}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#each summary.filter((r) => r.count > LIMITS[r.colorType]) as row}
    <div class="warning">
      Channel {row.channel} has {row.count} {row.colorType} pixels, over the {LIMITS[row.colorType]} limit per Output
      Expander channel.
    </div>
  {/each}
</div>

<style>
  .export-panel {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }
  h3 {
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  button {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    border-radius: 4px;
    padding: 0.35rem 0.7rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .total {
    font-size: 0.85rem;
    color: var(--muted);
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
  .warning {
    background: #4a2c20;
    color: #ffcc80;
    border-radius: 4px;
    padding: 0.4rem 0.5rem;
    font-size: 0.8rem;
  }
</style>
