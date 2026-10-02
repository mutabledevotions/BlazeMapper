<script>
  // Minor lines every `size`, major lines every 5x that, both clipped to the current viewBox.
  let { viewBox, size } = $props()

  function lines(step, extra) {
    const x0 = Math.floor((viewBox.x - extra) / step) * step
    const x1 = viewBox.x + viewBox.w + extra
    const y0 = Math.floor((viewBox.y - extra) / step) * step
    const y1 = viewBox.y + viewBox.h + extra
    const vlines = []
    const hlines = []
    for (let x = x0; x <= x1; x += step) vlines.push(x)
    for (let y = y0; y <= y1; y += step) hlines.push(y)
    return { vlines, hlines }
  }

  const minor = $derived(lines(size, size))
  const major = $derived(lines(size * 5, size * 5))
</script>

<g class="grid">
  {#each minor.vlines as x}
    <line x1={x} y1={viewBox.y - size} x2={x} y2={viewBox.y + viewBox.h + size} class="minor" />
  {/each}
  {#each minor.hlines as y}
    <line x1={viewBox.x - size} y1={y} x2={viewBox.x + viewBox.w + size} y2={y} class="minor" />
  {/each}
  {#each major.vlines as x}
    <line x1={x} y1={viewBox.y - size} x2={x} y2={viewBox.y + viewBox.h + size} class="major" />
  {/each}
  {#each major.hlines as y}
    <line x1={viewBox.x - size} y1={y} x2={viewBox.x + viewBox.w + size} y2={y} class="major" />
  {/each}
</g>

<style>
  .minor {
    stroke: #2a2e37;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .major {
    stroke: #3a3f4b;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
</style>
