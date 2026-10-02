// Unit conversion and LED pitch helpers. No DOM, no Svelte.

const MM_PER_IN = 25.4

// Convert a value between the three supported units.
export function convert(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value
  const mm = toMm(value, fromUnit)
  return fromMm(mm, toUnit)
}

function toMm(value, unit) {
  if (unit === 'mm') return value
  if (unit === 'in') return value * MM_PER_IN
  if (unit === 'px') return value // px treated as 1:1 with mm for on-screen world units
  throw new Error(`unknown unit: ${unit}`)
}

function fromMm(mm, unit) {
  if (unit === 'mm') return mm
  if (unit === 'in') return mm / MM_PER_IN
  if (unit === 'px') return mm
  throw new Error(`unknown unit: ${unit}`)
}

// Common LED strip densities, expressed as LEDs per metre.
// Pitch is the centre-to-centre spacing in mm, derived as 1000 / density.
export const PITCH_PRESETS = [30, 60, 96, 144].map((perMetre) => ({
  perMetre,
  pitchMm: round(1000 / perMetre)
}))

export function pitchMmFromDensity(perMetre) {
  return round(1000 / perMetre)
}

function round(n) {
  return Math.round(n * 1000) / 1000
}

export const UNIT_LABELS = { mm: 'mm', in: 'in', px: 'px' }

// Display formatting: about 5 significant digits by limiting decimals only,
// so large values (e.g. 200000 mm stage coordinates) keep their integer part.
export function fmt(n, sig = 5) {
  if (typeof n !== 'number' || !isFinite(n)) return n
  const a = Math.abs(n)
  const intDigits = a >= 1 ? Math.floor(Math.log10(a)) + 1 : 1
  return +n.toFixed(Math.max(0, sig - intDigits))
}
