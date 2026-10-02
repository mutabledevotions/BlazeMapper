<script>
  import Toolbar from './panels/Toolbar.svelte'
  import StripList from './panels/StripList.svelte'
  import StripProps from './panels/StripProps.svelte'
  import ExportDrawer from './panels/ExportDrawer.svelte'
  import Canvas from './canvas/Canvas.svelte'
  import { setKeyState, clearKeys, setTyping } from './state/project.svelte.js'

  // Single window-level listener for the live modifier-key state (keys in the
  // store) that the Snap button, drag badges, and the hotkey hint line all read.
  // Cleared on blur so a key can't get stuck "held" after losing focus mid-press.
  function onWindowKeyDown(evt) {
    if (evt.key === 'Alt') setKeyState({ alt: true })
    if (evt.key === 'Shift') setKeyState({ shift: true })
    if (evt.key === 'Meta') setKeyState({ meta: true })
    if (evt.key === 'Control') setKeyState({ ctrl: true })
    if (evt.code === 'Space') setKeyState({ space: true })
  }
  function onWindowKeyUp(evt) {
    if (evt.key === 'Alt') setKeyState({ alt: false })
    if (evt.key === 'Shift') setKeyState({ shift: false })
    if (evt.key === 'Meta') setKeyState({ meta: false })
    if (evt.key === 'Control') setKeyState({ ctrl: false })
    if (evt.code === 'Space') setKeyState({ space: false })
  }

  // Tracks whether a text field/select/textarea has focus, so the toolbar's
  // hotkey hint line can hide itself while typing.
  function onWindowFocusIn(evt) {
    const tag = evt.target?.tagName
    setTyping(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')
  }
  function onWindowFocusOut() {
    setTyping(false)
  }

  // Strips / Strip properties share the left sidebar as a vertical split so
  // neither pane can grow large enough to cover the other. splitPct is the
  // top pane's share of the sidebar's height; MIN_PANE is enforced in px on
  // both panes so each stays reachable at any window height.
  const MIN_PANE = 80
  const SPLIT_KEY = 'pixelmapper.sidebarSplit'

  function loadSplit() {
    try {
      const v = parseFloat(localStorage.getItem(SPLIT_KEY))
      if (v > 0 && v < 1) return v
    } catch (err) {
      // localStorage unavailable (private browsing, file://) -- fall back to default.
    }
    return 0.5
  }

  let splitPct = $state(loadSplit())
  let sidebarEl
  let dragging = null // { startY, startPct, sidebarHeight }

  function saveSplit(v) {
    try {
      localStorage.setItem(SPLIT_KEY, String(v))
    } catch (err) {
      // Ignore -- persistence is a convenience, not a requirement.
    }
  }

  function onDividerPointerDown(evt) {
    const rect = sidebarEl.getBoundingClientRect()
    dragging = { startY: evt.clientY, startPct: splitPct, sidebarHeight: rect.height }
    evt.currentTarget.setPointerCapture(evt.pointerId)
  }

  function onDividerPointerMove(evt) {
    if (!dragging) return
    const h = dragging.sidebarHeight
    if (h <= 0) return
    const dy = evt.clientY - dragging.startY
    const minPct = MIN_PANE / h
    const maxPct = 1 - MIN_PANE / h
    splitPct = Math.min(maxPct, Math.max(minPct, dragging.startPct + dy / h))
  }

  function onDividerPointerUp(evt) {
    if (!dragging) return
    dragging = null
    saveSplit(splitPct)
    evt.currentTarget.releasePointerCapture?.(evt.pointerId)
  }
</script>

<svelte:window
  onkeydown={onWindowKeyDown}
  onkeyup={onWindowKeyUp}
  onblur={clearKeys}
  onfocusin={onWindowFocusIn}
  onfocusout={onWindowFocusOut}
/>

<div class="app">
  <div class="toolbar-row">
    <Toolbar />
  </div>
  <div class="body">
    <aside class="sidebar left" bind:this={sidebarEl}>
      <div class="pane" style:flex-basis="{splitPct * 100}%">
        <StripList />
      </div>
      <div
        class="divider"
        role="separator"
        aria-orientation="horizontal"
        title="Drag to resize"
        onpointerdown={onDividerPointerDown}
        onpointermove={onDividerPointerMove}
        onpointerup={onDividerPointerUp}
      ></div>
      <div class="pane" style:flex-basis="{(1 - splitPct) * 100}%">
        <StripProps />
      </div>
    </aside>
    <main class="canvas-area">
      <Canvas />
    </main>
  </div>
  <ExportDrawer />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .sidebar {
    width: 260px;
    flex-shrink: 0;
    background: var(--panel-bg);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .sidebar.left {
    border-right: 1px solid var(--border);
  }
  .pane {
    min-height: 80px;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  .divider {
    flex-shrink: 0;
    height: 6px;
    cursor: row-resize;
    background: var(--border);
    touch-action: none;
  }
  .divider:hover {
    background: var(--accent);
  }
  .canvas-area {
    flex: 1;
    min-width: 0;
  }
</style>
