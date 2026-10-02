<script>
  // Renders one strip: LED dots, a thin connecting line, and a start marker.
  // Click selects, drag (via onDragStart) translates the whole strip.
  import { sample } from '../core/geometry/index.js'

  let { strip, selected, onDragStart } = $props()

  const points = $derived(sample(strip.geom, strip))
  const dotRadius = $derived(Math.max(0.8, strip.pitch * 0.3))
  const pathD = $derived(points.length > 1 ? 'M ' + points.map((p) => `${p.x},${p.y}`).join(' L ') : '')

  function pointerDown(evt) {
    if (strip.locked) return
    onDragStart(evt)
  }
</script>

<g class="strip" class:selected class:locked={strip.locked} onpointerdown={pointerDown}>
  {#if pathD}
    <path d={pathD} stroke={strip.color} stroke-width={Math.max(0.5, strip.pitch * 0.08)} fill="none" opacity="0.6" />
  {/if}
  {#each points as p, i}
    <circle cx={p.x} cy={p.y} r={dotRadius} fill={strip.color} opacity={i === 0 ? 1 : 0.85} />
  {/each}
  {#if points.length > 0}
    <circle cx={points[0].x} cy={points[0].y} r={dotRadius * 1.8} fill="none" stroke={strip.color} stroke-width="1" vector-effect="non-scaling-stroke" />
  {/if}
  {#if selected}
    <text x={points[0]?.x ?? strip.geom.p0.x} y={(points[0]?.y ?? strip.geom.p0.y) - dotRadius * 3} class="label" font-size={Math.max(3, dotRadius * 2)}>{strip.name}</text>
  {/if}
</g>

<style>
  .strip {
    cursor: move;
  }
  .strip.locked {
    cursor: default;
  }
  .strip.selected path {
    opacity: 0.9;
  }
  .label {
    fill: #e0e0e0;
    font-family: system-ui, sans-serif;
    user-select: none;
  }
</style>
