// Parses pasted/loaded input for ImportDialog: either a PixelMapper project
// file, or a Pixelblaze map (relaxed JSON array, or a JS generator function
// source). Pure -- no DOM, no Svelte; the dialog does file reading and the
// explicit "evaluate function" click.

// Strips `//` line comments and `/* */` block comments. Naive (doesn't
// understand string literals), which is fine here: the input is always a
// coordinate array or a tiny generator function, never a string containing
// "//" or "/*".
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

// Removes a trailing comma before a closing `]` or `}` -- the Pixelblaze
// Mapper tab's own doc example has one, so the importer has to tolerate it too.
export function stripTrailingCommas(text) {
  return text.replace(/,(\s*[\]}])/g, '$1')
}

export function relaxJSON(text) {
  return stripTrailingCommas(stripComments(text))
}

export function parseRelaxedJSON(text) {
  return JSON.parse(relaxJSON(text))
}

// A JS generator function source, e.g. `function (pixelCount) { ... }` --
// detected by the leading `function` keyword (ignoring an optional wrapping
// paren), never evaluated except on the dialog's explicit "Evaluate" click.
export function isFunctionSource(text) {
  const t = text.trim()
  return /^\(?\s*function\b/.test(t)
}

// Converts a parsed map array ([[x,y],...] or [[x,y,z],...]) into {x,y,z}
// points. Throws with a descriptive message on anything else (so the dialog
// can show it as an error).
export function pointsFromMapArray(arr) {
  if (!Array.isArray(arr)) throw new Error('Expected a top-level array of [x,y] or [x,y,z] entries')
  return arr.map((row, i) => {
    if (!Array.isArray(row) || row.length < 2 || row.length > 3) {
      throw new Error(`Entry ${i} is not a [x,y] or [x,y,z] array`)
    }
    const [x, y, z = 0] = row
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      throw new Error(`Entry ${i} has a non-numeric coordinate`)
    }
    return { x, y, z }
  })
}

// Evaluates a `function (pixelCount) {...}` source with `new Function`, only
// called on the dialog's explicit button click (never automatically) -- the
// tool is local-only, so this is an accepted risk, same as the Pixelblaze
// Mapper tab's own "Load Function" button.
export function evalMapFunction(source, pixelCount) {
  // eslint-disable-next-line no-new-func
  const factory = new Function(`"use strict"; return (${source});`)
  const fn = factory()
  if (typeof fn !== 'function') throw new Error('Source did not evaluate to a function')
  const result = fn(pixelCount)
  return pointsFromMapArray(result)
}

// Detects what pasted/loaded text looks like, without evaluating a function
// source. Returns one of:
//   { kind: 'empty' }
//   { kind: 'function' }                           -- needs an explicit pixelCount + Evaluate click
//   { kind: 'map', points }                         -- relaxed-JSON coordinate array, ready to import
//   { kind: 'project', data }                       -- a PixelMapper project file ({ version, strips: [...] })
//   { kind: 'error', message }
export function detectFormat(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return { kind: 'empty' }
  if (isFunctionSource(trimmed)) return { kind: 'function' }
  let parsed
  try {
    parsed = parseRelaxedJSON(trimmed)
  } catch (err) {
    return { kind: 'error', message: `Could not parse as JSON: ${err.message}` }
  }
  if (Array.isArray(parsed)) {
    try {
      return { kind: 'map', points: pointsFromMapArray(parsed) }
    } catch (err) {
      return { kind: 'error', message: err.message }
    }
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.strips)) {
    return { kind: 'project', data: parsed }
  }
  return { kind: 'error', message: 'Unrecognized JSON: expected a map array ([[x,y],...]) or a project file (an object with a "strips" array).' }
}

// Fits imported map points into the current world box: Contain (keep aspect),
// centred. A single point (zero-size bbox) is just centred with no scaling.
export function fitPointsToWorld(points, world) {
  if (!points.length) return []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const w = maxX - minX
  const h = maxY - minY
  const scale = w > 0 || h > 0 ? Math.min(world.size / (w || 1e-9), world.size / (h || 1e-9)) : 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const wcx = world.x + world.size / 2
  const wcy = world.y + world.size / 2
  return points.map((p) => ({
    x: wcx + (p.x - cx) * scale,
    y: wcy + (p.y - cy) * scale,
    z: (p.z || 0) * scale
  }))
}
