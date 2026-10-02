# PixelMapper

A browser tool for building Pixelblaze LED pixel maps by placing strips on a canvas instead of hand-typing coordinate arrays. Strips are drawn with real-world units (mm/in), given a channel and color type, and exported as JSON that pastes straight into the Pixelblaze Mapper tab.

This is a separate git repository from the parent `pixelBlaze/` patterns project. It has no runtime dependency on anything outside this folder.

## Usage

```
npm install
npm run dev      # dev server with hot reload
npm run build    # produces a single portable dist/index.html
npm test         # vitest, core/ logic only
```

`dist/index.html` is fully self-contained (JS and CSS inlined via vite-plugin-singlefile) and works opened directly from `file://`, with no server and no network access.

In dev builds, `window.pm = { store, core }` is exposed in the browser console for debugging the project state and core math directly.

## Hotkeys

- `S` — toggle grid snap. Ignored while a text field, select, or textarea has focus.
- `Alt` (held during a drag) — temporarily inverts snap for that drag.
- `Shift` (held while dragging the end handle) — snaps the angle to 15° steps.
- `Ctrl`/`Cmd` (held while dragging the end handle) — also resizes LED count from drag distance; without it, the end handle only rotates the strip in place.
- `F` — fit the view to the world box plus every strip's bounding box.
- `Space` + drag, or middle-mouse drag — pan the canvas.
- Mouse wheel — zoom, anchored at the cursor.
- Click a strip — select it. `Shift`/`Cmd`-click a strip (on the canvas or in the strip list) — add or remove it from the selection.
- Left-drag on empty canvas — marquee-select every strip with at least one LED inside the rect; `Shift`/`Cmd` adds to the existing selection instead of replacing it.
- `Esc` — clear the selection. `Delete`/`Backspace` — remove every selected strip. Both ignored while a text field, select, or textarea has focus.
- With 2+ strips selected, drag the handle above the dashed group bbox to rotate the whole selection about its center (0.5° steps, `Shift` = 15°). Locked strips are skipped.

## Pixelblaze map facts this tool relies on

- A map is a top-level JSON array, one entry per pixel, in wire (index) order: `[[x,y],...]` for 2D or `[[x,y,z],...]` for 3D. Pixelblaze tolerates a trailing comma.
- Convention is y-down, matching SVG: `[0,0]` is top-left-ish, increasing y goes down.
- Units are arbitrary. Pixelblaze normalizes the whole map to 0..1 world units (Fill or Contain) before rendering, so exporting real millimetres is fine.
- An Output Expander board has 8 channels and supports up to 240 RGB or 180 RGBW pixels per channel.
- Pixelblaze's own pixel index is continuous across Output Expander channels, in channel order — channel 0's pixels come first, then channel 1's, and so on.

## Phase 1

- Project/strip data model, line geometry (pitch mode), layout ordering, map/JSON export.
- SVG canvas with pan/zoom/grid, drag-to-move strips, drag handles for origin and angle.
- Strip list, strip property editor, export panel with copy/download and a channel summary with over-limit warnings.

## Phase 2 (this build)

- **Add strips / Add pixels dialogs.** "Add strip" opens a dialog with every strip property plus a count and a placement mode (parallel rows with optional serpentine, stacked at the cursor, or matrix). "Add pixels" creates N standalone pixels as a `points` strip, laid out in a row at the view centre; each pixel is its own draggable handle. "Add shape" and "Add Bezier" are visible in the toolbar but disabled with a "Phase 5" tooltip.
- **Points geometry.** A freeform list of individual pixel coordinates (`core/geometry/points.js`), used by "Add pixels" and, eventually, pasted-in map import. Implements the same registry interface (`sample`/`handles`/`moveHandle`/`translate`/`scale`/`bbox`) as every other geometry.
- **Channel-grouped strip list.** Strips are grouped under their Output Expander channel and drag-reorderable within and across channel groups. Each row has eye (hide) and padlock (lock) icon toggles, Illustrator-layer style; those checkboxes are gone from the strip property panel.
- **Strips / Strip properties split.** The two panels share the left sidebar as a resizable vertical split (drag the divider between them); each pane scrolls independently and keeps at least 80px, so Strip properties is always reachable regardless of window height or strip-list length. The split position persists across reloads via `localStorage` when available.
- **Validation warnings (`core/validate.js`).** Flags a channel over 240 (RGB) or 180 (RGBW) pixels, a channel mixing RGB and RGBW strips, duplicate pixel coordinates, and empty strips. Surfaced as a warnings badge and list in the export drawer.
- **Fit-mode spacing.** A strip's spacing can be "pitch" (fixed LED spacing, length follows LED count) or "fit" (N LEDs spread evenly between two endpoints, derived spacing shown read-only).
- **Canvas physical size.** `project.canvas` (default 2000×2000 project units) is set in the toolbar and drawn as a dashed boundary rect; it's rescaled whenever units change.
- **Bounded pan/zoom.** Panning keeps the view centre inside the union of the canvas rect and every strip's bounding box, plus a margin. Wheel zoom is `exp(deltaY * 0.002)` clamped to ±8% per event and capped at roughly 1.5× that union on zoom-out. `F` fits the view to it.
- **Export as a bottom drawer.** The export panel moved out of the right sidebar into a collapsible, resizable (drag its top edge) bottom drawer. Its header — pixel count, a warnings badge, and Copy — stays visible even when the drawer is collapsed.
- **Tooltips** on the Z, pitch, channel, color type, reversed, and spacing fields explain what each one does and how it affects export.
- No undo, no persistence of the project itself, no reference image, and curves/shapes are still Phase 5 — see the roadmap below.

## Phase 2b (this build)

- **World box replaces canvas size.** `project.world = { x, y, size }` is a square in project units (default 0, 0, 2000 mm), drawn solid with a label. Drag its border or label to move the origin, or its bottom-right corner handle to resize (top-left stays fixed). Strips never move when the world box moves or resizes — it's purely the frame the export normalizes against.
- **Grid from the world box.** `project.grid.divisions` (default 20) gives a grid step of `world.size / divisions`, anchored at the world origin so grid lines always meet the box's edges. Snap uses this same step. The toolbar's "Grid divisions" field shows the derived step.
- **Normalized export.** Every exported coordinate is `(p - world.origin) / world.size` (z divided by `world.size`), rounded to 4 decimals by default. Since units are only labels, the export is identical whether the project is drawn in mm, in, or px. A pixel that falls outside the world box triggers an "outside the world box" warning in the export drawer. Pixelblaze still rescales the whole map to its own bounds (Fill or Contain) before rendering, so the drawer notes using **Contain** to keep the world box's aspect ratio instead of stretching it. An experimental "Anchor world corners" checkbox (`project.export.anchors`, off by default, untested on real hardware) appends the normalized `[0,0]` and `[1,1]` corners to the map — these are never counted in the pixel total or channel summary.
- **Multi-select.** `selection = { ids, primary }`. Click a strip (canvas or strip list) to select it; `Shift`/`Cmd`-click toggles it into or out of the selection. Left-drag on empty canvas draws a marquee that selects every strip with at least one sampled LED inside it (`Shift`/`Cmd` adds instead of replacing). `Esc` clears the selection, `Delete`/`Backspace` removes every selected strip (both ignored while typing in a field). Dragging any selected strip moves the whole selection by the same snapped delta; dragging an unselected strip selects just that one (or toggles it with Shift) and drags only it. With 2+ strips selected, a dashed group bounding box appears with a rotate handle above its top-centre that rotates the whole selection about the bbox centre (0.5° steps, `Shift` = 15°) — locked strips are skipped. Strip properties shows the primary strip's fields, or "N strips selected" when more than one is selected.
- **Geometry registry gains `rotate`.** Every geometry type (`line`, `points`) now implements `rotate(geom, deg, center)` alongside `sample`/`handles`/`moveHandle`/`translate`/`scale`/`bbox`, so layout/export still never special-case shape type.

## Roadmap

3. **Reference image.** Load a photo or drawing underneath the canvas, move/rotate/scale it, lock it, and calibrate its scale with a two-point real-world distance click.
4. **History, persistence, import.** Undo/redo, localStorage autosave, save/load project files, paste-in import of an existing Pixelblaze map (relaxed JSON and JS generator functions), and a wiring preview that animates the chase order.
5. **Curves and shapes.** Bezier, arc, circle, and polygon geometries, all through the same geometry registry used by line.
