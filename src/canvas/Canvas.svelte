<script>
  // SVG canvas. World units = project units, y-down (matches Pixelblaze's own convention).
  // Pan: space+drag or middle-mouse drag. Zoom: wheel, anchored at the cursor.
  // Pan/zoom are bounded to the union of the canvas boundary rect and every strip's
  // bbox (plus a margin), so you can't scroll off into empty space forever.
  import { project, selection, view, setView, selectStrip, translateStrip, moveHandle, toggleSnap } from '../state/project.svelte.js'
  import { projectBbox } from '../core/layout.js'
  import Grid from './Grid.svelte'
  import StripView from './StripView.svelte'
  import Handles from './Handles.svelte'
  import { convert } from '../core/units.js'

  let svgEl
  let viewBox = $state({ x: -50, y: -50, w: 600, h: 450 })
  let spaceHeld = $state(false)
  let altHeld = $state(false)
  let panState = null // { startScreenX, startScreenY, startBox }
  let dragState = null // { stripId, startWorld, startGeomP0 }

  // World units per screen pixel. Labels, handles, markers multiply by this
  // so they keep a constant on-screen size at any zoom or unit.
  let clientSize = $state({ w: 1, h: 1 })
  const px = $derived(viewBox.w / clientSize.w)

  $effect(() => {
    // Keep viewBox aspect equal to the element's, so the visible area is exactly
    // the viewBox (grid and background then always fill the panel). First size -> fit.
    let first = true
    const ro = new ResizeObserver(() => {
      clientSize = { w: svgEl.clientWidth || 1, h: svgEl.clientHeight || 1 }
      if (first) {
        first = false
        fitView()
        return
      }
      const h = viewBox.w * (clientSize.h / clientSize.w)
      const cy = viewBox.y + viewBox.h / 2
      viewBox = { ...viewBox, y: cy - h / 2, h }
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

  // Publish the current view centre to the store so "Add strip" / "Add pixels" can place at it.
  $effect(() => {
    setView(viewBox.x + viewBox.w / 2, viewBox.y + viewBox.h / 2)
  })

  // Union of the canvas boundary rect and every strip's bbox -- the space pan/zoom are bounded to.
  function unionBox() {
    const rect = { minX: 0, minY: 0, maxX: project.canvas.w, maxY: project.canvas.h }
    const pb = projectBbox(project)
    if (!pb) return rect
    return {
      minX: Math.min(rect.minX, pb.minX),
      minY: Math.min(rect.minY, pb.minY),
      maxX: Math.max(rect.maxX, pb.maxX),
      maxY: Math.max(rect.maxY, pb.maxY)
    }
  }

  function minPitch() {
    const pitches = project.strips.filter((s) => s.geom.type === 'line').map((s) => s.pitch)
    return pitches.length ? Math.min(...pitches) : project.grid.size
  }

  function clampCenter(cx, cy, box) {
    const u = box || unionBox()
    const spanX = u.maxX - u.minX
    const spanY = u.maxY - u.minY
    const margin = Math.max(spanX, spanY) * 0.5 || project.grid.size * 10
    return {
      x: Math.min(Math.max(cx, u.minX - margin), u.maxX + margin),
      y: Math.min(Math.max(cy, u.minY - margin), u.maxY + margin)
    }
  }

  function fitView() {
    const u = unionBox()
    const w = Math.max(1, u.maxX - u.minX)
    const h = Math.max(1, u.maxY - u.minY)
    const margin = Math.max(w, h) * 0.1
    const cx = (u.minX + u.maxX) / 2
    const cy = (u.minY + u.maxY) / 2
    const aspect = clientSize.w / clientSize.h || 1
    let vw = w + margin * 2
    let vh = h + margin * 2
    if (vw / vh > aspect) vh = vw / aspect
    else vw = vh * aspect
    viewBox = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh }
  }

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
    const active = altHeld ? !project.grid.snap : project.grid.snap
    if (!active) return v
    const s = project.grid.size
    return Math.round(v / s) * s
  }

  // Figma-style: plain wheel / two-finger scroll pans; pinch (ctrlKey) or
  // Ctrl/Cmd+wheel zooms around the cursor.
  function onWheel(evt) {
    evt.preventDefault()
    if (!evt.ctrlKey && !evt.metaKey) {
      const lineScale = evt.deltaMode === 1 ? 16 : 1
      const c = clampCenter(
        viewBox.x + viewBox.w / 2 + evt.deltaX * lineScale * px,
        viewBox.y + viewBox.h / 2 + evt.deltaY * lineScale * px
      )
      viewBox = { ...viewBox, x: c.x - viewBox.w / 2, y: c.y - viewBox.h / 2 }
      return
    }
    const before = screenToWorld(evt)

    // Pinch deltas are small, a mouse notch is ~100: scale then clamp to +-8%.
    const factor = Math.min(1.08, Math.max(0.92, Math.exp(evt.deltaY * 0.01)))

    const u = unionBox()
    const unionW = u.maxX - u.minX || project.grid.size * 10
    const unionH = u.maxY - u.minY || project.grid.size * 10
    const aspect = clientSize.w / clientSize.h || 1
    // One scale for both axes so the aspect never drifts. Max: union fits 1.5x.
    const maxW = Math.max(unionW, unionH * aspect) * 1.5
    const minW = Math.max(minPitch() * 5, 1e-6)

    const newW = Math.min(maxW, Math.max(minW, viewBox.w * factor))
    const newH = newW / aspect
    viewBox = { ...viewBox, w: newW, h: newH }
    const after = screenToWorld(evt)
    let x = viewBox.x + (before.x - after.x)
    let y = viewBox.y + (before.y - after.y)
    const center = clampCenter(x + newW / 2, y + newH / 2, u)
    viewBox = { x: center.x - newW / 2, y: center.y - newH / 2, w: newW, h: newH }
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
      const rawX = panState.startBox.x - dx
      const rawY = panState.startBox.y - dy
      const center = clampCenter(rawX + viewBox.w / 2, rawY + viewBox.h / 2)
      viewBox = { ...panState.startBox, x: center.x - viewBox.w / 2, y: center.y - viewBox.h / 2 }
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
    moveHandle(stripId, handleId, pt, { shiftSnap: evt.shiftKey, resize: evt.ctrlKey || evt.metaKey })
  }

  function isTypingTarget() {
    const tag = document.activeElement?.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  }

  function onKeyDown(evt) {
    if (evt.key === 'Alt') altHeld = true
    if (isTypingTarget()) return
    if (evt.code === 'Space') {
      // Stop Space from "clicking" a focused toolbar button or scrolling the page.
      evt.preventDefault()
      spaceHeld = true
    }
    if (evt.key === 's' || evt.key === 'S') toggleSnap()
    if (evt.key === 'f' || evt.key === 'F') fitView()
  }
  function onKeyUp(evt) {
    if (evt.code === 'Space') spaceHeld = false
    if (evt.key === 'Alt') altHeld = false
  }

  const viewBoxStr = $derived(`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`)
  const boundaryLabel = $derived(`${project.canvas.w} × ${project.canvas.h} ${project.units}`)
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
  <rect
    class="boundary"
    x={0}
    y={0}
    width={project.canvas.w}
    height={project.canvas.h}
    fill="none"
    vector-effect="non-scaling-stroke"
  />
  <text class="boundary-label" x={project.canvas.w / 2} y={-8 * px} font-size={12 * px} text-anchor="middle">
    {boundaryLabel}
  </text>
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
    overflow: hidden;
    cursor: default;
  }
  .canvas.panning {
    cursor: grab;
  }
  .boundary {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 6 4;
    opacity: 0.6;
  }
  .boundary-label {
    fill: var(--muted);
    font-family: system-ui, sans-serif;
    user-select: none;
  }
</style>
