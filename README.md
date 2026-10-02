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

This list mirrors the `HOTKEYS` table in `src/state/hotkeys.js`, which also backs the toolbar's one-line context hint (idle / selection / mid-drag / typing) -- keep the two in sync by hand when either changes, since there's no build-time doc generation here.

- `S` — toggle grid snap. Ignored while a text field, select, or textarea has focus.
- `Alt` (held during a drag) — temporarily inverts snap for that drag.
- `F` — fit the view to the world box plus every strip's bounding box.
- `Space` + drag, or middle-mouse drag — pan the canvas.
- Mouse wheel — pan; `Ctrl`/`Cmd`+wheel or pinch zooms, anchored at the cursor.
- Click a strip — select it (canvas or strip list). `Shift`/`Cmd`-click a strip on the canvas — add or remove it from the selection.
- In the strip list: plain click selects and sets the range anchor, `Ctrl`/`Cmd`-click toggles one row, `Shift`-click selects the range from the anchor in displayed (channel-grouped) order.
- Left-drag on empty canvas — marquee-select every strip with at least one LED inside the rect; `Shift`/`Cmd` adds to the existing selection instead of replacing it.
- `Esc` — clear the selection. `Delete`/`Backspace` — remove every selected strip. `Ctrl`/`Cmd`+`D` — duplicate the selection, offset by one grid step. `[`/`]` — rotate the selection -90°/+90° about its bbox centre. Arrow keys — nudge the selection by one grid step (`Shift` = 10x, `Alt` = 1/10). All ignored while a text field, select, or textarea has focus.
- `Shift` (held while dragging the end handle) — snaps the angle to 15° steps.
- `Ctrl`/`Cmd` (held while dragging the end handle) — also resizes LED count from drag distance; without it, the end handle only rotates the strip in place.
- With 1+ strips selected, drag a corner handle on the dashed selection bbox to uniform-scale it anchored at the opposite corner; the toolbar's "Lock pitch" toggle (default on) picks locked (positions move, strip size/pitch/LED count stay fixed) vs. unlocked (full geometric scale, pitch scales too).
- With 2+ strips selected, drag the handle above the dashed group bbox to rotate the whole selection about its center (0.5° steps, `Shift` = 15°). Locked strips are skipped by every transform above.
- `I` — toggle the reference image's lock. Ignored while typing in a field, and a no-op with no image loaded.

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

## Phase 2c (this build)

- **Accent orange.** `--accent: #ff9a3c`; `--accent-dim` and the marquee/focus-ring tints all derive from it via `color-mix(in srgb, var(--accent) N%, ...)` in `app.css`, so the brand color changes in one place.
- **Styled inputs.** Shared rules in `app.css` for every `input`, `select`, `textarea`, and checkbox (panel background, border, radius, padding, accent focus ring, `accent-color` on checkboxes, a styled select arrow and number spinners) instead of each panel restating them.
- **Help markers.** `Help.svelte` renders a small underlined `?`, right-aligned at the end of a label's line, that opens a styled tooltip box on hover or keyboard focus after ~200ms, clamped to the viewport. It replaces the old `title=` hints on property and dialog labels; buttons keep short native `title`s.
- **Live modifier feedback.** A global `keys` state (`alt`/`shift`/`meta`/`ctrl`/`space`), set by one window listener and cleared on blur, drives: the Snap button's effective state (`snap XOR alt`) plus an "Alt" badge, a "15°" badge near the handle during any rotate drag, a "LED count" badge during an end-handle drag with Ctrl/Cmd held, and the grab cursor while Space is held.
- **World X/Y/Size.** The toolbar now shows visible "X", "Y", "Size" labels instead of bundling them behind one tooltip.
- **Export drawer** starts collapsed; its expand/collapse arrow uses the accent color.
- **Selection tools.** New geometry registry functions `mirror(geom, axis, center)` and `scaleAbout(geom, k, center)` (line + points). Toolbar buttons (inline SVG icons, enabled only with a selection): Duplicate (`Ctrl`/`Cmd`+`D`, offsets by one grid step, inserts copies right after their originals), Mirror H/V (about the selection bbox centre), Rotate 90° L/R (`[`/`]`, reuses the existing group-rotate action). A corner-resize handle on the selection bbox (shown for 1+ strips) uniform-scales from the opposite corner; "Lock pitch" (default on, toolbar) picks locked (positions move, pitch/LED count/angle fixed) vs. unlocked (full geometric scale, pitch scales too).
- **Strip list range select.** Click selects and sets an anchor, `Ctrl`/`Cmd`-click toggles one row, `Shift`-click selects the anchor-to-here range in displayed order.
- **Hotkey hints.** `src/state/hotkeys.js` is the single table backing both this README's hotkey list and the toolbar's right-aligned, context-sensitive hint line (idle / selection / end-handle drag / group-resize drag / hidden while typing).
- **Strip properties readout.** X/Y (relative to the world origin, in project units, editable) and Angle (single-strip only), plus nudge buttons (`← → ↑ ↓` move by one grid step, `Shift` = 10x, `Alt` = 1/10; `⟲ ⟳` rotate 0.5°, `Shift` = 15°). With a multi-selection the readout shows the group bbox origin and the nudges move/rotate the whole selection.

## Phase 3 (this build)

- **Reference image.** `project.image = { x, y, scale, rotation, opacity, locked, visible }` (x/y = image centre, scale = world units per source pixel) is the saved layout transform; the actual pixel data (`dataUrl`, natural size, file name) lives in a separate, non-project `imageSrc` so it stays out of the project and future undo snapshots. ImagePanel (left sidebar, under Strip properties) loads a file via `<input type="file" accept="image/*">`, then fits it into the world box (Contain, centred) at 50% opacity, unlocked and visible.
- **Canvas rendering and handles (`src/canvas/RefImage.svelte`).** Rendered above the grid, below the world box and strips. Unlocked and visible: dragging the image body moves it (grid snap applies, `Alt` inverts it, same as strips); a corner handle scales it uniformly about its own centre; a handle protruding from that same corner at 45° rotates it (0.5° steps, `Shift` = 15°). Locked: the image has no pointer events at all, so clicks fall through to strips, the world box, and the marquee.
- **Two-point calibration.** ImagePanel's "Calibrate scale" button arms calibration mode; the next two canvas clicks (anywhere, `Esc` cancels) drop markers and a connecting line, then ImagePanel's inline form asks for the real-world distance between them. `calibrateScale()` (`src/core/image.js`) scales the image about its own centre so that distance becomes real, while the midpoint of the two clicks stays fixed in world space. The toolbar's hint line shows "Click two points a known distance apart · Esc: cancel" while calibration is active.
- **Pan/zoom union box** now includes the image's (possibly rotated) bounding box when it's visible, so `F` (fit) and the pan/zoom clamp account for it like they do the world box and every strip.
- **Not part of the export.** `project.image` is layout metadata for this editor only -- `toMapJSON`/`computePixels` never see it, so the image has no effect on the Pixelblaze map.
- **`setUnits` converts the image too** (x, y, scale), same as it does the world box and every strip's geometry and pitch.
- Pure math (`fitToBox`, `calibrateScale`, `imageCorners`/`imageBbox`, `convertImageUnits`) lives in `src/core/image.js`, unit-tested in isolation from the Svelte/DOM/file-reading code that uses it.

## Phase 3b (this build): explicit addresses

- **Every item (strip or pixel) gets a `start`.** A 1-based LED address within its Output Expander channel, claiming `[start, start + ledCount - 1]` (`ledCount` is the points list length for a points/pixel item, else the strip's own `ledCount` field). List order within a channel is ascending `start`; `project.strips`' own array order is kept in sync by reordering only within each channel's array slots, so every existing order-based code path (layout, export, duplicate) keeps working unmodified. Pure math lives in `src/core/address.js`: `ledCount`, `endAddress`, `lastAddress`, `packChannel`, `setStart`, `ensureAddresses`, `reorderChannelSlots`, `bytesPerLed`/`byteRange`.
- **Insert-and-push editing rule (`setStart`).** Setting an item's start to `S` claims `[S, S+n)`; any other item in the channel that now overlaps is pushed to start right after the end of whatever displaced it, cascading forward. Gaps untouched by an overlap are left alone. Growing an item's `ledCount` (the LED-count field, or Ctrl/Cmd-dragging a line strip's end handle) re-runs the same push for anything it now overlaps; shrinking never pushes, it just opens a gap. Moving an item to a new channel appends it after that channel's current last address.
- **Locked items are immovable addresses too.** A push that would land on a locked item instead jumps past its end -- the locked item's own `start` never changes, whether it's in the middle of someone else's cascade or the explicit target of a `setStart` call (editing a locked item's own Address field is a no-op). The one exception: re-running the push after a locked item's own `ledCount` grows is allowed, since the locked item itself doesn't move -- only its larger footprint may now need to push its neighbors.
- **Migration (`ensureAddresses`).** Any item missing a `start` (a fresh project, or one from before this phase) gets packed right after its channel's current last address, in list order; already-addressed items are left exactly where they are. Called once at store init and implicitly by `computePixels`/`validateProject` (so even code that builds `project.strips` by hand, like the test suite, still gets sane addresses) -- every `addStrip`/`addStrips`/`addPixels`/duplicate call also assigns a `start` up front so this is normally a no-op.
- **Gaps are real LEDs.** Pixelblaze's map is dense (array index = LED index), so `computePixels` (`src/core/layout.js`) emits a placeholder pixel (`gap: true`) for every address a channel doesn't claim. Default placeholder repeats the previous real LED's coordinate (the first real LED's, if the channel starts with a gap); `project.export.gapPlaceholder = 'origin'` puts them at the world box's origin instead (toolbar: export drawer's "Gap placeholder" select). Gap pixels count toward the channel's total and the 240 RGB / 180 RGBW limit, which is now checked against the channel's last claimed address (incl. gaps), not the sum of each strip's own LED count -- `core/validate.js`.
- **`channelSummary`** (`src/core/export.js`) now reports `used` (real LEDs), `gaps`, and `count` (total incl. gaps) per channel; the export drawer's summary table shows all three.
- **StripProps "Address" field.** Editable `start`, `-`/`+` nudge buttons (`Shift` = ±10), and a read-only "LEDs 12-21 · bytes 34-63" line. The byte range is `(start-1)*bpp+1 .. end*bpp` (`bpp` 3 for RGB, 4 for RGBW) -- a secondary DMX-style readout for reference; **LED-level addressing is what Pixelblaze and the Output Expander actually use**, and is the only thing `setStart`/export care about. A Help `?` explains the LED-vs-byte distinction and the push rule.
- **StripList** rows show the address range ("12-21", or just "12" for a single-LED item) instead of a bare LED count, and a thin muted "gap 22-29 (8)" separator row appears between list rows wherever a channel has an unclaimed range. Drag-reorder computes the drop point's address (the preceding row's end + 1, or 1 at a channel's start) and calls `moveStripToAddress`, which applies the same insert-and-push rule as the Address field.

## Roadmap

4. **History, persistence, import.** Undo/redo, localStorage autosave, save/load project files, paste-in import of an existing Pixelblaze map (relaxed JSON and JS generator functions), and a wiring preview that animates the chase order.
5. **Curves and shapes.** Bezier, arc, circle, and polygon geometries, all through the same geometry registry used by line.
