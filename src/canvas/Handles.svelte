<script>
  // Draggable control handles for the selected strip's geometry.
  import { handles } from '../core/geometry/index.js'

  let { strip, px = 1, onHandleDrag } = $props()
  const size = $derived(10 * px) // 10 screen px
  const isBezier = $derived(strip.geom.type === 'bezier')

  const hs = $derived(handles(strip.geom, strip))
  function handleAt(id) {
    return hs.find((h) => h.id === id)
  }

  function tooltip(h) {
    if (isBezier) {
      if (h.id === 'p0' || h.id === 'p1') return 'Drag to move this end (carries its control point with it)'
      return 'Drag to bend the curve. Shift: snap angle from the anchor to 15°.'
    }
    if (h.id === 'p0') return 'Drag to move the strip start'
    if (h.id === 'end') {
      return strip.geom.type === 'line' && strip.spacing !== 'fit'
        ? 'Drag to rotate. Hold Ctrl/Cmd to also change LED count.'
        : 'Drag to move the end point'
    }
    if (h.id && h.id.startsWith('pt:')) return 'Drag to move this pixel'
    return ''
  }

  let dragId = null

  function pointerDown(id, evt) {
    if (strip.locked) return
    dragId = id
    evt.currentTarget.setPointerCapture(evt.pointerId)
    evt.stopPropagation()
  }

  function pointerMove(evt) {
    if (dragId) onHandleDrag(dragId, evt)
  }

  function pointerUp(evt) {
    dragId = null
  }
</script>

<g class="handles">
  {#if isBezier}
    {@const p0 = handleAt('p0')}
    {@const c0 = handleAt('c0')}
    {@const c1 = handleAt('c1')}
    {@const p1 = handleAt('p1')}
    <line class="ctrl-line" x1={p0.x} y1={p0.y} x2={c0.x} y2={c0.y} vector-effect="non-scaling-stroke" />
    <line class="ctrl-line" x1={p1.x} y1={p1.y} x2={c1.x} y2={c1.y} vector-effect="non-scaling-stroke" />
  {/if}
  {#each hs as h (h.id)}
    {#if isBezier && (h.id === 'c0' || h.id === 'c1')}
      <circle
        cx={h.x}
        cy={h.y}
        r={size / 2}
        fill="#ffd54f"
        class="ctrl"
        stroke="#222"
        stroke-width="0.5"
        vector-effect="non-scaling-stroke"
        onpointerdown={(evt) => pointerDown(h.id, evt)}
        onpointermove={pointerMove}
        onpointerup={pointerUp}
      ><title>{tooltip(h)}</title></circle>
    {:else}
      <rect
        x={h.x - size / 2}
        y={h.y - size / 2}
        width={size}
        height={size}
        fill={h.id === 'end' ? '#ffd54f' : '#fff'}
        class={h.id.startsWith('pt:') ? 'pt' : h.id}
        stroke="#222"
        stroke-width="0.5"
        vector-effect="non-scaling-stroke"
        onpointerdown={(evt) => pointerDown(h.id, evt)}
        onpointermove={pointerMove}
        onpointerup={pointerUp}
      ><title>{tooltip(h)}</title></rect>
    {/if}
  {/each}
</g>

<style>
  .p0 { cursor: move; }
  .p1 { cursor: move; }
  .end { cursor: crosshair; }
  .pt { cursor: move; }
  .ctrl { cursor: crosshair; }
  .ctrl-line {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 2;
    opacity: 0.7;
    pointer-events: none;
  }
</style>
