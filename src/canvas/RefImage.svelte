<script>
  // Reference image: an SVG <image>, centred and rotated about (image.x, image.y)
  // in world units. Rendered by Canvas.svelte above Grid, below the world box and
  // strips. All pointer state (drag/scale/rotate) lives in Canvas.svelte, same
  // pattern as the world box and the group resize/rotate handles -- this
  // component only emits pointerdown through the on*Down callbacks.
  let { image, dataUrl, naturalW, naturalH, px = 1, onBodyDown, onScaleDown, onRotateDown } = $props()

  const w = $derived((naturalW || 0) * image.scale)
  const h = $derived((naturalH || 0) * image.scale)
  // Rotate handle protrudes from the same bottom-right corner as the scale
  // handle, at 45 deg, so the two don't compete for the top edge.
  const rotX = $derived(w / 2 + 24 * px * Math.SQRT1_2)
  const rotY = $derived(h / 2 + 24 * px * Math.SQRT1_2)
  // Locked (or no image data yet): no pointer events at all, so clicks fall
  // through to the world box, strips, and the marquee underneath/behind it.
  const interactive = $derived(!image.locked && Boolean(dataUrl))
</script>

{#if image.visible && dataUrl}
  <g
    class="ref-image"
    transform={`translate(${image.x} ${image.y}) rotate(${image.rotation})`}
    style:pointer-events={interactive ? 'auto' : 'none'}
  >
    <image
      href={dataUrl}
      x={-w / 2}
      y={-h / 2}
      width={w}
      height={h}
      opacity={image.opacity}
      style:cursor={interactive ? 'move' : 'default'}
      onpointerdown={interactive ? onBodyDown : undefined}
    />
    {#if interactive}
      <rect
        class="scale-handle"
        x={w / 2 - 5 * px}
        y={h / 2 - 5 * px}
        width={10 * px}
        height={10 * px}
        vector-effect="non-scaling-stroke"
        onpointerdown={onScaleDown}
      ><title>Drag to scale the image uniformly about its centre</title></rect>
      <line class="rotate-stem" x1={w / 2} y1={h / 2} x2={rotX} y2={rotY} vector-effect="non-scaling-stroke" />
      <circle
        class="rotate-handle"
        cx={rotX}
        cy={rotY}
        r={6 * px}
        onpointerdown={onRotateDown}
      ><title>Drag to rotate the image (0.5° steps, Shift = 15°)</title></circle>
    {/if}
  </g>
{/if}

<style>
  .ref-image image {
    user-select: none;
  }
  .scale-handle {
    fill: #fff;
    stroke: #222;
    stroke-width: 0.5;
    cursor: nwse-resize;
  }
  .rotate-stem {
    stroke: var(--accent);
    stroke-width: 1;
    opacity: 0.8;
  }
  .rotate-handle {
    fill: var(--accent);
    stroke: #222;
    stroke-width: 0.5;
    cursor: grab;
  }
</style>
