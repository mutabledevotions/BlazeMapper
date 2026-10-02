# BlazeMapper

A browser tool for building Pixelblaze LED pixel maps by placing strips on a canvas instead of hand-typing coordinate arrays. Strips are drawn with real-world units (mm/in), given a channel and color type, and exported as JSON that pastes straight into the Pixelblaze Mapper tab.

This is a separate git repository from the parent `pixelBlaze/` patterns project. It has no runtime dependency on anything outside this folder.

## Quick start

```
npm install
npm run dev      # dev server with hot reload
npm run build    # produces a single portable dist/index.html
npm test         # vitest, core/ logic only
```

Open the built `dist/index.html` directly from `file://` -- it's fully self-contained (JS/CSS inlined via vite-plugin-singlefile), with no server and no network access.

In dev builds, `window.bm = { store, core, history, persist }` is exposed in the browser console for poking at project state and core math directly (`window.pm` is kept as a deprecated alias).

## Features

- **Strips.** Line (fixed-pitch or fit-between-two-points), freeform points (individual pixels), and four curve types -- bezier, arc, circle, polygon -- each sampled by arc length so LED spacing is physically even regardless of curvature.
- **Selection tools.** Click/shift-click/marquee select; duplicate, mirror H/V, rotate 90°, and a corner-drag group resize with a "Lock pitch" toggle (locked: positions move but pitch/LED count/angle stay fixed; unlocked: full geometric scale).
- **Addresses.** Every strip/pixel gets a 1-based `start` address within its Output Expander channel. Setting one address pushes any overlapping neighbor forward (insert-and-push); gaps between addressed ranges are real, unaddressed LEDs on the wire and get a placeholder map entry (previous LED's coordinate, or the world origin) so the exported map stays index-dense.
- **Reference image + calibration.** Load a photo/drawing, position/scale/rotate it under the strips, then two-point calibrate it against a known real-world distance.
- **World box + normalized export.** A square `project.world` (origin + size, in project units) is the frame every export coordinate normalizes against: `(p - origin) / size`, rounded to 4 decimals. Units are display-only, so the same layout exports identically in mm/in/px. Use **Contain** in the Pixelblaze Mapper tab to preserve the world box's aspect ratio instead of stretching it to fill.
- **Import/export/save.** Paste or load a Pixelblaze map (relaxed JSON, or a `function (pixelCount)` generator) to import it as a points strip; save/load the whole project as `.blazemap.json` (`.pixelmap.json` from before the rename still imports, as does any JSON object with `version` + a `strips` array); autosave to IndexedDB every 5s.
- **Wiring preview.** An animated highlight chases through the wire (global index) order, with an optional per-LED index label once zoomed in enough to read.
- **Undo/redo.** One snapshot per discrete action or drag gesture, not per pointermove.

## Hotkeys

Single source of truth: `src/state/hotkeys.js` (`HOTKEYS`), which also backs the toolbar's one-line context hint. Keep this table in sync with that file by hand.

| Keys | Action |
|---|---|
| `Ctrl`/`Cmd`+`Z` | Undo |
| `Shift`+`Ctrl`/`Cmd`+`Z` or `Ctrl`+`Y` | Redo |
| `W` | Toggle the wiring preview |
| `S` | Toggle grid snap |
| `Alt` (held while dragging) | Temporarily inverts snap |
| `F` | Fit the view to the world box plus every strip's bbox |
| `Space`+drag, or middle-mouse drag | Pan |
| Mouse wheel | Pan; `Ctrl`/`Cmd`+wheel or pinch zooms at the cursor |
| Click a strip | Select (canvas or strip list) |
| `Shift`/`Cmd`-click a strip | Add/remove from selection |
| `Shift`-click in the strip list | Range-select from the last click, in displayed order |
| Left-drag on empty canvas | Marquee-select |
| `Esc` | Cancel calibration, else close an open popup, else clear selection |
| `Delete`/`Backspace` | Remove selected strips |
| `Ctrl`/`Cmd`+`D` | Duplicate selection (offset one grid step) |
| `[` / `]` | Rotate selection -90°/+90° about its bbox centre |
| Arrow keys | Nudge selection one grid step (`Shift`=10x, `Alt`=1/10) |
| `Shift` on end handle | Snap angle to 15° |
| `Ctrl`/`Cmd` on end handle | Also resize LED count from drag distance |
| `I` | Toggle reference image lock |

All hotkeys are ignored while a text field/select/textarea has focus.

## Pixelblaze notes

- A map is a top-level JSON array, one entry per pixel, in wire (index) order: `[[x,y],...]` (2D) or `[[x,y,z],...]` (3D). Pixelblaze tolerates a trailing comma.
- Convention is y-down, matching SVG: `[0,0]` is top-left-ish, increasing y goes down.
- Units are arbitrary -- Pixelblaze normalizes the whole map to 0..1 (Fill or Contain) before rendering, so exporting real millimetres is fine.
- An Output Expander board has 8 channels, up to 240 RGB or 180 RGBW pixels per channel (the 3-vs-4-bytes-per-LED difference behind that limit). Pixelblaze's own pixel index is continuous across channels, in channel order.
- Addressing throughout the UI is LED-level (what Pixelblaze and the Output Expander actually use), with a secondary byte-range readout (`(start-1) * bytesPerLed + 1 .. end * bytesPerLed`) for anyone thinking in DMX-style byte channels.

## Architecture

- `src/core/` -- pure JS, no DOM/Svelte imports, unit-tested directly (`test/core.test.js`):
  - `model.js` project/strip factories, `units.js` conversion + pitch presets + `roundTo`/`fmt`, `address.js` the push/pack addressing rules, `layout.js` strip-list -> ordered pixel list, `export.js` map JSON + channel summary, `import.js` relaxed-JSON/function parsing, `validate.js` warnings, `image.js` reference-image math, `throttle.js` the autosave throttle state machine.
  - `geometry/index.js` is a registry dispatching to one module per shape (`line`, `points`, `bezier`, `arc`, `circle`, `polygon`), each implementing the same interface: `sample`, `handles`, `moveHandle`, `translate`, `scale`, `rotate`, `mirror`, `scaleAbout`, `bbox`, and optionally `curveLength`. `arclength.js` holds the shared arc-length-table helpers the four curve types build on.
- `src/state/` -- Svelte 5 `$state` store (`project.svelte.js`) plus `history.js` (undo/redo snapshots), `persist.js` (serialize + IndexedDB autosave), `localKeys.js` (localStorage helpers), `hotkeys.js` (the table above).
- `src/canvas/` -- the SVG canvas (`Canvas.svelte`) and its children: `Grid`, `RefImage`, `StripView`, `Handles`, `WiringPreview`, `HintOverlay`.
- `src/panels/` -- `Toolbar.svelte` (sectioned controls + the Grid/World/Reference-image popups), `GridPanel`/`WorldPanel`/`ImagePanel.svelte` (floating `<dialog>` popups sharing `.floating-panel` chrome from `app.css`), `StripList`/`StripProps.svelte`, `ExportDrawer.svelte`, the Add/Import dialogs, `Help.svelte`.

### Adding a new geometry type

1. Add `src/core/geometry/<name>.js` implementing the registry interface above (pure, no DOM).
2. Register it in `src/core/geometry/index.js`'s `REGISTRY` map.
3. Add a `newGeom()` case in `src/core/model.js` for sane defaults.
4. If it should appear in "Add shape", add it to `AddStripsDialog.svelte`'s Shape select.

Canvas rendering, layout, export, and validation never need to change -- they only ever go through the registry.
