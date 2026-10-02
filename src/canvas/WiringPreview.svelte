<script>
  // Animated chase along the global (wire) index order, skipping gap
  // placeholders -- toggled from the toolbar / hotkey W. requestAnimationFrame-
  // driven; the effect's cleanup cancels it, so toggling off (or navigating
  // away, since Canvas only mounts this while wiringPreview.active) stops it.
  import { project, wiringPreview } from '../state/project.svelte.js'
  import { computePixels } from '../core/layout.js'

  let { px = 1 } = $props()

  const pixels = $derived(computePixels(project).filter((p) => !p.gap))
  const count = $derived(pixels.length)

  const TRAIL = 5
  let current = $state(0)
  let lastTime = null
  let rafId = null

  function frame(t) {
    if (lastTime === null) lastTime = t
    const dt = (t - lastTime) / 1000
    lastTime = t
    if (count > 0) {
      current = (current + dt * wiringPreview.speed) % count
    }
    rafId = requestAnimationFrame(frame)
  }

  $effect(() => {
    lastTime = null
    rafId = requestAnimationFrame(frame)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
    }
  })

  const idx = $derived(Math.floor(current) % Math.max(1, count))
  // Trailing fade: the current LED plus TRAIL-1 behind it, each dimmer.
  const trailDots = $derived.by(() => {
    if (!count) return []
    const dots = []
    for (let k = 0; k < Math.min(TRAIL, count); k++) {
      const i = ((idx - k) % count + count) % count
      dots.push({ key: `${i}-${k}`, pixel: pixels[i], alpha: 1 - k / TRAIL })
    }
    return dots
  })

  // Labels are only legible once LEDs are far enough apart on screen --
  // representative spacing: the smallest gap between two consecutive real
  // LEDs of the same strip, in world units, converted to screen px via /px.
  const screenPitch = $derived.by(() => {
    let min = Infinity
    for (let i = 1; i < pixels.length; i++) {
      const a = pixels[i - 1]
      const b = pixels[i]
      if (a.stripId !== b.stripId) continue
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (d > 0 && d < min) min = d
    }
    return isFinite(min) ? min / px : Infinity
  })
  const labelsLegible = $derived(wiringPreview.showLabels && screenPitch > 14)
</script>

<g class="wiring-preview">
  {#each trailDots as d (d.key)}
    <circle cx={d.pixel.x} cy={d.pixel.y} r={6 * px} opacity={d.alpha} vector-effect="non-scaling-stroke" />
  {/each}
  {#if labelsLegible}
    {#each pixels as p, i (i)}
      <text class="label" x={p.x + 8 * px} y={p.y - 8 * px} font-size={10 * px}>{p.global}</text>
    {/each}
  {/if}
</g>

<style>
  .wiring-preview {
    pointer-events: none;
  }
  .wiring-preview circle {
    fill: var(--accent);
    stroke: #222;
    stroke-width: 0.5;
  }
  .wiring-preview .label {
    fill: var(--fg);
    font-family: ui-monospace, monospace;
    opacity: 0.85;
    user-select: none;
  }
</style>
