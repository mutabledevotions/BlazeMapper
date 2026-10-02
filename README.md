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

## Pixelblaze map facts this tool relies on

- A map is a top-level JSON array, one entry per pixel, in wire (index) order: `[[x,y],...]` for 2D or `[[x,y,z],...]` for 3D. Pixelblaze tolerates a trailing comma.
- Convention is y-down, matching SVG: `[0,0]` is top-left-ish, increasing y goes down.
- Units are arbitrary. Pixelblaze normalizes the whole map to 0..1 world units (Fill or Contain) before rendering, so exporting real millimetres is fine.
- An Output Expander board has 8 channels and supports up to 240 RGB or 180 RGBW pixels per channel.
- Pixelblaze's own pixel index is continuous across Output Expander channels, in channel order — channel 0's pixels come first, then channel 1's, and so on.

## Phase 1 (this build)

- Project/strip data model, line geometry (pitch mode), layout ordering, map/JSON export.
- SVG canvas with pan/zoom/grid, drag-to-move strips, drag handles for origin and angle.
- Strip list, strip property editor, export panel with copy/download and a channel summary with over-limit warnings.
- No undo, no persistence, no reference image, and only one geometry type (line) yet — see the roadmap below.

## Roadmap

2. **Batch + channels + pixels.** Dialog to add many strips at once (rows/serpentine, stacked, matrix), channel grouping and reordering in the strip list, validation warnings (duplicate coordinates, empty channels, overlaps), a freeform "points" geometry for individual pixels, and fit-mode spacing (N LEDs spread between two endpoints).
3. **Reference image.** Load a photo or drawing underneath the canvas, move/rotate/scale it, lock it, and calibrate its scale with a two-point real-world distance click.
4. **History, persistence, import.** Undo/redo, localStorage autosave, save/load project files, paste-in import of an existing Pixelblaze map (relaxed JSON and JS generator functions), and a wiring preview that animates the chase order.
5. **Curves and shapes.** Bezier, arc, circle, and polygon geometries, all through the same geometry registry used by line.
