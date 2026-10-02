// Reference image math: fit-to-box, two-point calibration, rotated bbox/corners,
// and unit conversion. No DOM -- RefImage.svelte and ImagePanel.svelte do the
// rendering and file I/O. image = { x, y, scale, rotation, opacity, locked, visible }.
// x/y are the image's centre in world units, scale is world units per source
// image pixel, rotation is degrees (quantized by the caller via quantizeAngle).

// Fits an image of naturalW x naturalH (source pixels) inside a square world
// box (Contain), centred. Returns { x, y, scale } -- not a full image object,
// since a fresh load also needs opacity/locked/visible defaults the caller sets.
export function fitToBox(naturalW, naturalH, box) {
  const w = naturalW > 0 ? naturalW : 1
  const h = naturalH > 0 ? naturalH : 1
  const scale = Math.min(box.size / w, box.size / h)
  return {
    x: box.x + box.size / 2,
    y: box.y + box.size / 2,
    scale
  }
}

// Two-point calibration: scales the image about its own centre so the world
// distance between p1 and p2 becomes realDistance, while the midpoint of
// p1/p2 stays fixed in world space (so the two clicked points don't jump).
// Returns null if the points coincide or realDistance isn't positive --
// callers should leave the image unchanged in that case.
export function calibrateScale(image, p1, p2, realDistance) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  if (!(dist > 1e-9) || !(realDistance > 0)) return null
  const k = realDistance / dist
  const anchor = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  return {
    x: anchor.x + (image.x - anchor.x) * k,
    y: anchor.y + (image.y - anchor.y) * k,
    scale: image.scale * k
  }
}

// The four corners of the (possibly rotated) image rect in world space,
// in order TL, TR, BR, BL.
export function imageCorners(image, naturalW, naturalH) {
  const w = (naturalW || 0) * image.scale
  const h = (naturalH || 0) * image.scale
  const hw = w / 2
  const hh = h / 2
  const rad = (image.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const corner = (lx, ly) => ({
    x: image.x + lx * cos - ly * sin,
    y: image.y + lx * sin + ly * cos
  })
  return [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)]
}

// Axis-aligned bounding box of the rotated image, for the pan/zoom union box.
export function imageBbox(image, naturalW, naturalH) {
  const corners = imageCorners(image, naturalW, naturalH)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of corners) {
    if (c.x < minX) minX = c.x
    if (c.y < minY) minY = c.y
    if (c.x > maxX) maxX = c.x
    if (c.y > maxY) maxY = c.y
  }
  return { minX, minY, maxX, maxY }
}

// Converts x, y, scale to a new unit system; k = convert(1, fromUnit, toUnit)
// from core/units.js. Rotation and the non-geometric fields are untouched.
export function convertImageUnits(image, k) {
  return { x: image.x * k, y: image.y * k, scale: image.scale * k }
}
