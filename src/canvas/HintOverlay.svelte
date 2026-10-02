<script>
  // Context hotkey hint, floating in the bottom-left of the canvas viewport.
  // Overlay (pointer-events: none) so it never affects layout or clicks.
  import { selection, ui, calibration } from '../state/project.svelte.js'
  import { contextHint } from '../state/hotkeys.js'

  const hintText = $derived.by(() => {
    if (ui.typing) return ''
    if (calibration.active) return contextHint('calibrate')
    if (ui.dragMode === 'endHandle') return contextHint('endHandleDrag')
    if (ui.dragMode === 'groupResize') return contextHint('groupResizeDrag')
    return selection.ids.length > 0 ? contextHint('selection') : contextHint('idle')
  })
</script>

{#if hintText}
  <div class="hint-overlay">{hintText}</div>
{/if}

<style>
  .hint-overlay {
    position: absolute;
    left: 12px;
    bottom: 12px;
    max-width: calc(100% - 24px);
    padding: 0.35rem 0.7rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel-bg) 88%, transparent);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.78rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    z-index: 5;
  }
</style>
