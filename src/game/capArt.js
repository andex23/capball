/**
 * Printed artwork for cap tops, drawn on a 2D canvas so the same drawing is
 * used for the kit previews and the 3D caps on the pitch.
 *
 * Every drawing works in a disc of radius 100 centred on (0, 0). Three
 * families, each with its own look:
 *  - drink caps: vintage label print, two or three flat inks, a wordmark,
 *    a ribbon and fine print round the rim
 *  - rare caps: enamel medals, the only caps with metal
 *  - Lagos Life exclusives: full-bleed pictures of Lagos
 */

import { WEEK_CAPS } from './rewards.js'

const COND = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif'
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif'
const PAPER = '#F3EBD8' // printed white on tin is never pure white

/* ── Drawing helpers ── */

function disc(ctx, r, fill) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill()
}

function ring(ctx, r, w, color) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke()
}

function text(ctx, str, x, y, { size = 30, font = COND, weight = 800, color = PAPER, italic = false, spacing = 0, stroke = null, strokeW = 0, align = 'center', maxW = null } = {}) {
  ctx.save()
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (maxW) {
    const w = ctx.measureText(str).width
    if (w > maxW) { ctx.translate(x, y); ctx.scale(maxW / w, 1); x = 0; y = 0 }
  }
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = strokeW; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y) }
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
  ctx.restore()
}

function starPath(ctx, x, y, rOut, rIn, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rIn : rOut
    const a = rot + (i * Math.PI) / points
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

/** A ribbon banner with folded tails, centred at (0, y). */
function banner(ctx, y, w, h, fill, shade, label, labelColor, size = h * 0.72) {
  const t = h * 0.75
  ctx.save()
  // tails
  ctx.fillStyle = shade
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(s * (w / 2 - 4), y - h / 2 + 5)
    ctx.lineTo(s * (w / 2 + t), y - h / 2 + 5)
    ctx.lineTo(s * (w / 2 + t * 0.55), y + 5)
    ctx.lineTo(s * (w / 2 + t), y + h / 2 + 5)
    ctx.lineTo(s * (w / 2 - 4), y + h / 2 + 5)
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = fill
  ctx.fillRect(-w / 2, y - h / 2, w, h)
  ctx.restore()
  text(ctx, label, 0, y + 1, { size, color: labelColor, maxW: w - 8 })
}

/** Small marks round the rim, like the dot border on a printed cap. */
function dotRing(ctx, r, n, size, color) {
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, size, 0, Math.PI * 2); ctx.fill()
  }
}

/** A laurel branch on each side, rising from the bottom. */
function laurel(ctx, r, color, leaves = 9, size = 9) {
  ctx.fillStyle = color
  for (const s of [-1, 1]) {
    for (let i = 0; i < leaves; i++) {
      const a = Math.PI / 2 + s * (0.35 + (i / leaves) * 1.9)
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a + (s > 0 ? Math.PI * 0.85 : Math.PI * 0.15))
      ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.42, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
  }
}

function metal(ctx, r, stops) {
  const g = ctx.createLinearGradient(-r, -r, r, r)
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  return g
}

/* ── Drink caps ── */

const ART = {
  cola(ctx, w = {}) {
    disc(ctx, 100, '#C8102E')
    // the white sweep
    ctx.save(); ctx.beginPath()
    ctx.moveTo(-110, 18); ctx.bezierCurveTo(-55, -30, 10, 55, 110, -8)
    ctx.lineTo(110, 22); ctx.bezierCurveTo(10, 80, -55, 0, -110, 46); ctx.closePath()
    ctx.fillStyle = PAPER; ctx.fill(); ctx.restore()
    text(ctx, (w.main || 'Cola'), -2, -22, { size: 64, italic: true, color: PAPER, stroke: '#8E0C20', strokeW: 6 })
    ring(ctx, 95, 2, PAPER)
  },

  greenlager(ctx, w = {}) {
    disc(ctx, 100, '#0E5E36')
    ring(ctx, 94, 3, '#E8C766'); ring(ctx, 88, 1, '#E8C766')
    // radiating fine lines behind the star
    ctx.save(); ctx.strokeStyle = 'rgba(232,199,102,0.35)'; ctx.lineWidth = 1
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26 - 12); ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62 - 12); ctx.stroke() }
    ctx.restore()
    starPath(ctx, 0, -14, 30, 12); ctx.fillStyle = '#E8C766'; ctx.fill()
    starPath(ctx, 0, -14, 30, 12); ctx.lineWidth = 2; ctx.strokeStyle = '#0E5E36'; ctx.stroke()
    banner(ctx, 30, 108, 24, '#E8C766', '#B8963E', (w.main || 'LAGER'), '#0E5E36')
  },

  redlager(ctx, w = {}) {
    disc(ctx, 100, '#B3121B')
    dotRing(ctx, 92, 40, 1.8, '#F2C14E')
    disc(ctx, 64, '#F2C14E')
    disc(ctx, 58, '#B3121B')
    starPath(ctx, 0, -14, 36, 15); ctx.fillStyle = '#F2C14E'; ctx.fill()
    banner(ctx, 30, 84, 20, '#F2C14E', '#B88A2A', (w.main || 'EXTRA'), '#B3121B')
  },

  stout(ctx, w = {}) {
    disc(ctx, 100, '#111111')
    ring(ctx, 93, 1.5, '#C9A35A'); ring(ctx, 89, 0.8, '#C9A35A')
    // cream oval medallion
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -2, 52, 62, 0, 0, Math.PI * 2); ctx.fillStyle = '#EADFC8'; ctx.fill()
    ctx.lineWidth = 3; ctx.strokeStyle = '#C9A35A'; ctx.stroke(); ctx.restore()
    text(ctx, (w.main || 'STOUT'), 0, -8, { size: 40, color: '#111111', spacing: 1 })
    // three small bars, like a tasting mark
    ctx.fillStyle = '#111111'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 10 - 3, 34, 6, 6)
  },

  malta(ctx, w = {}) {
    disc(ctx, 100, '#4A2610')
    ring(ctx, 94, 6, '#E8B84A')
    // two wheat ears
    ctx.save(); ctx.fillStyle = '#E8B84A'; ctx.strokeStyle = '#E8B84A'; ctx.lineWidth = 2.5
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * 0.28)
      ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(0, -40); ctx.stroke()
      for (let i = 0; i < 6; i++) { for (const t of [-1, 1]) { ctx.save(); ctx.translate(t * 5, -32 + i * 11); ctx.rotate(t * 0.5); ctx.beginPath(); ctx.ellipse(0, 0, 4, 7.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() } }
      ctx.restore()
    }
    ctx.restore()
    banner(ctx, 18, 112, 26, '#E8B84A', '#B5862E', (w.main || 'MALTA'), '#4A2610')
  },

  orange(ctx, w = {}) {
    disc(ctx, 100, '#F57F17')
    // bubbles
    const b = [[-60, -40, 9], [-42, -62, 5], [55, -50, 7], [66, -22, 4], [-70, 20, 5], [62, 30, 8], [40, 62, 5], [-38, 60, 7], [-15, -72, 4], [20, -70, 6]]
    for (const [x, y, r] of b) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,210,0.85)'; ctx.stroke() }
    // blue splash
    ctx.save(); ctx.beginPath()
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 46 : 58; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.62 + 6) }
    ctx.closePath(); ctx.fillStyle = '#0B3D91'; ctx.fill(); ctx.restore()
    text(ctx, (w.main || 'ORANGE'), 0, 6, { size: 34, italic: true, color: '#FFB300', stroke: '#06235A', strokeW: 4, spacing: 1 })
  },

  lemon(ctx, w = {}) {
    // diagonal two-tone
    disc(ctx, 100, '#1E8E3E')
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
    ctx.beginPath(); ctx.moveTo(-100, 100); ctx.lineTo(100, -40); ctx.lineTo(100, 100); ctx.closePath(); ctx.fillStyle = '#FFE14D'; ctx.fill(); ctx.restore()
    // lemon slice
    ctx.save(); ctx.translate(-36, 44)
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fillStyle = '#FFF6B0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#E6C200'; ctx.stroke()
    ctx.fillStyle = '#FFE14D'; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 24, a + 0.08, a + Math.PI / 4 - 0.08); ctx.closePath(); ctx.fill() }
    ctx.restore()
    text(ctx, (w.main || 'Lemon'), -22, -30, { size: 40, italic: true, color: PAPER, stroke: '#0F5A26', strokeW: 5 })
    text(ctx, (w.sub || '+ LIME'), -26, 0, { size: 20, color: '#FFE14D', spacing: 1 })
  },

  bitter(ctx, w = {}) {
    disc(ctx, 100, '#F2D21B')
    ring(ctx, 93, 3, '#1E5E2E')
    // lemon wedge
    ctx.save(); ctx.translate(0, -18)
    ctx.beginPath(); ctx.arc(0, 0, 40, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#1E5E2E'; ctx.fill()
    ctx.beginPath(); ctx.arc(0, 0, 33, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#FFF6B0'; ctx.fill()
    ctx.fillStyle = '#F2D21B'; for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 5) * Math.PI; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 28, a + 0.08, a + Math.PI / 5 - 0.08); ctx.closePath(); ctx.fill() }
    ctx.restore()
    text(ctx, (w.main || 'BITTER'), 0, 14, { size: 30, color: '#1E5E2E', spacing: 2 })
    text(ctx, (w.sub || 'LEMON'), -8, 38, { size: 20, color: '#1E5E2E', spacing: 4 })
  },

  ginger(ctx, w = {}) {
    disc(ctx, 100, '#0B4D2C')
    disc(ctx, 72, '#E8C766'); disc(ctx, 66, '#0B4D2C')
    // a knobbly ginger root
    ctx.save(); ctx.fillStyle = '#E8C766'
    const knobs = [[-28, -6, 15, 10], [-6, -12, 17, 11], [18, -4, 15, 10], [-14, 8, 11, 8], [10, 10, 10, 8], [32, -16, 9, 7]]
    for (const [x, y, rx, ry] of knobs) { ctx.beginPath(); ctx.ellipse(x, y - 14, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill() }
    ctx.restore()
    text(ctx, (w.main || 'GINGER'), 0, 24, { size: 28, color: '#E8C766', spacing: 2 })
    text(ctx, (w.sub || 'ALE'), 0, 46, { size: 16, color: '#E8C766', spacing: 6 })
  },

  tonic(ctx, w = {}) {
    disc(ctx, 100, '#00737E')
    // rising bubbles in a column
    for (let i = 0; i < 18; i++) { const side = i % 2 ? 1 : -1; const x = side * (56 + Math.sin(i * 2.3) * 8); const y = 50 - i * 6; const r = 2 + (i % 4); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(220,255,255,0.8)'; ctx.stroke() }
    text(ctx, (w.main || 'TONIC'), 0, -6, { size: 42, color: PAPER, spacing: 3, stroke: '#00525A', strokeW: 6 })
    text(ctx, (w.sub || 'WATER'), 0, 24, { size: 14, font: SANS, weight: 800, color: '#BFF3F0', spacing: 6 })
    ring(ctx, 92, 1.5, '#BFF3F0'); ring(ctx, 87, 1.5, '#BFF3F0')
  },

  harmattan(ctx, w = {}) {
    // Dry-season haze: a pale sun low over the dunes, ochre sky
    disc(ctx, 100, '#C9771E')
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
    const haze = ctx.createLinearGradient(0, -100, 0, 40)
    haze.addColorStop(0, '#B8661A'); haze.addColorStop(1, '#E29A3C')
    ctx.fillStyle = haze; ctx.fillRect(-100, -100, 200, 140)
    ctx.beginPath(); ctx.arc(0, 2, 34, Math.PI, 0); ctx.fillStyle = '#F6E7C4'; ctx.fill()
    ctx.fillStyle = '#5A2E12'
    ctx.beginPath(); ctx.moveTo(-100, 14); ctx.quadraticCurveTo(-40, -6, 10, 14); ctx.quadraticCurveTo(60, 30, 100, 8); ctx.lineTo(100, 100); ctx.lineTo(-100, 100); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#3E1F0B'
    ctx.beginPath(); ctx.moveTo(-100, 40); ctx.quadraticCurveTo(-20, 20, 40, 38); ctx.quadraticCurveTo(80, 48, 100, 36); ctx.lineTo(100, 100); ctx.lineTo(-100, 100); ctx.closePath(); ctx.fill()
    ctx.restore()
    text(ctx, (w.main || 'HARMATTAN'), 0, -52, { size: 30, color: '#F6E7C4', spacing: 2, stroke: '#7A3E10', strokeW: 4, maxW: 150 })
    text(ctx, (w.sub || 'DRY SEASON LAGER'), 0, 60, { size: 11, font: SANS, weight: 800, color: '#F6E7C4', spacing: 2, maxW: 118 })
    ring(ctx, 94, 2.5, '#F6E7C4')
  },

  lagoon(ctx, w = {}) {
    // Night on the water: a palm against a gold moon, ripples below
    disc(ctx, 100, '#3F1A4E')
    dotRing(ctx, 91, 44, 1.6, '#E8B84A')
    ctx.beginPath(); ctx.arc(26, -26, 24, 0, Math.PI * 2); ctx.fillStyle = '#E8B84A'; ctx.fill()
    // palm: a curved trunk and five fronds
    ctx.save(); ctx.strokeStyle = '#1C0A24'; ctx.lineCap = 'round'
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18, 34); ctx.quadraticCurveTo(-30, 0, -10, -34); ctx.stroke()
    ctx.fillStyle = '#1C0A24'
    for (const a of [-2.7, -2.1, -1.5, -0.9, -0.3]) {
      ctx.save(); ctx.translate(-10, -34); ctx.rotate(a)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(22, -12, 42, 6); ctx.quadraticCurveTo(22, -2, 0, 4); ctx.closePath(); ctx.fill()
      ctx.restore()
    }
    ctx.restore()
    // ripples
    ctx.save(); ctx.strokeStyle = 'rgba(232,184,74,0.75)'; ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) { const y = 42 + i * 8; ctx.beginPath(); ctx.moveTo(-50 + i * 10, y); ctx.bezierCurveTo(-20, y - 4, 20, y + 4, 50 - i * 10, y); ctx.stroke() }
    ctx.restore()
    text(ctx, (w.main || 'Suncity'), 4, 12, { size: 46, italic: true, color: '#F3EBD8', stroke: '#1C0A24', strokeW: 5 })
  },

  /* ── Rare caps: enamel medals ── */

  silver(ctx) {
    disc(ctx, 100, '#20335A')
    disc(ctx, 80, metal(ctx, 80, ['#F4F7FA', '#AEB8C4', '#E8EDF2', '#8D98A6']))
    disc(ctx, 66, '#20335A')
    laurel(ctx, 56, '#C9D3DE', 8, 8)
    text(ctx, '10', 0, -6, { size: 58, color: '#F4F7FA' })
    text(ctx, 'WINS', 0, 30, { size: 13, font: SANS, weight: 800, color: '#C9D3DE', spacing: 4 })
  },

  wall(ctx) {
    disc(ctx, 100, '#2B3238')
    // shield
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(48, -44); ctx.lineTo(44, 10); ctx.quadraticCurveTo(30, 48, 0, 64); ctx.quadraticCurveTo(-30, 48, -44, 10); ctx.lineTo(-48, -44); ctx.closePath()
    ctx.fillStyle = metal(ctx, 64, ['#DDE3E8', '#8E99A3', '#C9D0D6', '#6E7A84']); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#151A1E'; ctx.stroke(); ctx.restore()
    // padlock
    ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = '#151A1E'; ctx.beginPath(); ctx.arc(0, -10, 14, Math.PI, 0); ctx.stroke()
    ctx.fillStyle = '#151A1E'; ctx.fillRect(-21, -10, 42, 34); ctx.fillStyle = '#C9D0D6'; ctx.beginPath(); ctx.arc(0, 4, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-2, 4, 4, 11); ctx.restore()
  },

  lucky(ctx) {
    disc(ctx, 100, '#0B6B3A')
    ring(ctx, 92, 2, '#F2C14E')
    // a week of ticks round a big 7
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + ((i - 3) / 7) * Math.PI * 1.25
      const x = Math.cos(a) * 70; const y = Math.sin(a) * 70
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = '#F2C14E'; ctx.fill()
      ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0B6B3A'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 3.5); ctx.lineTo(4.5, -3.5); ctx.stroke(); ctx.restore()
    }
    text(ctx, '7', 0, 6, { size: 96, italic: true, color: '#F2C14E', stroke: '#063F22', strokeW: 6 })
  },

  boot(ctx) {
    disc(ctx, 100, '#141414')
    // flames licking up from the bottom
    ctx.save(); ctx.beginPath(); ctx.moveTo(-100, 100)
    for (let i = 0; i <= 10; i++) { const x = -100 + i * 20; const h = 30 + ((i * 37) % 5) * 9; ctx.quadraticCurveTo(x - 10, 60 - h, x, 100 - h * 0.2) }
    ctx.lineTo(100, 100); ctx.closePath(); ctx.fillStyle = '#E64A19'; ctx.fill()
    ctx.beginPath(); ctx.moveTo(-100, 100)
    for (let i = 0; i <= 10; i++) { const x = -100 + i * 20; const h = 18 + ((i * 53) % 4) * 7; ctx.quadraticCurveTo(x - 10, 78 - h, x, 100 - h * 0.1) }
    ctx.lineTo(100, 100); ctx.closePath(); ctx.fillStyle = '#FFC107'; ctx.fill(); ctx.restore()
    text(ctx, '50', 0, -18, { size: 76, color: '#FFD54F', stroke: '#141414', strokeW: 6 })
    text(ctx, 'GOALS', 0, 26, { size: 14, font: SANS, weight: 800, color: '#FFFFFF', spacing: 5 })
  },

  cup(ctx) {
    disc(ctx, 100, '#7A0010')
    const gold = metal(ctx, 60, ['#FFF3B0', '#D4AF37', '#FFE58A', '#A27C1B'])
    ctx.save(); ctx.fillStyle = gold
    // trophy: cup, handles, stem, base
    ctx.beginPath(); ctx.moveTo(-34, -48); ctx.lineTo(34, -48); ctx.quadraticCurveTo(34, 0, 0, 8); ctx.quadraticCurveTo(-34, 0, -34, -48); ctx.fill()
    ctx.lineWidth = 7; ctx.strokeStyle = gold
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 36, -30, 13, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke() }
    ctx.fillRect(-6, 6, 12, 18); ctx.fillRect(-24, 24, 48, 10); ctx.fillRect(-30, 34, 60, 8)
    ctx.restore()
    dotRing(ctx, 90, 30, 2, '#D4AF37')
  },

  gold(ctx) {
    disc(ctx, 100, '#0D3B66')
    // three rising chevrons
    const g = metal(ctx, 60, ['#FFF3B0', '#D4AF37', '#FFE58A', '#A27C1B'])
    ctx.save(); ctx.fillStyle = g
    for (let i = 0; i < 3; i++) { const y = 30 - i * 30; ctx.beginPath(); ctx.moveTo(-46, y + 18); ctx.lineTo(0, y - 16); ctx.lineTo(46, y + 18); ctx.lineTo(46, y + 4); ctx.lineTo(0, y - 30); ctx.lineTo(-46, y + 4); ctx.closePath(); ctx.fill() }
    ctx.restore()
    ring(ctx, 94, 2, '#D4AF37')
  },

  royal(ctx) {
    disc(ctx, 100, '#3B0A6B')
    // velvet sheen
    const v = ctx.createRadialGradient(-30, -30, 10, 0, 0, 100); v.addColorStop(0, 'rgba(255,255,255,0.12)'); v.addColorStop(1, 'rgba(0,0,0,0.25)')
    disc(ctx, 100, v)
    laurel(ctx, 70, '#D4AF37', 10, 10)
    const g = metal(ctx, 50, ['#FFF3B0', '#D4AF37', '#FFE58A', '#A27C1B'])
    // crown
    ctx.save(); ctx.beginPath(); ctx.moveTo(-40, 14); ctx.lineTo(-44, -26); ctx.lineTo(-20, -6); ctx.lineTo(0, -40); ctx.lineTo(20, -6); ctx.lineTo(44, -26); ctx.lineTo(40, 14); ctx.closePath(); ctx.fillStyle = g; ctx.fill()
    ctx.fillRect(-40, 16, 80, 10)
    for (const [x, y, c] of [[0, -40, '#E53935'], [-44, -26, '#1E88E5'], [44, -26, '#1E88E5']]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill() }
    ctx.restore()
    for (let i = -1; i <= 1; i++) { starPath(ctx, i * 22, 48, 7, 3); ctx.fillStyle = '#FFE58A'; ctx.fill() }
  },

  /* ── Lagos Life exclusives ── */

  danfo(ctx) {
    disc(ctx, 100, '#FFC400')
    // the bus side: two black bands, a row of windows between them
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
    ctx.fillStyle = '#121212'; ctx.fillRect(-100, -20, 200, 8); ctx.fillRect(-100, 30, 200, 8)
    ctx.fillStyle = '#2A3540'; for (let i = -3; i <= 2; i++) ctx.fillRect(i * 30 + 3, -50, 24, 24)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = -3; i <= 2; i++) ctx.fillRect(i * 30 + 5, -48, 6, 20)
    // headlights and grille
    for (const x of [-52, 52]) { ctx.beginPath(); ctx.arc(x, 5, 11, 0, Math.PI * 2); ctx.fillStyle = '#121212'; ctx.fill(); ctx.beginPath(); ctx.arc(x, 5, 6.5, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill() }
    ctx.fillStyle = '#121212'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 9 - 2, -6, 4, 22)
    ctx.restore()
  },

  jollof(ctx) {
    disc(ctx, 100, '#2A0E06')
    // the pot
    ctx.save(); ctx.fillStyle = '#5A5F66'; ctx.beginPath(); ctx.ellipse(0, 22, 60, 38, 0, 0, Math.PI); ctx.fill()
    ctx.fillRect(-60, 8, 120, 14)
    ctx.fillStyle = '#7C828A'; ctx.beginPath(); ctx.ellipse(0, 8, 60, 13, 0, 0, Math.PI * 2); ctx.fill()
    // rice, red-orange, piled
    ctx.fillStyle = '#D84315'; ctx.beginPath(); ctx.ellipse(0, 6, 54, 10, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 14, 0, Math.PI, 0); ctx.fill()
    ctx.fillStyle = '#FF8A3D'; for (let i = 0; i < 26; i++) { const x = Math.sin(i * 7.1) * 42; const y = Math.cos(i * 3.7) * 6 + 2; ctx.fillRect(x, y, 3, 1.6) }
    // pepper, bay leaf
    ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.ellipse(18, -4, 9, 4, -0.4, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // steam
    ctx.save(); ctx.strokeStyle = 'rgba(255,236,200,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'
    for (const x of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(x, -18); ctx.bezierCurveTo(x - 10, -32, x + 10, -42, x, -58); ctx.stroke() }
    ctx.restore()
  },

  ankara(ctx) {
    // a wax-print tile: concentric rings and leaves in alternating cells
    disc(ctx, 100, '#E65100')
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
    const cell = 50
    for (let gx = -2; gx <= 2; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        const x = gx * cell; const y = gy * cell + (gx % 2 ? cell / 2 : 0)
        if ((gx + gy) % 2 === 0) {
          for (const [r, c] of [[22, '#00897B'], [16, '#FFD54F'], [10, '#3E1F0E'], [5, '#FFD54F']]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill() }
        } else {
          ctx.fillStyle = '#3E1F0E'
          for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(x, y); ctx.rotate((k * Math.PI) / 2 + Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, -11, 5, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#00897B'; ctx.fill()
        }
      }
    }
    ctx.restore()
  },

  eko(ctx) {
    // night sky to lagoon
    const sky = ctx.createLinearGradient(0, -100, 0, 100)
    sky.addColorStop(0, '#0A0420'); sky.addColorStop(0.55, '#2B0B4A'); sky.addColorStop(0.56, '#05101E'); sky.addColorStop(1, '#0A1A30')
    disc(ctx, 100, sky)
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
    // skyline
    ctx.fillStyle = '#12082A'; const towers = [[-90, 30], [-74, 52], [-60, 40], [-46, 64], [-30, 34], [36, 44], [50, 70], [64, 38], [80, 56]]
    for (const [x, h] of towers) ctx.fillRect(x, 8 - h, 13, h)
    ctx.fillStyle = '#FFD54F'; for (const [x, h] of towers) for (let w = 0; w < h - 8; w += 8) if ((x + w) % 3 === 0) ctx.fillRect(x + 3, 8 - h + w + 4, 2, 2)
    // the bridge: a long low curve with pink lights
    ctx.strokeStyle = '#FF2E88'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-110, 20); ctx.quadraticCurveTo(0, -6, 110, 20); ctx.stroke()
    ctx.fillStyle = '#FFE0F0'; for (let i = -10; i <= 10; i++) { const t = (i + 10) / 20; const x = -110 + t * 220; const y = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * -6 + t * t * 20; ctx.beginPath(); ctx.arc(x, y - 3, 1.6, 0, Math.PI * 2); ctx.fill() }
    for (let i = -9; i <= 9; i += 2) { ctx.fillStyle = '#3A1052'; ctx.fillRect(i * 11, 14, 3, 18) }
    // reflections on the lagoon
    ctx.strokeStyle = 'rgba(255,46,136,0.55)'; ctx.lineWidth = 2
    for (let i = 0; i < 6; i++) { const y = 40 + i * 9; ctx.beginPath(); ctx.moveTo(-60 + i * 7, y); ctx.lineTo(60 - i * 9, y); ctx.stroke() }
    ctx.restore()
  },

  naija(ctx) {
    // green-white-green, a gold crown, OGA in heavy type
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
    ctx.fillStyle = '#008751'; ctx.fillRect(-100, -100, 200, 200)
    ctx.fillStyle = PAPER; ctx.fillRect(-34, -100, 68, 200)
    ctx.restore()
    const g = metal(ctx, 40, ['#FFF3B0', '#D4AF37', '#FFE58A', '#A27C1B'])
    ctx.save(); ctx.beginPath(); ctx.moveTo(-30, -26); ctx.lineTo(-33, -58); ctx.lineTo(-15, -42); ctx.lineTo(0, -66); ctx.lineTo(15, -42); ctx.lineTo(33, -58); ctx.lineTo(30, -26); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#6E5410'; ctx.stroke(); ctx.restore()
    text(ctx, 'OGA', 0, 8, { size: 58, color: '#0B3B24', stroke: '#D4AF37', strokeW: 4, spacing: 1 })
    ring(ctx, 95, 3, '#D4AF37')
  },
}

/* ── Weekly Cup winners' badges: stitched club-crest patches ── */

/** Twill fabric: the patch's base cloth with a fine diagonal weave. */
function twill(ctx, color, r = 100) {
  disc(ctx, r, color)
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
  for (let x = -220; x <= 220; x += 3) { ctx.beginPath(); ctx.moveTo(x, -110); ctx.lineTo(x + 110, 110); ctx.stroke() }
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'
  for (let x = -220; x <= 220; x += 3) { ctx.beginPath(); ctx.moveTo(x + 1.5, -110); ctx.lineTo(x + 111.5, 110); ctx.stroke() }
  ctx.restore()
}

/** Satin stitch: fill the current path, then lay thread lines across it at an angle. */
function satin(ctx, path, color, angle = 0.8, gap = 2.2) {
  ctx.save(); path(); ctx.fillStyle = color; ctx.fill(); ctx.clip()
  ctx.rotate(angle); ctx.lineWidth = 0.9
  for (let x = -160; x <= 160; x += gap) { ctx.strokeStyle = (x / gap) % 2 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.moveTo(x, -160); ctx.lineTo(x, 160); ctx.stroke() }
  ctx.restore()
}

/** A running stitch along a path, a few px inside the edge. */
function stitch(ctx, path, color, w = 1.8, dash = [5, 3.5]) {
  ctx.save(); path(); ctx.setLineDash(dash); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore()
}

/** Merrowed edge: the thick overlocked border round a patch. */
function merrow(ctx, color) {
  ctx.save()
  ctx.lineWidth = 9; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(0, 0, 95, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = 1.2
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2
    ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.22)'
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 90.5, Math.sin(a) * 90.5); ctx.lineTo(Math.cos(a + 0.05) * 99.5, Math.sin(a + 0.05) * 99.5); ctx.stroke()
  }
  ctx.restore()
}

/** Letters round an arc (top of the patch), centred on the top. */
function arcText(ctx, str, r, { size = 14, color = PAPER, spacing = 1.5, stroke = '#000', strokeW = 3, bottom = false } = {}) {
  ctx.save()
  ctx.font = `800 ${size}px ${COND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const widths = [...str].map((ch) => ctx.measureText(ch).width + spacing)
  const total = widths.reduce((a, b) => a + b, 0)
  let a = (bottom ? Math.PI / 2 : -Math.PI / 2) + (bottom ? 1 : -1) * (total / r) / 2
  ;[...str].forEach((ch, i) => {
    const step = widths[i] / r
    a += (bottom ? -1 : 1) * step / 2
    ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a + (bottom ? -Math.PI / 2 : Math.PI / 2))
    ctx.lineJoin = 'round'; ctx.lineWidth = strokeW; ctx.strokeStyle = stroke; ctx.strokeText(ch, 0, 0)
    ctx.fillStyle = color; ctx.fillText(ch, 0, 0); ctx.restore()
    a += (bottom ? -1 : 1) * step / 2
  })
  ctx.restore()
}

const SHIELDS = {
  heater: (ctx) => { ctx.beginPath(); ctx.moveTo(-46, -50); ctx.lineTo(46, -50); ctx.lineTo(46, -6); ctx.quadraticCurveTo(44, 36, 0, 58); ctx.quadraticCurveTo(-44, 36, -46, -6); ctx.closePath() },
  round: (ctx) => { ctx.beginPath(); ctx.arc(0, 2, 52, 0, Math.PI * 2) },
  pointed: (ctx) => { ctx.beginPath(); ctx.moveTo(-48, -50); ctx.lineTo(-24, -42); ctx.lineTo(0, -54); ctx.lineTo(24, -42); ctx.lineTo(48, -50); ctx.lineTo(44, 10); ctx.lineTo(0, 60); ctx.lineTo(-44, 10); ctx.closePath() },
  swiss: (ctx) => { ctx.beginPath(); ctx.moveTo(-48, -40); ctx.quadraticCurveTo(-24, -58, 0, -44); ctx.quadraticCurveTo(24, -58, 48, -40); ctx.lineTo(44, 16); ctx.quadraticCurveTo(30, 48, 0, 60); ctx.quadraticCurveTo(-30, 48, -44, 16); ctx.closePath() },
  octagon: (ctx) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.lineTo(Math.cos(a) * 54, 2 + Math.sin(a) * 54) } ctx.closePath() },
}

/** Heraldic splits of the shield in two colours. */
const SPLITS = {
  pale: (ctx, b) => { ctx.fillStyle = b; ctx.fillRect(0, -70, 70, 140) },
  bend: (ctx, b) => { ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(-70, -70); ctx.lineTo(70, 70); ctx.lineTo(70, -70); ctx.closePath(); ctx.fill() },
  quarter: (ctx, b) => { ctx.fillStyle = b; ctx.fillRect(0, -70, 70, 70); ctx.fillRect(-70, 0, 70, 70) },
  hoops: (ctx, b) => { ctx.fillStyle = b; for (let y = -60; y < 70; y += 26) ctx.fillRect(-70, y, 140, 13) },
  stripes: (ctx, b) => { ctx.fillStyle = b; for (let x = -63; x < 70; x += 21) ctx.fillRect(x, -70, 10.5, 140) },
  chevron: (ctx, b) => { ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(-70, 30); ctx.lineTo(0, -16); ctx.lineTo(70, 30); ctx.lineTo(70, 54); ctx.lineTo(0, 8); ctx.lineTo(-70, 54); ctx.closePath(); ctx.fill() },
  chief: (ctx, b) => { ctx.fillStyle = b; ctx.fillRect(-70, -70, 140, 42) },
  saltire: (ctx, b) => { ctx.strokeStyle = b; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(-70, -70); ctx.lineTo(70, 70); ctx.moveTo(70, -70); ctx.lineTo(-70, 70); ctx.stroke() },
}

function crestPatch(ctx, c, w = {}) {
  const shield = () => SHIELDS[c.shield](ctx)
  twill(ctx, c.cloth)
  // the shield: two-colour split in satin stitch, then the emblem on top
  satin(ctx, shield, c.a, 0.9)
  ctx.save(); shield(); ctx.clip(); SPLITS[c.split](ctx, c.b)
  ctx.globalAlpha = 1; ctx.rotate(-0.7); ctx.lineWidth = 0.9
  for (let x = -160; x <= 160; x += 2.2) { ctx.strokeStyle = (x / 2.2) % 2 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.moveTo(x, -160); ctx.lineTo(x, 160); ctx.stroke() }
  ctx.restore()
  // emblem, a little shadow under it like raised thread
  ctx.save(); ctx.translate(0, 2); ctx.scale(0.62, 0.62)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowOffsetY = 2.5; ctx.shadowBlur = 2
  EMBLEMS[c.emblem](ctx)
  ctx.restore()
  // thread over the emblem too, so it reads as stitched, not printed
  ctx.save(); shield(); ctx.clip(); ctx.rotate(0.35); ctx.lineWidth = 0.8
  for (let x = -160; x <= 160; x += 1.8) { ctx.strokeStyle = (Math.round(x / 1.8)) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'; ctx.beginPath(); ctx.moveTo(x, -160); ctx.lineTo(x, 160); ctx.stroke() }
  ctx.restore()
  // thick satin border round the shield, with its stitch line
  ctx.save(); shield(); ctx.lineWidth = 6; ctx.strokeStyle = c.trim; ctx.stroke(); ctx.restore()
  stitch(ctx, shield, 'rgba(0,0,0,0.45)', 1, [2.5, 2.5])
  // stars over the shield
  for (let i = -1; i <= 1; i++) { starPath(ctx, i * 15, -66 + Math.abs(i) * 3, 6, 2.6); ctx.fillStyle = c.trim; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke() }
  // motto ribbon and the year
  banner(ctx, 58, 118, 19, c.trim, shadeOf(c.trim), w.sub || c.motto, c.ink, 11.5)
  text(ctx, 'EST. 2026', 0, 78, { size: 9, font: SANS, weight: 800, color: c.trim, spacing: 2 })
  // the cup's name round the top, in thread
  arcText(ctx, w.main || c.name, 80, { size: 15.5, color: c.trim, stroke: 'rgba(0,0,0,0.55)', strokeW: 3, spacing: 1.2 })
  // merrowed edge and a stitch line inside it
  merrow(ctx, c.edge)
  stitch(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, 87, 0, Math.PI * 2) }, c.trim, 1.3, [4, 3])
}

function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.round(v * 0.62))
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

const EMBLEMS = {
  // a street-name sign on a post
  area(ctx) {
    ctx.fillStyle = '#C9D0D6'; ctx.fillRect(-26, -30, 6, 68)
    ctx.fillStyle = '#1B5E20'; ctx.fillRect(-54, -50, 88, 28); ctx.lineWidth = 3; ctx.strokeStyle = PAPER; ctx.strokeRect(-50, -46, 80, 20)
    text(ctx, 'AREA', -10, -36, { size: 19, color: PAPER, spacing: 2 })
    ball(ctx, 24, 10, 16)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(24, 30, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill()
  },
  // a road running away with lane markings and a street light
  street(ctx) {
    ctx.fillStyle = '#2B2F33'; ctx.beginPath(); ctx.moveTo(-14, -52); ctx.lineTo(14, -52); ctx.lineTo(56, 36); ctx.lineTo(-56, 36); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#FFD54F'; for (let i = 0; i < 4; i++) { const y = -44 + i * 21; const w = 2 + i * 1.6; ctx.fillRect(-w / 2, y, w, 10 + i * 2) }
    ctx.strokeStyle = '#C9D0D6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(44, 30); ctx.lineTo(44, -40); ctx.lineTo(28, -46); ctx.stroke()
    ctx.fillStyle = '#FFF3B0'; ctx.beginPath(); ctx.arc(26, -42, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,243,176,0.22)'; ctx.beginPath(); ctx.moveTo(22, -38); ctx.lineTo(30, -38); ctx.lineTo(40, 30); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill()
    ball(ctx, -14, 18, 9)
  },
  // crossroads seen from above, a ball in the middle
  junction(ctx) {
    ctx.fillStyle = '#2B2F33'; ctx.fillRect(-18, -60, 36, 100); ctx.fillRect(-64, -28, 128, 36)
    ctx.fillStyle = PAPER; for (let i = -3; i <= 3; i++) { ctx.fillRect(i * 7 - 2, -36, 4, 8); ctx.fillRect(i * 7 - 2, 8, 4, 8) }
    ctx.fillStyle = '#FFD54F'; ctx.fillRect(-60, -11, 34, 3); ctx.fillRect(26, -11, 34, 3); ctx.fillRect(-1.5, -58, 3, 20); ctx.fillRect(-1.5, 18, 3, 20)
    ball(ctx, 0, -10, 10)
  },
  // a row of estate houses behind a gate
  estate(ctx) {
    for (const [x, c] of [[-40, '#EF6C00'], [0, '#C62828'], [40, '#1565C0']]) {
      ctx.fillStyle = PAPER; ctx.fillRect(x - 17, -22, 34, 30)
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 21, -22); ctx.lineTo(x, -44); ctx.lineTo(x + 21, -22); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#3E2723'; ctx.fillRect(x - 5, -6, 10, 14)
    }
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-62, 30); ctx.lineTo(62, 30); ctx.moveTo(-62, 14); ctx.lineTo(62, 14); ctx.stroke()
    for (let x = -60; x <= 60; x += 10) { ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x, 8); ctx.lineTo(x + 2, 5); ctx.stroke() }
  },
  // a sandy compound with two-stone goalposts
  compound(ctx) {
    ctx.fillStyle = '#D7A86E'; ctx.beginPath(); ctx.ellipse(0, 6, 64, 34, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 6, 64, 34, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, 40); ctx.stroke()
    for (const x of [-52, 52]) for (const y of [-6, 18]) { ctx.beginPath(); ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#6D6D6D'; ctx.fill() }
    ball(ctx, 14, 0, 9)
    ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.arc(-34, -38, 16, 0, Math.PI * 2); ctx.arc(-20, -44, 12, 0, Math.PI * 2); ctx.fill()
  },
  // a bus-stop sign
  busstop(ctx) {
    ctx.fillStyle = '#C9D0D6'; ctx.fillRect(-4, -10, 8, 54)
    ctx.beginPath(); ctx.arc(0, -26, 34, 0, Math.PI * 2); ctx.fillStyle = '#FFC400'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.stroke()
    // a danfo, side on
    ctx.fillStyle = '#111'; ctx.fillRect(-22, -46, 44, 20); ctx.fillStyle = '#FFC400'; ctx.fillRect(-20, -44, 40, 9)
    ctx.fillStyle = '#111'; for (const x of [-12, 12]) { ctx.beginPath(); ctx.arc(x, -24, 5, 0, Math.PI * 2); ctx.fill() }
    text(ctx, 'BUS STOP', 0, -4, { size: 10, font: SANS, weight: 800, color: '#111', maxW: 46 })
  },
  // a corner flag in the turf
  corner(ctx) {
    ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.moveTo(-70, 40); ctx.lineTo(70, 40); ctx.lineTo(70, 10); ctx.lineTo(-70, 10); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-10, 40, 34, -Math.PI / 2 + 0.25, 0); ctx.stroke()
    ctx.fillStyle = PAPER; ctx.fillRect(-14, -56, 5, 92)
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.moveTo(-9, -56); ctx.lineTo(36, -44); ctx.lineTo(-9, -30); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.moveTo(-9, -48); ctx.lineTo(16, -43); ctx.lineTo(-9, -38); ctx.closePath(); ctx.fill()
  },
  // a zinc fence, a ball over it
  backyard(ctx) {
    for (let i = -4; i <= 3; i++) { ctx.fillStyle = i % 2 ? '#90A4AE' : '#B0BEC5'; ctx.fillRect(i * 16, -14, 16, 54); ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 4; k++) ctx.fillRect(i * 16 + 2 + k * 4, -14, 1.5, 54) }
    ctx.fillStyle = '#6D4C41'; for (const x of [-56, 0, 50]) { ctx.beginPath(); ctx.arc(x, -6, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x, 28, 2.5, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(-10, -70, 26, -40); ctx.stroke(); ctx.setLineDash([])
    ball(ctx, 30, -36, 12)
  },
}

function ball(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#FAFAFA'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#111'; ctx.stroke()
  ctx.fillStyle = '#111'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42) } ctx.fill()
}

/** One badge per Weekly Cup, in the order of WEEKLY_CUPS (rewards.js). */
export const CUP_CRESTS = [
  { name: 'AREA CUP', motto: 'NO SHAKING', emblem: 'area', shield: 'heater', split: 'pale', cloth: '#0E2A17', a: '#1B5E20', b: '#2E7D32', trim: '#F2C14E', edge: '#0A1F10', ink: '#1B1400' },
  { name: 'STREET CUP', motto: 'EVERY DAY', emblem: 'street', shield: 'pointed', split: 'stripes', cloth: '#14181C', a: '#263238', b: '#37474F', trim: '#FFD54F', edge: '#0B0E11', ink: '#14181C' },
  { name: 'JUNCTION CUP', motto: 'FOUR WAYS', emblem: 'junction', shield: 'round', split: 'quarter', cloth: '#2A0707', a: '#B71C1C', b: '#7F0000', trim: '#F3EBD8', edge: '#1A0404', ink: '#7F0000' },
  { name: 'ESTATE CUP', motto: 'BEHIND THE GATE', emblem: 'estate', shield: 'swiss', split: 'chief', cloth: '#071A3A', a: '#0D47A1', b: '#1976D2', trim: '#F2C14E', edge: '#04102A', ink: '#0D2A5C' },
  { name: 'COMPOUND CUP', motto: 'SAND AND SWEAT', emblem: 'compound', shield: 'heater', split: 'chevron', cloth: '#2A1A10', a: '#4E342E', b: '#8D6E63', trim: '#F3EBD8', edge: '#1A100A', ink: '#3E2723' },
  { name: 'BUS STOP CUP', motto: 'OYA ENTER', emblem: 'busstop', shield: 'octagon', split: 'hoops', cloth: '#111111', a: '#212121', b: '#F9A825', trim: '#FFC400', edge: '#000000', ink: '#111111' },
  { name: 'CORNER CUP', motto: 'LAST MINUTE', emblem: 'corner', shield: 'pointed', split: 'bend', cloth: '#012B30', a: '#006064', b: '#00838F', trim: '#FFFFFF', edge: '#001A1D', ink: '#004D52' },
  { name: 'BACKYARD CUP', motto: 'HOME GROUND', emblem: 'backyard', shield: 'swiss', split: 'saltire', cloth: '#170A33', a: '#4527A0', b: '#7E57C2', trim: '#E1BEE7', edge: '#0E0620', ink: '#311B92' },
]
CUP_CRESTS.forEach((c, i) => { ART[`cup-${i + 1}`] = (ctx, w = {}) => crestPatch(ctx, c, w) })

/* ── Mystery caps (day-7 rewards): little pictures, full bleed ── */

function sky(ctx, stops) {
  const g = ctx.createLinearGradient(0, -100, 0, 100)
  stops.forEach(([t, c]) => g.addColorStop(t, c))
  disc(ctx, 100, g)
}

Object.assign(ART, {
  'mystery-sunset'(ctx) {
    sky(ctx, [[0, '#3A0E4A'], [0.45, '#E65100'], [0.62, '#FFB74D'], [0.63, '#1A0F2E'], [1, '#2A1238']])
    const sun = ctx.createRadialGradient(0, 24, 4, 0, 24, 60); sun.addColorStop(0, '#FFF3B0'); sun.addColorStop(1, 'rgba(255,183,77,0)')
    disc(ctx, 100, sun)
    ctx.save(); ctx.beginPath(); ctx.rect(-100, -100, 200, 126); ctx.clip(); ctx.beginPath(); ctx.arc(0, 26, 34, 0, Math.PI * 2); ctx.fillStyle = '#FFD54F'; ctx.fill(); ctx.restore()
    ctx.fillStyle = '#1A0F2E'
    // palm trees
    for (const [x, h, s] of [[-58, 70, -1], [62, 58, 1]]) {
      ctx.save(); ctx.strokeStyle = '#1A0F2E'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, 30); ctx.quadraticCurveTo(x + s * 10, 30 - h / 2, x + s * 4, 30 - h); ctx.stroke()
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.6; ctx.beginPath(); ctx.ellipse(x + s * 4 + Math.cos(a) * 16, 30 - h + Math.sin(a) * 10 + 8, 18, 5, a, 0, Math.PI * 2); ctx.fill() }
      ctx.restore()
    }
    ctx.strokeStyle = 'rgba(255,213,79,0.6)'; ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) { const y = 36 + i * 9; const w = 34 - i * 5; ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke() }
  },
  'mystery-midnight'(ctx) {
    sky(ctx, [[0, '#020617'], [1, '#0D1B4C']])
    for (let i = 0; i < 46; i++) { const x = Math.sin(i * 12.9) * 92; const y = Math.cos(i * 7.3) * 92; const r = i % 7 === 0 ? 1.8 : 0.9; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#E3E9FF'; ctx.fill() }
    // crescent moon
    ctx.beginPath(); ctx.arc(-10, -14, 40, 0, Math.PI * 2); ctx.fillStyle = '#F5E9B8'; ctx.fill()
    ctx.beginPath(); ctx.arc(8, -26, 36, 0, Math.PI * 2); ctx.fillStyle = '#0A1336'; ctx.fill()
    starPath(ctx, 40, 22, 10, 4); ctx.fillStyle = '#9FB4FF'; ctx.fill()
    ring(ctx, 92, 2, '#9FB4FF')
  },
  'mystery-jungle'(ctx) {
    disc(ctx, 100, '#0E3B16')
    const leaf = (x, y, a, l, c) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(l * 0.5, -l * 0.35, l, 0); ctx.quadraticCurveTo(l * 0.5, l * 0.35, 0, 0); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(l - 4, 0); ctx.stroke(); ctx.restore() }
    for (let i = 0; i < 14; i++) leaf(Math.sin(i * 2.3) * 70, Math.cos(i * 1.7) * 70, i * 0.9, 60 + (i % 3) * 14, i % 2 ? '#2E7D32' : '#1B5E20')
    // a toucan-bright flower in the middle
    for (let k = 0; k < 6; k++) { ctx.save(); ctx.rotate(k * Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -18, 10, 18, 0, 0, Math.PI * 2); ctx.fillStyle = '#C6FF00'; ctx.fill(); ctx.restore() }
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fillStyle = '#FF6D00'; ctx.fill()
  },
  'mystery-ruby'(ctx) {
    disc(ctx, 100, '#3A0614')
    for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * Math.PI / 6); ctx.fillStyle = i % 2 ? 'rgba(255,214,222,0.08)' : 'rgba(255,214,222,0.16)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-27, -100); ctx.lineTo(27, -100); ctx.closePath(); ctx.fill(); ctx.restore() }
    // a cut gem
    const pts = [[-46, -18], [-26, -42], [26, -42], [46, -18], [0, 50]]
    ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath(); ctx.fillStyle = '#C2185B'; ctx.fill()
    const facets = [[[-46, -18], [-26, -42], [-14, -18], '#F06292'], [[-14, -18], [-26, -42], [26, -42], '#EC407A'], [[-14, -18], [26, -42], [14, -18], '#F48FB1'], [[14, -18], [26, -42], [46, -18], '#E91E63'], [[-46, -18], [-14, -18], [0, 50], '#AD1457'], [[-14, -18], [14, -18], [0, 50], '#D81B60'], [[14, -18], [46, -18], [0, 50], '#880E4F']]
    for (const [a, b, c, col] of facets) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath(); ctx.fillStyle = col; ctx.fill() }
    ctx.lineWidth = 2; ctx.strokeStyle = '#FFD6DE'; ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath(); ctx.stroke()
    starPath(ctx, -22, -30, 7, 2, 4, 0); ctx.fillStyle = '#FFFFFF'; ctx.fill()
  },
  'mystery-ocean'(ctx) {
    sky(ctx, [[0, '#B2EBF2'], [0.35, '#4DD0E1'], [0.36, '#006064'], [1, '#00252A']])
    ctx.save(); ctx.lineWidth = 0
    for (let row = 0; row < 4; row++) {
      ctx.beginPath(); const y0 = -24 + row * 26
      ctx.moveTo(-110, y0 + 20)
      for (let x = -110; x <= 110; x += 40) { ctx.quadraticCurveTo(x + 10, y0 - 14, x + 20, y0); ctx.quadraticCurveTo(x + 30, y0 + 12, x + 40, y0) }
      ctx.lineTo(110, 110); ctx.lineTo(-110, 110); ctx.closePath()
      ctx.fillStyle = ['#00838F', '#006F79', '#005A63', '#00444B'][row]; ctx.fill()
      ctx.strokeStyle = 'rgba(224,247,250,0.7)'; ctx.lineWidth = 2.5; ctx.stroke()
    }
    ctx.restore()
    // a little sailboat on the horizon
    ctx.fillStyle = '#E0F7FA'; ctx.beginPath(); ctx.moveTo(20, -66); ctx.lineTo(20, -34); ctx.lineTo(40, -34); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#3E2723'; ctx.fillRect(8, -34, 36, 5)
  },
  'mystery-volcano'(ctx) {
    sky(ctx, [[0, '#2A0E08'], [0.6, '#5D1F0E'], [1, '#2A0E08']])
    ctx.fillStyle = metal(ctx, 100, ['#6D4C41', '#3E2723', '#5D4037', '#2B1A14']); ctx.beginPath(); ctx.moveTo(-100, 70); ctx.lineTo(-26, -22); ctx.lineTo(26, -22); ctx.lineTo(100, 70); ctx.lineTo(100, 100); ctx.lineTo(-100, 100); ctx.closePath(); ctx.fill()
    // lava rivers
    ctx.strokeStyle = '#FF6D00'; ctx.lineWidth = 6; ctx.lineCap = 'round'
    for (const [a, b] of [[-10, -40], [6, 30], [14, 54]]) { ctx.beginPath(); ctx.moveTo(a * 0.6, -20); ctx.quadraticCurveTo(b * 0.4, 20, b, 80); ctx.stroke() }
    ctx.strokeStyle = '#FFD54F'; ctx.lineWidth = 2.5
    for (const [a, b] of [[-10, -40], [6, 30], [14, 54]]) { ctx.beginPath(); ctx.moveTo(a * 0.6, -20); ctx.quadraticCurveTo(b * 0.4, 20, b, 80); ctx.stroke() }
    // the eruption
    const g = ctx.createRadialGradient(0, -36, 2, 0, -36, 50); g.addColorStop(0, '#FFF3B0'); g.addColorStop(0.4, '#FF9100'); g.addColorStop(1, 'rgba(255,61,0,0)')
    disc(ctx, 100, 'rgba(0,0,0,0)'); ctx.beginPath(); ctx.arc(0, -36, 50, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
    ctx.fillStyle = '#FFAB40'; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; ctx.beginPath(); ctx.arc(Math.cos(a) * (36 + (i % 3) * 12), -30 + Math.sin(a) * (36 + (i % 3) * 12), 3.5, 0, Math.PI * 2); ctx.fill() }
  },
})

/* ── Weekly-goal caps: a match-ticket stub with the week's number ── */

function ticket(ctx, i, c) {
  disc(ctx, 100, c.primary)
  // diagonal stripes in the edge colour, faint
  ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = c.edge; ctx.lineWidth = 10
  for (let x = -200; x <= 200; x += 26) { ctx.beginPath(); ctx.moveTo(x, -100); ctx.lineTo(x + 200, 100); ctx.stroke() }
  ctx.restore()
  // the stub
  ctx.save(); ctx.rotate(-0.12)
  ctx.beginPath(); ctx.moveTo(-64, -38); ctx.lineTo(64, -38); ctx.lineTo(64, -10); ctx.arc(64, 0, 10, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(64, 38); ctx.lineTo(-64, 38); ctx.lineTo(-64, 10); ctx.arc(-64, 0, 10, Math.PI / 2, -Math.PI / 2, true); ctx.closePath()
  ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = c.edge; ctx.stroke()
  ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(30, -36); ctx.lineTo(30, 36); ctx.stroke(); ctx.setLineDash([])
  text(ctx, 'WEEK', -18, -18, { size: 13, font: SANS, weight: 800, color: '#222', spacing: 3 })
  text(ctx, String(i + 1), -18, 12, { size: 46, color: c.primary, stroke: '#111', strokeW: 1.5 })
  ctx.save(); ctx.translate(44, 0); ctx.rotate(-Math.PI / 2); text(ctx, 'ADMIT ONE', 0, 0, { size: 9, font: SANS, weight: 800, color: '#444', spacing: 1, maxW: 60 }); ctx.restore()
  ctx.restore()
  ring(ctx, 93, 3, c.edge)
}

WEEK_CAPS.forEach((c, i) => { ART[c.key] = (ctx) => ticket(ctx, i, c) })

/**
 * Words printed on the ready-made caps, changeable from the admin console:
 * { [designKey]: { main, sub } }. Anything not set keeps the built-in words.
 */
let LABELS = {}
const urls = new Map()
export function setCapLabels(map) {
  LABELS = map && typeof map === 'object' ? map : {}
  urls.clear()
}
const labelsFor = (key) => LABELS[key] || {}

/** Does this design have printed artwork? */
export const hasArt = (key) => typeof key === 'string' && Object.hasOwn(ART, key)

/**
 * Draw a design's artwork into a canvas context, filling a disc of radius
 * `r` centred at (cx, cy). Returns false when there's no art for it.
 */
export function drawCapArt(ctx, key, cx, cy, r) {
  const draw = ART[key]
  if (!draw) return false
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(r / 100, r / 100)
  ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.clip()
  draw(ctx, labelsFor(key))
  // embossed tin: two faint rings near the rim
  ring(ctx, 97, 1.2, 'rgba(0,0,0,0.25)')
  ring(ctx, 99, 1, 'rgba(255,255,255,0.12)')
  ctx.restore()
  return true
}

export const ART_KEYS = Object.keys(ART)

/**
 * The squad number on a printed cap: a little paper sticker with the number
 * in marker pen, the way you'd number your caps as a kid.
 */
export function drawNumberSticker(ctx, number, cx, cy, r) {
  if (number == null) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.12)
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = PAPER; ctx.fill()
  ctx.lineWidth = r * 0.12; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke()
  ctx.font = `italic 800 ${r * 1.25}px ${COND}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#141414'
  ctx.fillText(String(number), 0, r * 0.06)
  ctx.restore()
}

/** Where the sticker sits on a top of radius r: low and to the right, clear of the main art. */
export const stickerSpot = (r) => ({ x: r * 0.6, y: r * 0.56, r: r * 0.2 })

/** A PNG of the artwork (plus number), cached, for the flat kit previews. */
export function capArtUrl(key, number = null, px = 240) {
  if (!hasArt(key) || typeof document === 'undefined') return null
  const id = `${key}:${number}:${px}`
  if (urls.has(id)) return urls.get(id)
  const c = document.createElement('canvas')
  c.width = c.height = px
  const ctx = c.getContext('2d')
  drawCapArt(ctx, key, px / 2, px / 2, px / 2)
  const s = stickerSpot(px / 2)
  drawNumberSticker(ctx, number, px / 2 + s.x, px / 2 + s.y, s.r)
  const url = c.toDataURL('image/png')
  if (urls.size > 300) urls.clear()
  urls.set(id, url)
  return url
}

/** Fonts the artwork uses, loaded before the first draw. */
export function loadArtFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve()
  urls.clear()
  return Promise.all(['800 20px "Barlow Condensed"', 'italic 800 20px "Barlow Condensed"', '700 20px Inter'].map((f) => document.fonts.load(f).catch(() => {})))
}
