<script>
  import {
    project,
    selection,
    keys,
    ui,
    toolState,
    historyStatus,
    wiringPreview,
    toggleSnap,
    setLockPitch,
    setOpenPopup,
    closeOpenPopup,
    duplicateSelected,
    mirrorSelected,
    rotateSelectedBy,
    toggleWiringPreview,
    setWiringSpeed,
    setWiringLabels
  } from '../state/project.svelte.js'
  import { undo, redo } from '../state/history.js'
  import AddStripsDialog from './AddStripsDialog.svelte'
  import ImagePanel from './ImagePanel.svelte'
  import GridPanel from './GridPanel.svelte'
  import WorldPanel from './WorldPanel.svelte'
  import AddPixelsDialog from './AddPixelsDialog.svelte'
  import Help from './Help.svelte'

  let stripsDialog
  let pixelsDialog
  let toolbarEl

  const hasSelection = $derived(selection.ids.length > 0)

  // Snap button shows the *effective* state (grid.snap XOR Alt held), matching
  // what dragging would actually do right now.
  const effectiveSnap = $derived(project.grid.snap !== keys.alt)

  // Keeps --toolbar-h current on the document root so the Grid/World/Reference
  // image popups (app.css .floating-panel) stay anchored just under the
  // toolbar even as it wraps onto a second row at narrow widths.
  $effect(() => {
    if (!toolbarEl) return
    const root = document.documentElement
    const set = () => root.style.setProperty('--toolbar-h', `${toolbarEl.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(toolbarEl)
    return () => ro.disconnect()
  })
</script>

<div class="toolbar" bind:this={toolbarEl}>
  <div class="tb-section">
    <button onclick={() => stripsDialog.open('line')}>Add strip</button>
    <button onclick={() => pixelsDialog.open()}>Add pixels</button>
    <button title="Add an arc, circle, or polygon strip" onclick={() => stripsDialog.open('shape')}>Add shape</button>
    <button title="Add a cubic bezier strip" onclick={() => stripsDialog.open('bezier')}>Add Bezier</button>
  </div>

  <span class="sep"></span>

  <div class="tb-section">
    <button class="icon-only" title="Undo (Ctrl/Cmd+Z)" disabled={!historyStatus.canUndo} onclick={undo}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <path d="M4 7h6a3.5 3.5 0 1 1 0 7H7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        <path d="M4 7 L7 4 M4 7 L7 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button class="icon-only" title="Redo (Shift+Ctrl/Cmd+Z or Ctrl+Y)" disabled={!historyStatus.canRedo} onclick={redo}>
      <svg viewBox="0 0 16 16" width="15" height="15">
        <path d="M12 7H6a3.5 3.5 0 1 0 0 7h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        <path d="M12 7 L9 4 M12 7 L9 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>

  <span class="sep"></span>

  <div class="tb-section">
    <button
      class="toggle-indicator"
      class:active={wiringPreview.active}
      title="Toggle wiring preview: animates a highlight chasing the wire order (hotkey: W)"
      onclick={toggleWiringPreview}
    >
      Wiring {wiringPreview.active ? 'on' : 'off'}
    </button>
    {#if wiringPreview.active}
      <label class="num">
        <span class="label-row">
          Speed
          <Help text="LEDs per second the wiring preview's highlight moves through the chase (global index) order." />
        </span>
        <input
          type="range"
          min="1"
          max="200"
          step="1"
          value={wiringPreview.speed}
          oninput={(e) => setWiringSpeed(parseFloat(e.target.value))}
        />
      </label>
      <label class="chk">
        <input type="checkbox" checked={wiringPreview.showLabels} onchange={(e) => setWiringLabels(e.target.checked)} />
        Labels
        <Help text="Shows each LED's global index next to it, but only once zoomed in enough to read (on-screen LED spacing over ~14px)." />
      </label>
    {/if}
  </div>

  <span class="sep"></span>

  <div class="tb-section">
    <button
      class="toggle-indicator"
      class:active={effectiveSnap}
      title="Snap to grid (hotkey: S). Off by default: hold Alt while dragging to snap; with snap on, Alt turns it off."
      onclick={toggleSnap}
    >
      Snap {effectiveSnap ? 'on' : 'off'}
      <span class="key-badge" class:active={keys.alt}>Alt</span>
    </button>
  </div>

  <span class="sep"></span>

  <div class="tb-section">
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

  <div class="tb-section right">
    <button
      class="popup-toggle"
      class:active={ui.openPopup === 'grid'}
      title="Grid: show/hide, divisions"
      onclick={() => setOpenPopup('grid')}
    >
      Grid
    </button>
    <button
      class="popup-toggle"
      class:active={ui.openPopup === 'world'}
      title="World box: origin, size, units"
      onclick={() => setOpenPopup('world')}
    >
      World
    </button>
    <button
      class="popup-toggle"
      class:active={ui.openPopup === 'image'}
      title="Reference image: load, position, opacity, calibrate"
      onclick={() => setOpenPopup('image')}
    >
      Reference image
    </button>
  </div>
</div>

<AddStripsDialog bind:this={stripsDialog} />
<AddPixelsDialog bind:this={pixelsDialog} />
<GridPanel open={ui.openPopup === 'grid'} onClose={closeOpenPopup} />
<WorldPanel open={ui.openPopup === 'world'} onClose={closeOpenPopup} />
<ImagePanel open={ui.openPopup === 'image'} onClose={closeOpenPopup} />

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: var(--space-2) var(--space-4);
    background: var(--panel-bg);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  /* One run of controls between dividers: nowrap so the toolbar only ever
     wraps whole sections onto the next row. A section may wrap internally
     only as a last resort, if it alone is wider than the toolbar. */
  .tb-section {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.6rem;
    max-width: 100%;
  }
  .tb-section.right {
    margin-left: auto;
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
  .num {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
  .num input {
    width: 4.5rem;
  }
  .label-row {
    width: 100%;
  }
  button {
    background: var(--accent);
    color: #0b0d10;
    border: none;
    border-radius: 4px;
    height: var(--control-h);
    padding: 0 0.8rem;
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
  .icon-only {
    padding: 0 0.5rem;
  }
  /* Fixed footprints: text that changes (on/off, step, units) must not
     resize its item and shift the rest of the toolbar. */
  .toggle-indicator {
    width: 8.5rem;
    flex-shrink: 0;
    justify-content: center;
    background: var(--input-bg);
    color: var(--muted);
    border: 1px solid var(--border);
    font-weight: 500;
  }
  .toggle-indicator.active {
    background: var(--accent-dim);
    color: var(--accent);
    border-color: var(--accent);
  }
  /* Same active styling as .toggle-indicator, but these three labels (Grid,
     World, Reference image) never change text, so no fixed width is needed. */
  .popup-toggle {
    flex-shrink: 0;
    white-space: nowrap;
    background: var(--input-bg);
    color: var(--muted);
    border: 1px solid var(--border);
    font-weight: 500;
  }
  .popup-toggle.active {
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
</style>
