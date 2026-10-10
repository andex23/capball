/**
 * Full-time share card: a 1080×1350 picture of the result (both caps, the
 * score, who scored, Man of the Match) for WhatsApp Status, Instagram and co.
 * Drawn on a canvas with the game's own fonts, then shared or downloaded.
 */
import { playerOf } from './commentary'
import { matchRatings, manOfTheMatch } from './squad'
import { STADIUMS } from '../data/StadiumData'

const W = 1080
const H = 1350
const INK = '#0b0830'
const YELLOW = '#ffd23f'

/** Scorers by side, e.g. { team1: ['Okafor 2', 'Eze'], team2: ['Rossi (og)'] }. */
export function scorerLines(teamConfig, goalLog = []) {
  const out = { team1: [], team2: [] }
  const tally = { team1: new Map(), team2: new Map() }
  for (const g of goalLog) {
    if (g.shootout) continue
    const who = playerOf(teamConfig, g.cap)
    const name = who ? `${who.name}${g.own ? ' (og)' : ''}` : 'Goal'
    const m = tally[g.team]
    if (m) m.set(name, (m.get(name) || 0) + 1)
  }
  for (const side of ['team1', 'team2']) for (const [name, n] of tally[side]) out[side].push(n > 1 ? `${name} ${n}` : name)
  return out
}

/** The match's best player across both sides. */
export function bestPlayer(teamConfig, { goalLog = [], matchEvents = [], score }) {
  let best = null
  for (const side of ['team1', 'team2']) {
    const ratings = matchRatings({ side, goalLog, matchEvents, score })
    const goals = {}
    for (const g of goalLog) if (!g.own && !g.shootout && g.cap?.startsWith(side)) goals[g.cap.slice(6)] = (goals[g.cap.slice(6)] || 0) + 1
    const role = manOfTheMatch(ratings, goals)
    if (!best || ratings[role] > best.rating) best = { rating: ratings[role], ...playerOf(teamConfig, `${side}_${role}`) }
  }
  return best
}

function drawCap(ctx, x, y, r, kit, number) {
  // Crimped skirt: a ring of teeth
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = INK
  ctx.beginPath()
  for (let i = 0; i < 42; i++) {
    const a = (i / 42) * Math.PI * 2
    const rr = i % 2 ? r * 1.08 : r * 1.16
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = kit.skirtColor || kit.primary
  ctx.beginPath()
  for (let i = 0; i < 42; i++) {
    const a = (i / 42) * Math.PI * 2
    const rr = i % 2 ? r * 1.0 : r * 1.08
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath(); ctx.fill()
  // Printed top
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, kit.primary); g.addColorStop(1, kit.primary)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = kit.edge === kit.primary ? 'rgba(255,255,255,0.8)' : kit.edge
  ctx.lineWidth = r * 0.07
  ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke()
  if (number != null) {
    const light = luminance(kit.primary) > 0.55
    ctx.font = `800 ${Math.round(r * 0.9)}px 'Barlow Condensed', sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineWidth = r * 0.1; ctx.strokeStyle = light ? '#fff' : 'rgba(0,0,0,0.55)'
    ctx.strokeText(String(number), 0, r * 0.04)
    ctx.fillStyle = light ? '#111' : '#fff'
    ctx.fillText(String(number), 0, r * 0.04)
  }
  ctx.restore()
}

function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

function fitText(ctx, text, maxW, font, start) {
  let size = start
  do { ctx.font = font(size); size -= 2 } while (ctx.measureText(text).width > maxW && size > 18)
  return text
}

/** Draw the card for a finished match onto a new canvas. */
export function drawShareCard({ teamConfig, score, penaltyScore, goalLog, matchEvents, stadium, title = 'FULL TIME' }) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  // Background: retro blue, scanlines, a gold grid floor
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1e40d2'); bg.addColorStop(0.7, '#0a1b6e'); bg.addColorStop(1, INK)
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,210,63,0.28)'; ctx.lineWidth = 3
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, H * 0.78); ctx.lineTo(W / 2 + i * 220, H); ctx.stroke() }
  for (let j = 0; j < 6; j++) { const y = H * 0.78 + Math.pow(j / 5, 1.8) * H * 0.22; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.restore()
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 3)

  // Logo
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.font = "italic 800 110px 'Barlow Condensed', sans-serif"
  const lg = ctx.createLinearGradient(0, 70, 0, 200)
  lg.addColorStop(0, '#fff6b0'); lg.addColorStop(0.45, YELLOW); lg.addColorStop(0.7, '#ff9a1f'); lg.addColorStop(1, '#e53935')
  ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.lineJoin = 'round'
  ctx.strokeText('COUNTER BALL', W / 2, 200)
  ctx.fillStyle = lg; ctx.fillText('COUNTER BALL', W / 2, 200)
  // Tag
  ctx.font = "700 40px 'Silkscreen', monospace"
  const tw = ctx.measureText(title).width + 56
  ctx.fillStyle = INK; ctx.fillRect(W / 2 - tw / 2 - 6, 236, tw + 12, 70)
  ctx.fillStyle = YELLOW; ctx.fillRect(W / 2 - tw / 2, 242, tw, 58)
  ctx.fillStyle = INK; ctx.fillText(title, W / 2, 286)

  // Panel
  const px = 70, py = 360, pw = W - 140, ph = 660
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 16, py + 18, pw, ph)
  ctx.fillStyle = INK; ctx.fillRect(px - 8, py - 8, pw + 16, ph + 16)
  const pg = ctx.createLinearGradient(0, py, 0, py + ph)
  pg.addColorStop(0, 'rgba(30,64,210,0.98)'); pg.addColorStop(1, 'rgba(10,27,110,0.98)')
  ctx.fillStyle = pg; ctx.fillRect(px, py, pw, ph)

  // Caps, names, score
  const k1 = teamConfig.team1, k2 = teamConfig.team2
  drawCap(ctx, px + 190, py + 170, 110, k1, null)
  drawCap(ctx, px + pw - 190, py + 170, 110, k2, null)
  ctx.fillStyle = '#fff'
  for (const [kit, x] of [[k1, px + 190], [k2, px + pw - 190]]) {
    fitText(ctx, kit.name.toUpperCase(), 330, (s) => `italic 800 ${s}px 'Barlow Condensed', sans-serif`, 52)
    ctx.lineWidth = 8; ctx.strokeStyle = INK
    ctx.strokeText(kit.name.toUpperCase(), x, py + 345)
    ctx.fillText(kit.name.toUpperCase(), x, py + 345)
  }
  ctx.font = "800 150px 'Barlow Condensed', sans-serif"
  const sc = `${score.team1}–${score.team2}`
  ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText(sc, W / 2, py + 225)
  ctx.fillStyle = '#fff'; ctx.fillText(sc, W / 2, py + 225)
  if (penaltyScore) {
    ctx.font = "700 30px 'Silkscreen', monospace"; ctx.fillStyle = YELLOW
    ctx.fillText(`${penaltyScore.team1}–${penaltyScore.team2} ON PENS`, W / 2, py + 280)
  }

  // Scorers
  const lines = scorerLines(teamConfig, goalLog)
  ctx.font = "600 34px 'Inter', sans-serif"
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  const rows = Math.max(lines.team1.length, lines.team2.length, 0)
  for (let i = 0; i < Math.min(rows, 4); i++) {
    if (lines.team1[i]) { ctx.textAlign = 'left'; ctx.fillText(`⚽ ${lines.team1[i]}`, px + 50, py + 420 + i * 50) }
    if (lines.team2[i]) { ctx.textAlign = 'right'; ctx.fillText(`${lines.team2[i]} ⚽`, px + pw - 50, py + 420 + i * 50) }
  }
  ctx.textAlign = 'center'

  // Man of the Match
  const best = bestPlayer(teamConfig, { goalLog, matchEvents, score })
  if (best?.name) {
    const y = py + ph - 70
    ctx.fillStyle = INK; ctx.fillRect(px + 40, y - 52, pw - 80, 86)
    ctx.fillStyle = 'rgba(255,210,63,0.16)'; ctx.fillRect(px + 44, y - 48, pw - 88, 78)
    ctx.font = "700 26px 'Silkscreen', monospace"; ctx.fillStyle = YELLOW
    ctx.fillText('MAN OF THE MATCH', W / 2, y - 14)
    ctx.font = "italic 800 40px 'Barlow Condensed', sans-serif"; ctx.fillStyle = '#fff'
    ctx.fillText(`${best.number != null ? `#${best.number} ` : ''}${best.name.toUpperCase()} · ${(teamConfig[best.team]?.name || '').toUpperCase()}`, W / 2, y + 26)
  }

  // Footer
  ctx.font = "700 44px 'Silkscreen', monospace"; ctx.fillStyle = '#fff'
  ctx.lineWidth = 8; ctx.strokeStyle = INK
  ctx.strokeText('PLAY FREE', W / 2, H - 200); ctx.fillText('PLAY FREE', W / 2, H - 200)
  ctx.font = "700 46px 'Silkscreen', monospace"; ctx.fillStyle = YELLOW
  ctx.strokeText('COUNTERBALL.VERCEL.APP', W / 2, H - 135, W - 100); ctx.fillText('COUNTERBALL.VERCEL.APP', W / 2, H - 135, W - 100)
  ctx.font = "600 28px 'Inter', sans-serif"; ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const venue = STADIUMS[stadium]?.name
  ctx.fillText(`${venue ? `${venue} · ` : ''}${new Date().toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`, W / 2, H - 80)
  return c
}

/** Make the card and hand it to the share sheet (or download it). */
export async function shareResultCard(match) {
  await document.fonts?.ready
  const canvas = drawShareCard(match)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return 'failed'
  const file = new File([blob], 'counter-ball-result.png', { type: 'image/png' })
  const text = `${match.teamConfig.team1.name} ${match.score.team1}–${match.score.team2} ${match.teamConfig.team2.name} on Counter Ball — play free at counterball.vercel.app`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Counter Ball result', text })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = file.name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
