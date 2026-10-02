<script>
  // Draggable control handles for the selected strip's geometry.
  import { handles } from '../core/geometry/index.js'

  let { strip, onHandleDrag } = $props()

  const hs = $derived(handles(strip.geom))

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
      x={h.x - 3}
      y={h.y - 3}
      width="6"
      height="6"
      fill="#fff"
      stroke="#222"
      stroke-width="0.5"
      vector-effect="non-scaling-stroke"
      onpointerdown={(evt) => pointerDown(h.id, evt)}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
    />
  {/each}
</g>
