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
