/**
 * The Weekend League's rules, shared by the game and our server (no imports,
 * so the server can use this file as it is). Pure.
 *
 * - Fifteen wins (against the computer or friends) to enter; you sign up with
 *   one club and play the whole weekend with it.
 * - Friday 4:30pm to Sunday midnight, Lagos time (UTC+1 all year).
 * - Fifteen matches against computer clubs on hard: 1–5 open on Friday, 6–10 on
 *   Saturday, 11–15 on Sunday. Miss a day and you can catch up until Sunday midnight.
 * - One go at each. Win 3, draw 1; leave early and it's a 3–0 loss.
 * - The table: points, then goal difference, then goals scored, then who got there first.
 */
export const LEAGUE_ENTRY = 15
export const FIXTURES = 15
export const PER_DAY = 5
export const MAX_GOALS = 12 // a side, in one match: anything more isn't believable
export const LEFT_EARLY = { gf: 0, ga: 3 }
const LAGOS = 3600000 // UTC+1, no summer time
const DAY = 86400000
const OPEN_AT = 16.5 * 3600000 // Friday 4:30pm in Lagos
// Results for a weekend still count this long after it closes (a match finishing just after midnight)
export const GRACE_MS = 2 * 3600000

/** Can a player with this many wins enter? */
export const qualifies = (wins) => Number.isFinite(wins) && wins >= LEAGUE_ENTRY

/** How many more wins they need (0 once in). */
export const winsToGo = (wins) => Math.max(0, LEAGUE_ENTRY - (Number.isFinite(wins) ? Math.floor(wins) : 0))

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
const lagosMidnight = (ms) => Math.floor((ms + LAGOS) / DAY) * DAY - LAGOS // start of that day in Lagos, as UTC ms

/** A weekend, from its key (the Friday's date in Lagos, '2026-11-27'): when it opens, each day starts, and it closes. */
export function leagueWindow(key) {
  const friday = Date.parse(`${key}T00:00:00Z`) - LAGOS
  return { start: friday + OPEN_AT, sat: friday + DAY, sun: friday + 2 * DAY, end: friday + 3 * DAY }
}

/** The weekend `now` is in, or the next one to come: its key. */
export function leagueKey(now = Date.now()) {
  const day = lagosMidnight(now)
  const dow = new Date(day + LAGOS).getUTCDay() // 0 Sun … 5 Fri, 6 Sat
  const back = dow === 5 ? 0 : dow === 6 ? 1 : dow === 0 ? 2 : -(5 - dow)
  return iso(day + LAGOS - back * DAY)
}

/** The weekend that most recently closed (for Monday's results). */
export const lastLeagueKey = (now = Date.now()) => iso(Date.parse(`${leagueKey(now)}T00:00:00Z`) - 7 * DAY)

/** When the first Weekend League opens. */
export const FIRST_LEAGUE = '2026-11-27'
export const LEAGUE_OPENS = leagueWindow(FIRST_LEAGUE).start

/** Is the league on right now? */
export function isLive(now = Date.now()) {
  const key = leagueKey(now)
  if (key < FIRST_LEAGUE) return false
  const w = leagueWindow(key)
  return now >= w.start && now < w.end
}

/** When the next (or current) league opens. */
export function nextOpen(now = Date.now()) {
  let key = leagueKey(now)
  if (key < FIRST_LEAGUE) key = FIRST_LEAGUE
  const w = leagueWindow(key)
  return now < w.end ? w.start : leagueWindow(iso(Date.parse(`${key}T00:00:00Z`) + 7 * DAY)).start
}

/** How many fixtures are open at `now` (0 before it starts, 15 from Sunday). */
export function openFixtures(key, now = Date.now()) {
  const w = leagueWindow(key)
  if (now < w.start) return 0
  return now >= w.sun ? FIXTURES : now >= w.sat ? 2 * PER_DAY : PER_DAY
}

/** Which day (0 Fri, 1 Sat, 2 Sun) a fixture belongs to. */
export const fixtureDay = (i) => Math.floor(i / PER_DAY)

/** Can a result for this weekend still be sent at `now`? */
export function acceptsResults(key, now = Date.now()) {
  const w = leagueWindow(key)
  return now >= w.start && now < w.end + GRACE_MS
}

/** Time to go, split up for a countdown: { days, hours, mins, secs, open }. */
export function untilOpen(now = Date.now(), opens = nextOpen(now)) {
  const s = Math.max(0, Math.floor((opens - now) / 1000))
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60, open: s === 0 }
}

/** "1d 10h", "10h 32m", "32m": short, for the menu. */
export function opensIn(now = Date.now(), opens = nextOpen(now)) {
  const t = untilOpen(now, opens)
  if (t.open) return 'now'
  return t.days ? `${t.days}d ${t.hours}h` : t.hours ? `${t.hours}h ${t.mins}m` : `${Math.max(1, t.mins)}m`
}

/** A clean copy of one result, or null if it isn't believable. */
export function cleanResult(r) {
  if (!r || typeof r !== 'object') return null
  const { gf, ga } = r
  if (!Number.isInteger(gf) || !Number.isInteger(ga) || gf < 0 || ga < 0 || gf > MAX_GOALS || ga > MAX_GOALS) return null
  return { gf, ga, ...(r.left ? { left: true } : {}) }
}

export const resultPoints = (r) => (r.gf > r.ga ? 3 : r.gf === r.ga ? 1 : 0)

/** A player's line on the table from their results (an array, null for not played). */
export function lineFor(results) {
  const line = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
  for (const r of results || []) {
    if (!r) continue
    line.p++; line.gf += r.gf; line.ga += r.ga
    if (r.gf > r.ga) line.w++; else if (r.gf === r.ga) line.d++; else line.l++
    line.pts += resultPoints(r)
  }
  line.gd = line.gf - line.ga
  return line
}

/** Table order: points, goal difference, goals scored, then whoever got there first. */
export const tableOrder = (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (a.at || 0) - (b.at || 0)
