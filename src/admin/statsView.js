/**
 * Turns the Lagos Life usage counts (GET /api/lagos?stats=N: [{ day, players,
 * counts: { 'event:detail': n } }], newest first) into what the HQ stats page
 * draws. Pure: no fetching, no DOM.
 */

/** The modes a match can be counted under, in the order the page shows them. */
export const MODES = [
  { key: 'career', label: 'Career', color: '#ffc83d' },
  { key: 'tournament', label: 'Tournaments', color: '#4fb3ff', match: (k) => k.startsWith('tournament_') },
  { key: 'computer', label: 'Quick match', color: '#a78bfa' },
  { key: 'daily', label: 'Daily challenge', color: '#34d27b' },
  { key: 'local', label: 'Two players', color: '#ff8a4c' },
  { key: 'training', label: 'Training Ground', color: '#ff5fa2' },
  { key: 'online', label: 'Online', color: '#5eead4', match: (k) => k === 'online' || k === 'anytime' },
]
const modeOf = (detail) => MODES.find((m) => (m.match ? m.match(detail) : m.key === detail))?.key || null

/** One day, summed by mode: { day, players, opens, started, finished, quits, byMode, pitch, errors, board }. */
export function dayView(d) {
  const counts = d?.counts || {}
  const byMode = Object.fromEntries(MODES.map((m) => [m.key, { started: 0, finished: 0, quits: { '0m': 0, '1m': 0, '3m': 0, '6m': 0 } }]))
  const pitch = { lost: 0, shown: 0, hidden: 0, back: 0, dead: 0 }
  const errors = {}
  let board = 0
  for (const [key, n] of Object.entries(counts)) {
    const i = key.indexOf(':')
    const ev = i < 0 ? key : key.slice(0, i)
    const detail = i < 0 ? '' : key.slice(i + 1)
    if (ev === 'match_start' || ev === 'match_end') {
      const m = modeOf(detail)
      if (m) byMode[m][ev === 'match_start' ? 'started' : 'finished'] += n
    } else if (ev === 'match_quit') {
      const j = detail.lastIndexOf('_')
      const m = modeOf(detail.slice(0, j))
      const when = detail.slice(j + 1)
      if (m && when in byMode[m].quits) byMode[m].quits[when] += n
    } else if (ev === 'pitch_lost') {
      pitch.lost += n
      if (detail === 'shown') pitch.shown += n
      if (detail === 'hidden') pitch.hidden += n
    } else if (ev === 'pitch_back') pitch.back += n
    else if (ev === 'pitch_dead') pitch.dead += n
    else if (ev === 'error') errors[detail || 'other'] = (errors[detail || 'other'] || 0) + n
    else if (ev === 'board') board += n
  }
  // A finish can be counted for a match started the day before: never show more than 100%
  for (const m of Object.values(byMode)) m.finished = Math.min(m.finished, Math.max(m.started, m.finished))
  const started = Object.values(byMode).reduce((s, m) => s + m.started, 0)
  const finished = Object.values(byMode).reduce((s, m) => s + Math.min(m.finished, m.started), 0)
  return {
    day: d?.day || '', players: d?.players || 0, opens: counts.open || 0, menus: counts.menu || 0,
    // (from the server once it counts them; null before)
    returning: Number.isFinite(d?.returning) ? d.returning : null,
    newPlayers: Number.isFinite(d?.newPlayers) ? d.newPlayers : null,
    started, finished, byMode, pitch, errors, board,
  }
}

/** Days oldest first (the chart order), each as dayView. */
export function timeline(live) {
  return (Array.isArray(live) ? live : []).map(dayView).sort((a, b) => (a.day < b.day ? -1 : 1))
}

/** Change from b to a as a whole percentage, or null when there's nothing to compare. */
export function change(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return Math.round(((a - b) / b) * 100)
}

/** Share of started matches finished, 0..100 (null with none started). */
export const finishRate = (started, finished) => (started > 0 ? Math.round((Math.min(finished, started) / started) * 100) : null)

/** How far into the UTC day it is, 0..1 (today's numbers are a part-day). */
export const dayProgress = (now = new Date()) => (now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440

/** Plain-words notes on the latest day, like a quick read of the numbers. */
export function headlines(days, now = new Date()) {
  const out = []
  const today = days.at(-1)
  const yday = days.at(-2)
  if (!today) return out
  const part = dayProgress(now)
  if (yday && part > 0.2) {
    const pace = Math.round(today.players / part)
    const c = change(pace, yday.players)
    if (c !== null) out.push({ tone: c >= 0 ? 'good' : 'bad', text: `On pace for about ${pace} players today (${c >= 0 ? '+' : ''}${c}% on yesterday's ${yday.players}).` })
  }
  const top = Object.entries(today.byMode).sort((a, b) => b[1].started - a[1].started)[0]
  if (top && top[1].started) out.push({ tone: 'info', text: `${MODES.find((m) => m.key === top[0]).label} is the most played today: ${top[1].started} started, ${finishRate(top[1].started, top[1].finished)}% finished.` })
  if (today.players) {
    const per = (today.started / today.players).toFixed(1)
    out.push({ tone: 'info', text: `${per} matches per player today.` })
  }
  const weak = Object.entries(today.byMode).filter(([, m]) => m.started >= 5 && finishRate(m.started, m.finished) < 40)
  for (const [k, m] of weak) out.push({ tone: 'bad', text: `${MODES.find((x) => x.key === k).label}: only ${finishRate(m.started, m.finished)}% of ${m.started} matches finished.` })
  if (today.pitch.shown) out.push({ tone: 'bad', text: `The pitch dropped ${today.pitch.shown} time${today.pitch.shown === 1 ? '' : 's'} while someone was playing.` })
  else if (today.pitch.lost === 0) out.push({ tone: 'good', text: 'No pitch drops today.' })
  const errs = Object.values(today.errors).reduce((s, v) => s + v, 0)
  if (errs) out.push({ tone: 'bad', text: `${errs} online match error${errs === 1 ? '' : 's'} from Lagos Life.` })
  return out
}

/** Every day in the range added up by mode: { mode: { started, finished, quits } }. */
export function rangeByMode(days) {
  const out = Object.fromEntries(MODES.map((m) => [m.key, { started: 0, finished: 0, quits: 0 }]))
  for (const d of days) for (const m of MODES) {
    const v = d.byMode[m.key]
    out[m.key].started += v.started
    out[m.key].finished += Math.min(v.finished, v.started)
    out[m.key].quits += Object.values(v.quits).reduce((a, b) => a + b, 0)
  }
  return out
}
