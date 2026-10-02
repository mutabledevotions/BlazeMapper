<script>
  // SVG canvas. World units = project units, y-down (matches Pixelblaze's own convention).
  // Pan: space+drag or middle-mouse drag. Zoom: wheel, anchored at the cursor.
  // Pan/zoom are bounded to the union of the world box and every strip's bbox
  // (plus a margin), so you can't scroll off into empty space forever.
  import {
    project,
    selection,
    view,
    keys,
    ui,
    setDragMode,
    setView,
    selectStrip,
    selectStrips,
    toggleSelect,
    clearSelection,
    removeSelected,
    translateStrip,
    translateStrips,
    rotateSelected,
    moveHandle,
    toggleSnap,
    moveWorldOrigin,
    resizeWorld
  } from '../state/project.svelte.js'
  import { projectBbox, stripsBbox } from '../core/layout.js'
  import { sample as geomSample } from '../core/geometry/index.js'
  import { gridStep } from '../core/model.js'
  import Grid from './Grid.svelte'
  import StripView from './StripView.svelte'
  import Handles from './Handles.svelte'
  import { convert } from '../core/units.js'

  let svgEl
  let viewBox = $state({ x: -50, y: -50, w: 600, h: 450 })
  let panState = null // { startScreenX, startScreenY, startBox }
  let dragState = null // { ids, startWorld, lastDx, lastDy }
  let marqueeState = $state(null) // { start, current, additive }
  let worldDragState = null // { startWorld, lastDx, lastDy }
  let worldResizeState = null
  let rotateState = null // { center, startAngle, lastDeg }
  // World-space position of the handle currently being dragged, for the small
  // "15°" / "LED count" modifier badges -- null when nothing is being dragged.
  let dragHandlePos = $state(null)
  let rotateHandlePos = $state(null)

  // World units per screen pixel. Labels, handles, markers multiply by this
  // so they keep a constant on-screen size at any zoom or unit.
  let clientSize = $state({ w: 1, h: 1 })
  const px = $derived(viewBox.w / clientSize.w)

  const selectedStrips = $derived(project.strips.filter((s) => selection.ids.includes(s.id)))
  const groupBbox = $derived(selectedStrips.length >= 2 ? stripsBbox(selectedStrips) : null)

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

  // Union of the world box and every strip's bbox -- the space pan/zoom are bounded to.
  function unionBox() {
    const w = project.world
    const rect = { minX: w.x, minY: w.y, maxX: w.x + w.size, maxY: w.y + w.size }
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
    return pitches.length ? Math.min(...pitches) : gridStep(project)
  }

  function clampCenter(cx, cy, box) {
    const u = box || unionBox()
    const spanX = u.maxX - u.minX
    const spanY = u.maxY - u.minY
    const margin = Math.max(spanX, spanY) * 0.5 || gridStep(project) * 10
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

  // Snap step = world.size / grid.divisions, snapped relative to the world origin
  // so grid lines, handles, and dragged geometry all agree on where "on-grid" is.
  function snap(v, origin = 0) {
    const active = keys.alt ? !project.grid.snap : project.grid.snap
    if (!active) return v
    const s = gridStep(project)
    return origin + Math.round((v - origin) / s) * s
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
    const unionW = u.maxX - u.minX || gridStep(project) * 10
    const unionH = u.maxY - u.minY || gridStep(project) * 10
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
    const isPanTrigger = evt.button === 1 || (evt.button === 0 && keys.space)
    if (isPanTrigger) {
      panState = { startClientX: evt.clientX, startClientY: evt.clientY, startBox: { ...viewBox } }
      svgEl.setPointerCapture(evt.pointerId)
      evt.preventDefault()
      return
    }
    // Left-drag starting on empty canvas draws a marquee; a plain click (no drag)
    // clears the selection, resolved in onPointerUp once we know it didn't move.
    // Strips, handles, and the world box all stopPropagation() in their own
    // pointerdown handlers, so reaching here means the click landed on empty space
    // (background, grid lines) -- not on svgEl specifically, which fill/stroke
    // hit-testing on the background rect and grid lines would otherwise rule out.
    if (evt.button === 0) {
      const start = screenToWorld(evt)
      marqueeState = { start, current: start, additive: evt.shiftKey || evt.metaKey }
      svgEl.setPointerCapture(evt.pointerId)
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
    if (marqueeState) {
      marqueeState = { ...marqueeState, current: screenToWorld(evt) }
      return
    }
    if (worldDragState) {
      const world = screenToWorld(evt)
      const dx = snap(world.x - worldDragState.startWorld.x, worldDragState.startOrigin.x)
      const dy = snap(world.y - worldDragState.startWorld.y, worldDragState.startOrigin.y)
      if (dx !== worldDragState.lastDx || dy !== worldDragState.lastDy) {
        moveWorldOrigin(dx - worldDragState.lastDx, dy - worldDragState.lastDy)
        worldDragState.lastDx = dx
        worldDragState.lastDy = dy
      }
      return
    }
    if (worldResizeState) {
      const pt = screenToWorld(evt)
      const w = project.world
      const size = Math.max(snap(Math.max(pt.x - w.x, pt.y - w.y)), minPitch())
      resizeWorld(size)
      return
    }
    if (rotateState) {
      const pt = screenToWorld(evt)
      const angle = (Math.atan2(pt.y - rotateState.center.y, pt.x - rotateState.center.x) * 180) / Math.PI
      const step = evt.shiftKey ? 15 : 0.5
      let delta = Math.round((angle - rotateState.startAngle) / step) * step
      if (delta !== rotateState.lastDeg) {
        rotateSelected(delta - rotateState.lastDeg, rotateState.center)
        rotateState.lastDeg = delta
      }
      rotateHandlePos = pt
      return
    }
    if (dragState) {
      const world = screenToWorld(evt)
      const dx = snap(world.x - dragState.startWorld.x, project.world.x)
      const dy = snap(world.y - dragState.startWorld.y, project.world.y)
      if (dx !== dragState.lastDx || dy !== dragState.lastDy) {
        translateStrips(dragState.ids, dx - dragState.lastDx, dy - dragState.lastDy)
        dragState.lastDx = dx
        dragState.lastDy = dy
      }
    }
  }

  function marqueeRect() {
    const { start, current } = marqueeState
    return {
      minX: Math.min(start.x, current.x),
      minY: Math.min(start.y, current.y),
      maxX: Math.max(start.x, current.x),
      maxY: Math.max(start.y, current.y)
    }
  }

  function onPointerUp(evt) {
    if (panState) {
      panState = null
      svgEl.releasePointerCapture(evt.pointerId)
    }
    if (marqueeState) {
      const r = marqueeRect()
      const moved = r.maxX - r.minX > 2 * px || r.maxY - r.minY > 2 * px
      if (!moved) {
        if (!marqueeState.additive) clearSelection()
      } else {
        const ids = project.strips
          .filter((s) => !s.hidden)
          .filter((s) => {
            const pts = geomSample(s.geom, s)
            return pts.some((p) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY)
          })
          .map((s) => s.id)
        selectStrips(ids, marqueeState.additive)
      }
      marqueeState = null
      svgEl.releasePointerCapture(evt.pointerId)
    }
    if (worldDragState) {
      worldDragState = null
      svgEl.releasePointerCapture(evt.pointerId)
    }
    if (worldResizeState) {
      worldResizeState = null
      svgEl.releasePointerCapture(evt.pointerId)
    }
    if (rotateState) {
      rotateState = null
      rotateHandlePos = null
      svgEl.releasePointerCapture(evt.pointerId)
    }
    if (dragState) {
      svgEl.releasePointerCapture(evt.pointerId)
      dragState = null
    }
    dragHandlePos = null
    setDragMode(null)
  }

  // pointerdown on an already-selected strip drags the whole selection; on an
  // unselected strip it selects just that one (or toggles it with shift) and
  // drags only it.
  function startStripDrag(stripId, evt) {
    let ids
    if (selection.ids.includes(stripId)) {
      ids = selection.ids.slice()
    } else {
      if (evt.shiftKey || evt.metaKey) toggleSelect(stripId)
      else selectStrip(stripId)
      ids = [stripId]
    }
    const unlockedIds = ids.filter((id) => {
      const s = project.strips.find((st) => st.id === id)
      return s && !s.locked
    })
    dragState = { ids: unlockedIds, startWorld: screenToWorld(evt), lastDx: 0, lastDy: 0 }
    svgEl.setPointerCapture(evt.pointerId)
    evt.stopPropagation()
  }

  function onHandleDrag(stripId, handleId, evt) {
    const world = screenToWorld(evt)
    const pt = { x: snap(world.x, project.world.x), y: snap(world.y, project.world.y) }
    moveHandle(stripId, handleId, pt, { shiftSnap: evt.shiftKey, resize: evt.ctrlKey || evt.metaKey })
    if (handleId === 'end') {
      dragHandlePos = pt
      setDragMode('endHandle')
    }
  }

  function startWorldDrag(evt) {
    evt.stopPropagation()
    worldDragState = {
      startWorld: screenToWorld(evt),
      startOrigin: { x: project.world.x, y: project.world.y },
      lastDx: 0,
      lastDy: 0
    }
    svgEl.setPointerCapture(evt.pointerId)
  }

  function startWorldResize(evt) {
    evt.stopPropagation()
    worldResizeState = true
    svgEl.setPointerCapture(evt.pointerId)
  }

  function startGroupRotate(evt) {
    evt.stopPropagation()
    if (!groupBbox) return
    const center = { x: (groupBbox.minX + groupBbox.maxX) / 2, y: (groupBbox.minY + groupBbox.maxY) / 2 }
    const start = screenToWorld(evt)
    const startAngle = (Math.atan2(start.y - center.y, start.x - center.x) * 180) / Math.PI
    rotateState = { center, startAngle, lastDeg: 0 }
    svgEl.setPointerCapture(evt.pointerId)
  }

  function isTypingTarget() {
    const tag = document.activeElement?.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  }

  // keys.* (alt/shift/meta/ctrl/space) is tracked globally by App.svelte's window
  // listener, shared by the Snap button, drag badges, and the hotkey hint line.
  function onKeyDown(evt) {
    if (isTypingTarget()) return
    if (evt.code === 'Space') {
      // Stop Space from "clicking" a focused toolbar button or scrolling the page.
      evt.preventDefault()
    }
    if (evt.key === 's' || evt.key === 'S') toggleSnap()
    if (evt.key === 'f' || evt.key === 'F') fitView()
    if (evt.key === 'Escape') clearSelection()
    if (evt.key === 'Delete' || evt.key === 'Backspace') {
      if (selection.ids.length) {
        evt.preventDefault()
        removeSelected()
      }
    }
  }
  function onKeyUp() {}

  const viewBoxStr = $derived(`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`)
  const worldLabel = $derived(`${project.world.size} × ${project.world.size} ${project.units}`)
  const handleSize = $derived(10 * px)
  const marqueeRectView = $derived(marqueeState ? marqueeRect() : null)
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<svg
  bind:this={svgEl}
  class="canvas"
  class:panning={keys.space}
  viewBox={viewBoxStr}
  preserveAspectRatio="xMidYMid meet"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
>
  <rect x={viewBox.x - 10000} y={viewBox.y - 10000} width="20000" height="20000" fill="var(--canvas-bg)" />
  {#if project.grid.show}
    <Grid {viewBox} size={gridStep(project)} originX={project.world.x} originY={project.world.y} />
  {/if}
  <rect
    class="world-box"
    x={project.world.x}
    y={project.world.y}
    width={project.world.size}
    height={project.world.size}
    fill="none"
    vector-effect="non-scaling-stroke"
    onpointerdown={startWorldDrag}
  />
  <text
    class="world-label"
    x={project.world.x + 6 * px}
    y={project.world.y - 8 * px}
    font-size={12 * px}
    onpointerdown={startWorldDrag}
  >
    {worldLabel}
  </text>
  <rect
    class="world-handle"
    x={project.world.x + project.world.size - handleSize / 2}
    y={project.world.y + project.world.size - handleSize / 2}
    width={handleSize}
    height={handleSize}
    vector-effect="non-scaling-stroke"
    onpointerdown={startWorldResize}
  ><title>Drag to resize the world box (top-left stays fixed)</title></rect>

  {#each project.strips as strip (strip.id)}
    {#if !strip.hidden}
      <StripView
        {strip}
        selected={selection.ids.includes(strip.id)}
        {px}
        onDragStart={(evt) => startStripDrag(strip.id, evt)}
      />
    {/if}
  {/each}
  {#each project.strips as strip (strip.id)}
    {#if selection.ids.length === 1 && selection.primary === strip.id && !strip.hidden}
      <Handles {strip} {px} onHandleDrag={(handleId, evt) => onHandleDrag(strip.id, handleId, evt)} />
    {/if}
  {/each}

  {#if groupBbox}
    <rect
      class="group-bbox"
      x={groupBbox.minX}
      y={groupBbox.minY}
      width={groupBbox.maxX - groupBbox.minX}
      height={groupBbox.maxY - groupBbox.minY}
      fill="none"
      vector-effect="non-scaling-stroke"
    />
    <line
      class="group-rotate-stem"
      x1={(groupBbox.minX + groupBbox.maxX) / 2}
      y1={groupBbox.minY}
      x2={(groupBbox.minX + groupBbox.maxX) / 2}
      y2={groupBbox.minY - 24 * px}
      vector-effect="non-scaling-stroke"
    />
    <circle
      class="group-rotate-handle"
      cx={(groupBbox.minX + groupBbox.maxX) / 2}
      cy={groupBbox.minY - 24 * px}
      r={6 * px}
      onpointerdown={startGroupRotate}
    ><title>Drag to rotate the selection (0.5° steps, Shift = 15°)</title></circle>
  {/if}

  {#if dragHandlePos && ui.dragMode === 'endHandle' && keys.shift}
    <text class="mod-badge" x={dragHandlePos.x + 14 * px} y={dragHandlePos.y - 14 * px} font-size={11 * px}>15°</text>
  {/if}
  {#if dragHandlePos && ui.dragMode === 'endHandle' && (keys.ctrl || keys.meta)}
    <text class="mod-badge" x={dragHandlePos.x + 14 * px} y={dragHandlePos.y + 22 * px} font-size={11 * px}>LED count</text>
  {/if}
  {#if rotateHandlePos && keys.shift}
    <text class="mod-badge" x={rotateHandlePos.x + 14 * px} y={rotateHandlePos.y - 14 * px} font-size={11 * px}>15°</text>
  {/if}

  {#if marqueeRectView}
    <rect
      class="marquee"
      x={marqueeRectView.minX}
      y={marqueeRectView.minY}
      width={marqueeRectView.maxX - marqueeRectView.minX}
      height={marqueeRectView.maxY - marqueeRectView.minY}
      vector-effect="non-scaling-stroke"
    />
  {/if}
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
  .world-box {
    stroke: var(--muted);
    stroke-width: 1.5;
    opacity: 0.8;
    cursor: move;
  }
  .world-label {
    fill: var(--muted);
    font-family: system-ui, sans-serif;
    user-select: none;
    cursor: move;
  }
  .world-handle {
    fill: #fff;
    stroke: #222;
    stroke-width: 0.5;
    cursor: nwse-resize;
  }
  .group-bbox {
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 5 3;
    opacity: 0.8;
  }
  .group-rotate-stem {
    stroke: var(--accent);
    stroke-width: 1;
    opacity: 0.8;
  }
  .group-rotate-handle {
    fill: var(--accent);
    stroke: #222;
    stroke-width: 0.5;
    cursor: grab;
  }
  .mod-badge {
    fill: var(--accent);
    font-family: system-ui, sans-serif;
    font-weight: 600;
    user-select: none;
    pointer-events: none;
  }
  .marquee {
    /* Tint derives from --accent in one place, so the marquee always matches
       the current accent color instead of a hard-coded rgba(). */
    fill: color-mix(in srgb, var(--accent) 14%, transparent);
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
</style>
