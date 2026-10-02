// Single source of truth for every hotkey the app binds. HOTKEYS backs the
// README's hotkey list (keep that section's wording in sync with this table --
// there's no build-time doc generation here, it's copied by hand) and
// CONTEXT_HINTS backs the toolbar's one-line context hint, which changes with
// what the user is currently doing (idle / selection / mid-drag / typing).

export const HOTKEYS = [
  { keys: 'S', desc: 'Toggle grid snap' },
  { keys: 'Alt (hold while dragging)', desc: 'Temporarily inverts snap for that drag' },
  { keys: 'F', desc: "Fit the view to the world box plus every strip's bounding box" },
  { keys: 'Space + drag, or middle-mouse drag', desc: 'Pan the canvas' },
  { keys: 'Mouse wheel', desc: 'Pan; Ctrl/Cmd+wheel or pinch zooms, anchored at the cursor' },
  { keys: 'Click a strip', desc: 'Select it (canvas or strip list)' },
  { keys: 'Shift/Cmd-click a strip', desc: 'Add or remove it from the selection' },
  { keys: 'Shift-click in the strip list', desc: 'Select the range from the last-clicked row, in displayed order' },
  { keys: 'Left-drag on empty canvas', desc: 'Marquee-select every strip with an LED inside the rect' },
  { keys: 'Esc', desc: 'Clear the selection' },
  { keys: 'Delete / Backspace', desc: 'Remove every selected strip' },
  { keys: 'Ctrl/Cmd+D', desc: 'Duplicate the selection, offset by one grid step' },
  { keys: '[ / ]', desc: "Rotate the selection -90°/+90° about its bbox centre" },
  { keys: 'Arrow keys', desc: 'Nudge the selection by one grid step (Shift = 10x, Alt = 1/10)' },
  { keys: 'Shift (hold on end handle)', desc: 'Snaps the angle to 15° steps' },
  { keys: 'Ctrl/Cmd (hold on end handle)', desc: 'Also resizes LED count from drag distance' },
  { keys: 'Group/corner resize handle', desc: "Uniform scale anchored at the opposite corner; 'Lock pitch' picks the mode" }
]

// One muted line at the right end of the toolbar. Hidden while typing in a
// field, otherwise picked by the current drag mode (set by Canvas.svelte) or
// by whether anything is selected.
export const CONTEXT_HINTS = {
  idle: 'Drag: select · Scroll/Space-drag: pan · Pinch/Ctrl+wheel: zoom · F: fit · S: snap',
  selection: 'Drag: move · ⌘D: duplicate · [ ]: rotate 90° · Del: delete · Esc: deselect',
  endHandleDrag: 'Shift: 15° · ⌘/Ctrl: change LED count · Alt: invert snap',
  groupResizeDrag: 'Lock pitch: on/off',
  typing: ''
}

export function contextHint(ctx) {
  return CONTEXT_HINTS[ctx] ?? ''
}
