/**
 * The Weekend Cup's rules, shared by the game and our server (no imports, so
 * the server can use this file as it is). Pure.
 *
 * - Friday 00:00 to Sunday 23:59, Lagos time (UTC+1 all year).
 * - A run is five matches against the same five computer clubs, harder each round.
 * - Points: a win 3, a draw 1 (then penalties decide whether the run goes on), plus 1 a goal.
 * - Lose (or lose the shootout) and the run ends. Three runs a weekend; the best one counts.
 */

export const ROUNDS = 5
export const RUNS = 3
export const MAX_GOALS = 12 // a side, in one match: anything more isn't a believable score
const LAGOS_OFFSET_MS = 3600000 // UTC+1, no summer time
const DAY = 86400000
// Results for a weekend still count this long after it closes (a match finishing just after midnight)
export const GRACE_MS = 2 * 3600000

const lagosDay = (now) => new Date(now + LAGOS_OFFSET_MS) // read with getUTC*()
const iso = (d) => d.toISOString().slice(0, 10)

/** The weekend's key, the date of its Friday in Lagos ('2026-11-27'), for the weekend `now` is in or the next one. */
export function weekendKey(now = Date.now()) {
  const d = lagosDay(now)
  const dow = d.getUTCDay() // 0 Sun ... 5 Fri, 6 Sat
  const back = dow === 5 ? 0 : dow === 6 ? 1 : dow === 0 ? 2 : -(5 - dow) // Mon-Thu: the coming Friday
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)))
}

/** When a weekend opens and closes, as UTC milliseconds. */
export function weekendWindow(key) {
  const start = Date.parse(`${key}T00:00:00Z`) - LAGOS_OFFSET_MS
  return { start, end: start + 3 * DAY }
}

/** Is the Weekend Cup on right now? */
export function isOpen(now = Date.now()) {
  const { start, end } = weekendWindow(weekendKey(now))
  return now >= start && now < end
}

/** The weekend before the one `now` belongs to (the one whose result Monday shows). */
export function lastWeekendKey(now = Date.now()) {
  // weekendKey is the weekend on now or the coming one: the one before is a week earlier
  const { start } = weekendWindow(weekendKey(now))
  return weekendKey(start - 7 * DAY + DAY)
}

/** Can a result for this weekend still be sent at `now`? */
export const acceptsResults = (key, now = Date.now()) => {
  const { start, end } = weekendWindow(key)
  return now >= start && now < end + GRACE_MS
}

/** The computer's level, round by round (0-based). */
export const LEVELS = ['easy', 'easy', 'medium', 'hard', 'hard']

/**
 * One match of a run: { gf, ga, pens } where pens is 'won' | 'lost' | null
 * (only for a draw). Did the run go through?
 */
export const wentThrough = (m) => m.gf > m.ga || (m.gf === m.ga && m.pens === 'won')

/** Points for one match: win 3, draw 1, plus 1 a goal. */
export const matchPoints = (m) => (m.gf > m.ga ? 3 : m.gf === m.ga ? 1 : 0) + m.gf

/** Points for a run so far. */
export const runPoints = (matches) => matches.reduce((sum, m) => sum + matchPoints(m), 0)

/** Is the run over (lost, or all five played)? */
export const runOver = (matches) => matches.length >= ROUNDS || (matches.length > 0 && !wentThrough(matches[matches.length - 1]))

/** Did the run get through all five? */
export const runComplete = (matches) => matches.length === ROUNDS && matches.every(wentThrough)

/** A clean copy of one match, or null if it isn't a believable result. */
export function cleanMatch(m) {
  if (!m || typeof m !== 'object') return null
  const { gf, ga } = m
  if (!Number.isInteger(gf) || !Number.isInteger(ga) || gf < 0 || ga < 0 || gf > MAX_GOALS || ga > MAX_GOALS) return null
  if (gf === ga) {
    if (m.pens !== 'won' && m.pens !== 'lost') return null
    return { gf, ga, pens: m.pens }
  }
  return { gf, ga, pens: null }
}

/**
 * A clean copy of a run's matches, or null when it can't be right: more than
 * five, an unbelievable score, or a match played after the run was lost.
 */
export function cleanRun(matches) {
  if (!Array.isArray(matches) || matches.length > ROUNDS) return null
  const out = []
  for (const m of matches) {
    if (out.length && !wentThrough(out[out.length - 1])) return null
    const c = cleanMatch(m)
    if (!c) return null
    out.push(c)
  }
  return out
}

/** Is `next` the same run as `prev`, carried on (never rewritten)? */
export function extends_(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next) || next.length < prev.length) return false
  return prev.every((m, i) => m.gf === next[i].gf && m.ga === next[i].ga && (m.pens || null) === (next[i].pens || null))
}

/** Prizes, in club-money units (see squad.js money(): 1 unit is ₦10k). */
export const TOP_PRIZE = 100 // ₦1m to each of the top three
export const RUN_PRIZE = 10 // ₦100k for getting through all five, once a run
export const PRIZE_PLACES = 3
