<script>
  // SVG canvas. World units = project units, y-down (matches Pixelblaze's own convention).
  // Pan: space+drag or middle-mouse drag. Zoom: wheel, anchored at the cursor.
  import { project, selection, selectStrip, translateStrip, moveHandle } from '../state/project.svelte.js'
  import Grid from './Grid.svelte'
  import StripView from './StripView.svelte'
  import Handles from './Handles.svelte'
  import { convert } from '../core/units.js'

  let svgEl
  let viewBox = $state({ x: -50, y: -50, w: 600, h: 450 })
  let spaceHeld = $state(false)
  let panState = null // { startScreenX, startScreenY, startBox }
  let dragState = null // { stripId, startWorld, startGeomP0 }

  // World units per screen pixel. Labels, handles, markers multiply by this
  // so they keep a constant on-screen size at any zoom or unit.
  let clientSize = $state({ w: 1, h: 1 })
  const px = $derived(Math.max(viewBox.w / clientSize.w, viewBox.h / clientSize.h))

  $effect(() => {
    const ro = new ResizeObserver(() => {
      clientSize = { w: svgEl.clientWidth || 1, h: svgEl.clientHeight || 1 }
    })
    ro.observe(svgEl)
    return () => ro.disconnect()
  })

  // Rescale the view with the geometry when units change, so the picture stays put.
  let lastUnits = project.units
  $effect(() => {
    const u = project.units
    if (u === lastUnits) return
    const k = convert(1, lastUnits, u)
    lastUnits = u
    viewBox = { x: viewBox.x * k, y: viewBox.y * k, w: viewBox.w * k, h: viewBox.h * k }
  })

  function screenToWorld(evt) {
    const pt = svgEl.createSVGPoint()
    pt.x = evt.clientX
    pt.y = evt.clientY
    const ctm = svgEl.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const world = pt.matrixTransform(ctm.inverse())
    return { x: world.x, y: world.y }
  }

  function snap(v) {
    if (!project.grid.snap) return v
    const s = project.grid.size
    return Math.round(v / s) * s
  }

  function onWheel(evt) {
    evt.preventDefault()
    const before = screenToWorld(evt)
    const factor = evt.deltaY > 0 ? 1.1 : 1 / 1.1
    const newW = viewBox.w * factor
    const newH = viewBox.h * factor
    viewBox = { ...viewBox, w: newW, h: newH }
    const after = screenToWorld(evt)
    viewBox = { ...viewBox, x: viewBox.x + (before.x - after.x), y: viewBox.y + (before.y - after.y) }
  }

  function onPointerDown(evt) {
    const isPanTrigger = evt.button === 1 || (evt.button === 0 && spaceHeld)
    if (isPanTrigger) {
      panState = { startClientX: evt.clientX, startClientY: evt.clientY, startBox: { ...viewBox } }
      svgEl.setPointerCapture(evt.pointerId)
      evt.preventDefault()
      return
    }
    if (evt.button === 0 && evt.target === svgEl) {
      selectStrip(null)
    }
  }

  function onPointerMove(evt) {
    if (panState) {
      const dx = (evt.clientX - panState.startClientX) * px
      const dy = (evt.clientY - panState.startClientY) * px
      viewBox = { ...panState.startBox, x: panState.startBox.x - dx, y: panState.startBox.y - dy }
      return
    }
    if (dragState) {
      const world = screenToWorld(evt)
      const dx = snap(world.x - dragState.startWorld.x)
      const dy = snap(world.y - dragState.startWorld.y)
      if (dx !== dragState.lastDx || dy !== dragState.lastDy) {
        translateStrip(dragState.stripId, dx - dragState.lastDx, dy - dragState.lastDy)
        dragState.lastDx = dx
        dragState.lastDy = dy
      }
    }
  }

  function onPointerUp(evt) {
    if (panState) {
      panState = null
      svgEl.releasePointerCapture(evt.pointerId)
    }
    if (dragState) {
      svgEl.releasePointerCapture(evt.pointerId)
      dragState = null
    }
  }

  function startStripDrag(stripId, evt) {
    selectStrip(stripId)
    dragState = { stripId, startWorld: screenToWorld(evt), lastDx: 0, lastDy: 0 }
    svgEl.setPointerCapture(evt.pointerId)
    evt.stopPropagation()
  }

  function onHandleDrag(stripId, handleId, evt) {
    const world = screenToWorld(evt)
    const pt = { x: snap(world.x), y: snap(world.y) }
    moveHandle(stripId, handleId, pt, { shiftSnap: evt.shiftKey })
  }

  function onKeyDown(evt) {
    if (evt.code === 'Space') spaceHeld = true
  }
  function onKeyUp(evt) {
    if (evt.code === 'Space') spaceHeld = false
  }

  const viewBoxStr = $derived(`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`)
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<svg
  bind:this={svgEl}
  class="canvas"
  class:panning={spaceHeld}
  viewBox={viewBoxStr}
  preserveAspectRatio="xMidYMid meet"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
>
  <rect x={viewBox.x - 10000} y={viewBox.y - 10000} width="20000" height="20000" fill="var(--canvas-bg)" />
  {#if project.grid.show}
    <Grid {viewBox} size={project.grid.size} />
  {/if}
  {#each project.strips as strip (strip.id)}
    {#if !strip.hidden}
      <StripView
        {strip}
        selected={selection.stripId === strip.id}
        {px}
        onDragStart={(evt) => startStripDrag(strip.id, evt)}
      />
    {/if}
  {/each}
  {#each project.strips as strip (strip.id)}
    {#if selection.stripId === strip.id && !strip.hidden}
      <Handles {strip} {px} onHandleDrag={(handleId, evt) => onHandleDrag(strip.id, handleId, evt)} />
    {/if}
  {/each}
</svg>

<style>
  .canvas {
    width: 100%;
    height: 100%;
    display: block;
    background: var(--canvas-bg, #1b1e24);
    touch-action: none;
    cursor: default;
  }
  .canvas.panning {
    cursor: grab;
  }
</style>
