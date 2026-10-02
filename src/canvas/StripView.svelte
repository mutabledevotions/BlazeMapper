<script>
  // Renders one strip: LED dots, a thin connecting line, and a wire-start marker
  // (ring + chevron on the first LED in wire order, pointing toward the second).
  // Click selects, drag (via onDragStart) translates the whole strip.
  import { sample } from '../core/geometry/index.js'

  let { strip, selected, showLabel = true, px = 1, onDragStart } = $props()

  const points = $derived(sample(strip.geom, strip))
  // ~6 screen px so dots stay clickable at any zoom; grows with pitch when zoomed in,
  // capped at one pitch (neighbours overlap at most half) when zoomed far out.
  const dotRadius = $derived(
    strip.geom.type === 'points'
      ? 6 * px
      : Math.min(Math.max(6 * px, strip.pitch * 0.3), strip.pitch)
  )
  const pathD = $derived(points.length > 1 ? 'M ' + points.map((p) => `${p.x},${p.y}`).join(' L ') : '')

  // True curve/shape outline (bezier, arc, circle, polygon) -- the LED path
  // above already follows the sampled points, this is just a faint dashed
  // guide showing the exact underlying path, including past the last LED if
  // pitch mode ran short of it (bezier/arc) or wrapped around (circle/polygon).
  const curvePathD = $derived.by(() => {
    const g = strip.geom
    if (g.type === 'bezier') {
      return `M ${g.p0.x},${g.p0.y} C ${g.c0.x},${g.c0.y} ${g.c1.x},${g.c1.y} ${g.p1.x},${g.p1.y}`
    }
    if (g.type === 'arc') {
      const rad = (deg) => (deg * Math.PI) / 180
      const pt = (deg) => ({ x: g.center.x + g.radius * Math.cos(rad(deg)), y: g.center.y + g.radius * Math.sin(rad(deg)) })
      const start = pt(g.startAngle)
      const end = pt(g.startAngle + g.sweep)
      const large = Math.abs(g.sweep) > 180 ? 1 : 0
      const sweepFlag = g.sweep >= 0 ? 1 : 0
      return `M ${start.x},${start.y} A ${g.radius},${g.radius} 0 ${large} ${sweepFlag} ${end.x},${end.y}`
    }
    if (g.type === 'circle') {
      // Two 180 degree arcs, since a single SVG arc command can't describe a
      // full circle (start === end degenerates it).
      const left = { x: g.center.x - g.radius, y: g.center.y }
      const right = { x: g.center.x + g.radius, y: g.center.y }
      return `M ${left.x},${left.y} A ${g.radius},${g.radius} 0 1 1 ${right.x},${right.y} A ${g.radius},${g.radius} 0 1 1 ${left.x},${left.y}`
    }
    if (g.type === 'polygon') {
      const pts = []
      for (let i = 0; i < g.sides; i++) {
        const angle = g.rotation + (360 * i) / g.sides
        const rad = (angle * Math.PI) / 180
        pts.push({ x: g.center.x + g.radius * Math.cos(rad), y: g.center.y + g.radius * Math.sin(rad) })
      }
      return 'M ' + pts.map((p) => `${p.x},${p.y}`).join(' L ') + ' Z'
    }
    return ''
  })

  // Wire order: reversed strips start at their last geometric point.
  const wireStart = $derived(strip.reversed ? points.length - 1 : 0)
  const chevron = $derived.by(() => {
    if (points.length < 2) return ''
    const a = points[wireStart]
    const b = points[strip.reversed ? points.length - 2 : 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const ux = (b.x - a.x) / len
    const uy = (b.y - a.y) / len
    const r = dotRadius * 0.75
    const tip = [a.x + ux * r, a.y + uy * r]
    const back = [a.x - ux * r * 0.5, a.y - uy * r * 0.5]
    const l = [back[0] - uy * r * 0.8, back[1] + ux * r * 0.8]
    const rr = [back[0] + uy * r * 0.8, back[1] - ux * r * 0.8]
    return `M ${l[0]},${l[1]} L ${tip[0]},${tip[1]} L ${rr[0]},${rr[1]}`
  })

  function pointerDown(evt) {
    if (strip.locked) return
    onDragStart(evt)
  }
</script>

<g class="strip" class:selected class:locked={strip.locked} onpointerdown={pointerDown}>
  {#if curvePathD}
    <path
      d={curvePathD}
      stroke={strip.color}
      stroke-width="1.5"
      fill="none"
      opacity="0.3"
      stroke-dasharray="4 3"
      vector-effect="non-scaling-stroke"
    />
  {/if}
  {#if pathD}
    <path d={pathD} stroke={strip.color} stroke-width={2 * px} fill="none" opacity="0.6" />
  {/if}
  {#each points as p, i}
    <circle cx={p.x} cy={p.y} r={dotRadius} fill={strip.color} opacity={i === wireStart ? 1 : 0.85} />
  {/each}
  {#if points.length > 0 && strip.kind !== 'pixel'}
    <circle cx={points[wireStart].x} cy={points[wireStart].y} r={dotRadius * 1.8} fill="none" stroke={strip.color} stroke-width="1" vector-effect="non-scaling-stroke"><title>Wire start (first LED in address order)</title></circle>
    {#if chevron}
      <path d={chevron} fill="none" stroke="#111" stroke-width={Math.max(1.5 * px, dotRadius * 0.28)} stroke-linecap="round" stroke-linejoin="round" />
    {/if}
  {/if}
  {#if selected && showLabel}
    <text
      x={points[0]?.x ?? strip.geom.p0?.x ?? strip.geom.center?.x ?? 0}
      y={(points[0]?.y ?? strip.geom.p0?.y ?? strip.geom.center?.y ?? 0) - dotRadius - 8 * px}
      class="label"
      font-size={12 * px}>{strip.name}</text
    >
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
