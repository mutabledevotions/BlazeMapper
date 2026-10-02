<script>
  // Draggable control handles for the selected strip's geometry.
  import { handles } from '../core/geometry/index.js'

  let { strip, px = 1, onHandleDrag } = $props()
  const size = $derived(10 * px) // 10 screen px

  const hs = $derived(handles(strip.geom, strip))

  function tooltip(h) {
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
  {#each hs as h (h.id)}
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
  {/each}
</g>

<style>
  .p0 { cursor: move; }
  .end { cursor: crosshair; }
  .pt { cursor: move; }
</style>
