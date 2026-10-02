<script>
  // Small underlined "?" marker, meant to sit right-aligned at the end of a
  // property label's line. Hover or keyboard focus opens a styled tooltip box
  // after a short delay (native title= tooltips take ~1.5s -- this is faster
  // since these are read far more often than once). Replaces title= hints on
  // property and dialog labels; buttons keep their native title attribute.
  let { text = '' } = $props()

  const DELAY_MS = 200

  let open = $state(false)
  let style = $state('')
  let timer = null
  let markerEl

  function show() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      open = true
      position()
    }, DELAY_MS)
  }

  function hide() {
    clearTimeout(timer)
    open = false
  }

  // Clamp the box to the viewport: prefer below-left of the marker, flip above
  // if there's no room below, and shift left if it would overflow the right edge.
  function position() {
    if (!markerEl) return
    const r = markerEl.getBoundingClientRect()
    const maxWidth = 260
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = r.left
    if (left + maxWidth + 8 > vw) left = Math.max(8, vw - maxWidth - 8)
    const openBelow = r.bottom + 120 < vh
    const top = openBelow ? r.bottom + 6 : null
    const bottom = openBelow ? null : vh - r.top + 6
    style = `left:${left}px; ${top !== null ? `top:${top}px;` : `bottom:${bottom}px;`}`
  }
</script>

<span
  class="pm-help"
  bind:this={markerEl}
  tabindex="0"
  role="button"
  aria-label="Help"
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
>
  ?
  {#if open}
    <span class="pm-help-box" {style}>{text}</span>
  {/if}
</span>

<style>
  .pm-help {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    width: 1rem;
    height: 1rem;
    font-size: 0.7rem;
    line-height: 1;
    color: var(--muted);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: help;
    flex-shrink: 0;
  }
  .pm-help:hover,
  .pm-help:focus-visible {
    color: var(--accent);
    outline: none;
  }
  .pm-help-box {
    position: fixed;
    z-index: 100;
    max-width: 260px;
    width: max-content;
    background: var(--panel-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    font-size: 13px;
    font-weight: 400;
    line-height: 1.35;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    white-space: normal;
  }
</style>
