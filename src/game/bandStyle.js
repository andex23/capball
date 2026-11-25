/**
 * Band Studio: the band a team wears round the skirt of every cap. Looks
 * only; it never changes how a cap plays. Pure (the drawing takes a 2D canvas
 * context, so it works for the 3D cap and for previews).
 */
export const BAND_PATTERNS = ['solid', 'twin', 'grid', 'chevron', 'regal']
/** One line for a folded band row: 'Twin Line · Wide · Satin', or 'Off'. */
export function bandSummary(config) {
  const s = bandStyleOf(config)
  return s ? `${BAND_PATTERN_NAMES[s.pattern]} · ${BAND_WIDTH_NAMES[s.width]} · ${s.finish[0].toUpperCase()}${s.finish.slice(1)}` : 'Off'
}
export const BAND_PATTERN_NAMES = { solid: 'Solid', twin: 'Twin Line', grid: 'Grid', chevron: 'Chevron', regal: 'Regal' }
export const BAND_WIDTHS = { slim: 0.055, standard: 0.085, wide: 0.12 } // height on the skirt (cap is 0.3 tall)
export const BAND_WIDTH_NAMES = { slim: 'Slim', standard: 'Standard', wide: 'Wide' }
export const BAND_FINISHES = ['matte', 'satin', 'gloss', 'chrome']

export const BAND_DEFAULTS = { bandEnabled: false, bandPattern: 'solid', bandBase: '#1A1A1A', bandAccent: '#FFD600', bandWidth: 'standard', bandFinish: 'satin' }
export const BAND_FIELDS = Object.keys(BAND_DEFAULTS)

/** The extras bought once from the wallet; everything else is free. */
export const BAND_PART_PRICES = { grid: 500000, chevron: 500000, regal: 500000, gloss: 500000, chrome: 500000 }
export const BAND_PART_NAMES = { grid: 'Grid pattern', chevron: 'Chevron pattern', regal: 'Regal pattern', gloss: 'Gloss finish', chrome: 'Chrome finish' }
/** How each extra looks in the shop. */
export const BAND_PARTS_LOOK = {
  grid: { bandPattern: 'grid', bandBase: '#1E63D6', bandAccent: '#F4F4F4', bandWidth: 'wide', bandFinish: 'satin' },
  chevron: { bandPattern: 'chevron', bandBase: '#1FA34A', bandAccent: '#111111', bandWidth: 'wide', bandFinish: 'satin' },
  regal: { bandPattern: 'regal', bandBase: '#5B1E7A', bandAccent: '#E9C46A', bandWidth: 'wide', bandFinish: 'satin' },
  gloss: { bandPattern: 'solid', bandBase: '#D32F2F', bandAccent: '#FFFFFF', bandWidth: 'wide', bandFinish: 'gloss' },
  chrome: { bandPattern: 'solid', bandBase: '#B8C2CF', bandAccent: '#FFFFFF', bandWidth: 'wide', bandFinish: 'chrome' },
}
export const isFreeBandPart = (key) => !BAND_PART_PRICES[key]

/** The swatches offered for base and accent (one row on a phone). */
export const BAND_COLORS = ['#1A1A1A', '#F4F4F4', '#D32F2F', '#FFD600', '#1FA34A', '#1E63D6', '#5B1E7A', '#E9C46A'] // any other colour with +

const HEX = /^#[0-9a-f]{6}$/i

/** A team config's band, cleaned (anything odd falls back to the default). Null when off. */
export function bandStyleOf(config) {
  if (!config || config.bandEnabled !== true) return null
  return {
    pattern: BAND_PATTERNS.includes(config.bandPattern) ? config.bandPattern : BAND_DEFAULTS.bandPattern,
    base: HEX.test(config.bandBase || '') ? config.bandBase : BAND_DEFAULTS.bandBase,
    accent: HEX.test(config.bandAccent || '') ? config.bandAccent : BAND_DEFAULTS.bandAccent,
    width: BAND_WIDTHS[config.bandWidth] ? config.bandWidth : BAND_DEFAULTS.bandWidth,
    finish: BAND_FINISHES.includes(config.bandFinish) ? config.bandFinish : BAND_DEFAULTS.bandFinish,
  }
}

/** Only the band fields of a config, cleaned: for saves and for what goes over the network. */
export function cleanBandFields(config) {
  const s = bandStyleOf({ ...config, bandEnabled: true })
  return { bandEnabled: config?.bandEnabled === true, bandPattern: s.pattern, bandBase: s.base, bandAccent: s.accent, bandWidth: s.width, bandFinish: s.finish }
}

/**
 * Paint the band's strip: w wide (once round the cap), h tall. The pattern
 * repeats a whole number of times so it meets itself cleanly at the seam.
 */
export function drawBand(ctx, w, h, { pattern, base, accent }) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = accent
  ctx.strokeStyle = accent
  if (pattern === 'twin') {
    const t = Math.max(2, h * 0.12)
    ctx.fillRect(0, h * 0.2, w, t)
    ctx.fillRect(0, h * 0.8 - t, w, t)
  } else if (pattern === 'grid') {
    const n = 48
    const step = w / n
    ctx.lineWidth = Math.max(1.5, h * 0.07)
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(i * step + step / 2, 0); ctx.lineTo(i * step + step / 2, h); ctx.stroke() }
    for (const y of [h / 3, (2 * h) / 3]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  } else if (pattern === 'chevron') {
    const n = 21 // one per pleat
    const step = w / n
    ctx.lineWidth = Math.max(2, h * 0.16)
    ctx.lineJoin = 'miter'
    for (let i = 0; i < n; i++) {
      const x = i * step
      ctx.beginPath(); ctx.moveTo(x + step * 0.2, h * 0.18); ctx.lineTo(x + step * 0.6, h * 0.5); ctx.lineTo(x + step * 0.2, h * 0.82); ctx.stroke()
    }
  } else if (pattern === 'regal') {
    const e = Math.max(2, h * 0.1)
    ctx.fillRect(0, 0, w, e)
    ctx.fillRect(0, h - e, w, e)
    const n = 14
    const step = w / n
    for (let i = 0; i < n; i++) {
      const cx = i * step + step / 2
      const cy = h / 2
      const r = h * 0.26
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy); ctx.closePath(); ctx.fill()
      for (const dx of [-step * 0.3, step * 0.3]) { ctx.beginPath(); ctx.arc(cx + dx, cy, h * 0.07, 0, Math.PI * 2); ctx.fill() }
    }
  }
  // A soft shade top and bottom so it reads as a stretched band, not paint
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.18, 'rgba(0,0,0,0)'); g.addColorStop(0.82, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.32)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/** The paid extras a config's band uses. */
export function bandPartsUsed(config) {
  const s = bandStyleOf(config)
  if (!s) return []
  return [s.pattern, s.finish].filter((k) => BAND_PART_PRICES[k])
}

/**
 * A config with any band extra this player hasn't bought swapped for a free
 * one (pattern back to Solid, finish back to Satin). Null when it's fine.
 */
export function ownBand(config, owns) {
  const s = bandStyleOf(config)
  if (!s) return null
  const patch = {}
  if (BAND_PART_PRICES[s.pattern] && !owns(s.pattern)) patch.bandPattern = 'solid'
  if (BAND_PART_PRICES[s.finish] && !owns(s.finish)) patch.bandFinish = 'satin'
  return Object.keys(patch).length ? { ...config, ...patch } : null
}
