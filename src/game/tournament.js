/**
 * Tournaments — knockout cups and leagues — as pure functions.
 *
 * No store, storage or DOM in here: a tournament is plain JSON that goes in
 * and comes out, so it saves to localStorage as-is (and to an online
 * database later) and every rule is unit tested directly.
 *
 * Shape:
 *   { v, id, format: 'knockout' | 'league', legs: 1 | 2, createdAt,
 *     teams: [{ id, name, primary, edge, badge, pattern, finish, numbers, cpu, difficulty }],
 *     // league: the full fixture list up front
 *     fixtures: [{ id, round, home, away, result }],
 *     // knockout: rounds of ties; later rounds fill in as winners are known
 *     rounds: [[{ id, home, away, result, winner }]],
 *     championId, runnerUpId }
 *   result = { home: goals, away: goals, pens?: { home, away } }
 */

import { AI_DIFFICULTIES } from './records.js'
import { sanitizeCapText, CAP_ROLES, CAP_NAME_MODES, sanitizePlayerName } from '../data/TeamOptions.js'

export const TOURNAMENT_VERSION = 1
export const MIN_TEAMS = 3
export const MAX_TEAMS = 8
export const FORMATS = ['knockout', 'league']
export const LEAGUE_POINTS = { win: 3, draw: 1, loss: 0 }

const HEX = /^#[0-9a-f]{6}$/i
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/* ── Helpers ─────────────────────────────────────────────── */

function shuffled(list, rng) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function nextPow2(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** Who won a played tie: home/away team id, or null for a draw with no pens. */
export function resultWinner(fixture) {
  const r = fixture?.result
  if (!r) return null
  if (r.home > r.away) return fixture.home
  if (r.away > r.home) return fixture.away
  if (r.pens) {
    if (r.pens.home > r.pens.away) return fixture.home
    if (r.pens.away > r.pens.home) return fixture.away
  }
  return null
}

/** Round names for a cup with this many rounds ("Final", "Semi-finals", …). */
export function roundName(roundIndex, roundCount) {
  const fromEnd = roundCount - 1 - roundIndex
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-finals'
  if (fromEnd === 2) return 'Quarter-finals'
  return `Round ${roundIndex + 1}`
}

/* ── Creating ────────────────────────────────────────────── */

/**
 * League fixtures by the circle method: every team meets every other once per
 * leg, nobody plays twice in a round, and home/away alternates where it can.
 * With an odd number of teams one team sits each round out.
 */
export function leagueFixtures(teamIds, legs = 1) {
  const ids = [...teamIds]
  if (ids.length % 2) ids.push(null) // the bye
  const n = ids.length
  const rounds = n - 1
  const out = []
  let rotating = ids.slice(1)
  for (let r = 0; r < rounds; r++) {
    const lineup = [ids[0], ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i]
      const b = lineup[n - 1 - i]
      if (a === null || b === null) continue
      // Rotating pairs keep their orientation; flipping them each round
      // accidentally makes some clubs away for their entire first leg.
      // Odd leagues use a balanced cyclic orientation around the bye.
      const flip = teamIds.length % 2
        ? (teamIds.indexOf(b) - teamIds.indexOf(a) + teamIds.length) % teamIds.length > teamIds.length / 2
        : (i === 0 ? r % 2 === 1 : i % 2 === 1)
      out.push({ round: r, home: flip ? b : a, away: flip ? a : b })
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]
  }
  if (legs === 2) {
    const first = out.length
    for (let k = 0; k < first; k++) {
      const f = out[k]
      out.push({ round: f.round + rounds, home: f.away, away: f.home })
    }
  }
  return out.map((f, i) => ({ id: `L${i + 1}`, ...f, result: null }))
}

/**
 * A random knockout draw. The bracket is the next power of two; teams drawn
 * against "nobody" get a bye into round two (byes never meet each other).
 */
export function knockoutRounds(teamIds, rng = Math.random) {
  const order = shuffled(teamIds, rng)
  const size = nextPow2(Math.max(2, order.length))
  const byes = size - order.length
  const roundCount = Math.log2(size)
  const rounds = []
  const first = []
  let k = 0
  for (let m = 0; m < size / 2; m++) {
    const home = order[k++] ?? null
    const away = m < byes ? null : order[k++] ?? null
    first.push({ id: `K1-${m + 1}`, home, away, result: null, winner: away === null ? home : null })
  }
  rounds.push(first)
  for (let r = 1; r < roundCount; r++) {
    const ties = []
    for (let m = 0; m < size / 2 ** (r + 1); m++) ties.push({ id: `K${r + 1}-${m + 1}`, home: null, away: null, result: null, winner: null })
    rounds.push(ties)
  }
  return advanceBracket(rounds)
}

/** Fill later rounds from decided ties (pure: returns new rounds). */
function advanceBracket(rounds) {
  const out = rounds.map((r) => r.map((t) => ({ ...t })))
  for (let r = 0; r + 1 < out.length; r++) {
    out[r].forEach((tie, m) => {
      const next = out[r + 1][Math.floor(m / 2)]
      const slot = m % 2 === 0 ? 'home' : 'away'
      if (tie.winner && next[slot] !== tie.winner) next[slot] = tie.winner
    })
  }
  return out
}

/** Clean a team from the set-up screen (or from storage). */
export function sanitizeTeam(input, i = 0) {
  const t = isObj(input) ? input : {}
  const name = typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 16) : `Team ${i + 1}`
  const numbers = {}
  const srcNums = isObj(t.numbers) ? t.numbers : {}
  for (const role of CAP_ROLES) {
    const n = srcNums[role]
    if (Number.isInteger(n) && n >= 0 && n <= 99) numbers[role] = n
  }
  return {
    id: typeof t.id === 'string' && t.id.length <= 24 ? t.id : `T${i + 1}`,
    name,
    primary: HEX.test(t.primary) ? t.primary : '#D32F2F',
    edge: HEX.test(t.edge) ? t.edge : '#FFFFFF',
    textColor: HEX.test(t.textColor) ? t.textColor : '',
    skirtColor: HEX.test(t.skirtColor) ? t.skirtColor : '',
    badge: typeof t.badge === 'string' ? t.badge.slice(0, 16) : 'none',
    pattern: typeof t.pattern === 'string' ? t.pattern.slice(0, 16) : 'none',
    finish: typeof t.finish === 'string' ? t.finish.slice(0, 16) : 'matte',
    capText: sanitizeCapText(t.capText),
    showName: t.showName !== false,
    capNames: CAP_NAME_MODES.includes(t.capNames) ? t.capNames : 'player',
    players: Object.fromEntries(CAP_ROLES.map((r) => [r, sanitizePlayerName(isObj(t.players) ? t.players[r] : '')]).filter(([, n]) => n)),
    numbers,
    cpu: t.cpu === true,
    difficulty: AI_DIFFICULTIES.includes(t.difficulty) ? t.difficulty : 'medium',
  }
}

/** A brand-new tournament, ready to play. Throws on an impossible set-up. */
export function createTournament({ format, legs = 1, teams, matchDuration = 180, playMode = 'live', turnsPerPlayer = 20, deadlineHours = 0, rng = Math.random, now = Date.now() }) {
  if (!FORMATS.includes(format)) throw new Error(`Unknown format: ${format}`)
  if (!Array.isArray(teams) || teams.length < MIN_TEAMS || teams.length > MAX_TEAMS) {
    throw new Error(`A tournament needs ${MIN_TEAMS}–${MAX_TEAMS} teams`)
  }
  const clean = teams.map((t, i) => ({ ...sanitizeTeam(t, i), id: `T${i + 1}` }))
  const ids = clean.map((t) => t.id)
  const base = {
    v: TOURNAMENT_VERSION,
    id: `${now.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
    format,
    legs: format === 'league' && legs === 2 ? 2 : 1,
    matchDuration,
    playMode: playMode === 'anytime' ? 'anytime' : 'live',
    turnsPerPlayer: [10, 20, 30].includes(turnsPerPlayer) ? turnsPerPlayer : 20,
    deadlineHours: [0, 24, 48].includes(deadlineHours) ? deadlineHours : 0,
    createdAt: now,
    teams: clean,
    championId: null,
    runnerUpId: null,
  }
  if (format === 'league') return { ...base, fixtures: leagueFixtures(ids, base.legs), rounds: null }
  return { ...base, fixtures: null, rounds: knockoutRounds(ids, rng) }
}

/* ── Reading ─────────────────────────────────────────────── */

export const teamById = (t, id) => t?.teams?.find((x) => x.id === id) || null

/** Every playable fixture, in playing order, with its round. */
export function allFixtures(t) {
  if (!t) return []
  if (t.format === 'league') return t.fixtures
  return t.rounds.flatMap((round, r) => round
    .filter((tie) => tie.home && tie.away)
    .map((tie) => ({ ...tie, round: r })))
}

/** The next fixture still to be played, or null when the tournament is over. */
export function nextFixture(t) {
  if (!t || t.championId) return null
  if (t.format === 'league') return t.fixtures.find((f) => !f.result) || null
  for (let r = 0; r < t.rounds.length; r++) {
    const tie = t.rounds[r].find((x) => x.home && x.away && !x.winner)
    if (tie) return { ...tie, round: r }
  }
  return null
}

/** League table, best first: P W D L GF GA GD Pts. Ties: GD, then GF, then name. */
export function standings(t) {
  const rows = new Map(t.teams.map((team) => [team.id, { id: team.id, name: team.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]))
  for (const f of t.fixtures || []) {
    if (!f.result) continue
    const h = rows.get(f.home)
    const a = rows.get(f.away)
    if (!h || !a) continue
    const { home, away } = f.result
    h.p++; a.p++
    h.gf += home; h.ga += away; a.gf += away; a.ga += home
    if (home > away) { h.w++; a.l++; h.pts += LEAGUE_POINTS.win }
    else if (away > home) { a.w++; h.l++; a.pts += LEAGUE_POINTS.win }
    else { h.d++; a.d++; h.pts += LEAGUE_POINTS.draw; a.pts += LEAGUE_POINTS.draw }
  }
  const out = [...rows.values()].map((r) => ({ ...r, gd: r.gf - r.ga }))
  out.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name))
  return out
}

/** Played / total fixtures, for progress bars. */
export function progress(t) {
  if (!t) return { played: 0, total: 0 }
  if (t.format === 'league') {
    return { played: t.fixtures.filter((f) => f.result).length, total: t.fixtures.length }
  }
  // Every cup tie knocks one team out, so there are always teams − 1 of them
  return { played: t.rounds.flat().filter((x) => x.result).length, total: t.teams.length - 1 }
}

/** Does this fixture need a human at the controls? */
export function needsHuman(t, fixture) {
  if (!fixture) return false
  return !teamById(t, fixture.home)?.cpu || !teamById(t, fixture.away)?.cpu
}

/* ── Recording results ───────────────────────────────────── */

function validResult(r, knockout) {
  if (!isObj(r)) return false
  const goal = (n) => Number.isInteger(n) && n >= 0 && n <= 99
  if (!goal(r.home) || !goal(r.away)) return false
  if (r.pens !== undefined) {
    if (!isObj(r.pens) || !goal(r.pens.home) || !goal(r.pens.away) || r.pens.home === r.pens.away) return false
    if (r.home !== r.away) return false
  }
  // A cup tie has to have a winner
  if (knockout && r.home === r.away && !r.pens) return false
  return true
}

/**
 * Record a fixture's result. Returns the updated tournament (unchanged if
 * the result is invalid, the fixture is unknown or already played).
 */
/** Who scored in a match (local play only): [{ side: 'home'|'away', name, number, own }]. */
export function cleanScorers(list) {
  if (!Array.isArray(list)) return []
  return list.slice(0, 40).filter((g) => isObj(g) && (g.side === 'home' || g.side === 'away') && typeof g.name === 'string').map((g) => ({
    side: g.side,
    name: g.name.slice(0, 16),
    number: Number.isInteger(g.number) && g.number >= 0 && g.number <= 99 ? g.number : null,
    own: g.own === true,
  }))
}

export function recordResult(t, fixtureId, result) {
  if (!t || t.championId) return t
  const knockout = t.format === 'knockout'
  if (!validResult(result, knockout)) return t
  const scorers = cleanScorers(result.scorers)
  const clean = { home: result.home, away: result.away, ...(result.pens ? { pens: { home: result.pens.home, away: result.pens.away } } : {}), ...(scorers.length ? { scorers } : {}) }

  if (!knockout) {
    const idx = t.fixtures.findIndex((f) => f.id === fixtureId)
    if (idx < 0 || t.fixtures[idx].result) return t
    const fixtures = t.fixtures.map((f, i) => (i === idx ? { ...f, result: clean } : f))
    const next = { ...t, fixtures }
    if (fixtures.every((f) => f.result)) {
      const table = standings(next)
      return { ...next, championId: table[0].id, runnerUpId: table[1]?.id || null }
    }
    return next
  }

  let found = false
  const rounds = t.rounds.map((round) => round.map((tie) => {
    if (tie.id !== fixtureId || !tie.home || !tie.away || tie.result) return tie
    found = true
    const played = { ...tie, result: clean }
    return { ...played, winner: resultWinner(played) }
  }))
  if (!found) return t
  const advanced = advanceBracket(rounds)
  const final = advanced[advanced.length - 1][0]
  if (final.winner) {
    return { ...t, rounds: advanced, championId: final.winner, runnerUpId: final.winner === final.home ? final.away : final.home }
  }
  return { ...t, rounds: advanced }
}

/* ── CPU v CPU ───────────────────────────────────────────── */

const STRENGTH = { easy: 0.9, medium: 1.25, hard: 1.6 } // average goals a match

/** Goals for one side: a small Poisson draw around its strength. */
function goalsFor(strength, rng) {
  const L = Math.exp(-strength)
  let k = 0
  let p = 1
  do { k++; p *= rng() } while (p > L && k < 12)
  return k - 1
}

/** A believable result for a fixture between two CPU teams. */
export function simulateResult(t, fixture, rng = Math.random) {
  const home = teamById(t, fixture.home)
  const away = teamById(t, fixture.away)
  const result = {
    home: goalsFor(STRENGTH[home?.difficulty] ?? 1.2, rng),
    away: goalsFor(STRENGTH[away?.difficulty] ?? 1.2, rng),
  }
  if (t.format === 'knockout' && result.home === result.away) {
    // Shootout: best of three, then sudden death
    const homeWins = rng() < 0.5
    const loser = Math.floor(rng() * 3)
    result.pens = homeWins ? { home: loser + 1, away: loser } : { home: loser, away: loser + 1 }
  }
  return result
}

/**
 * Play out every CPU-only fixture up to the next one a human takes part in.
 * Returns { tournament, simulated: [{ fixture, result }] }.
 */
export function simulateCpuFixtures(t, rng = Math.random) {
  let cur = t
  const simulated = []
  for (let guard = 0; guard < 200; guard++) {
    const f = nextFixture(cur)
    if (!f || needsHuman(cur, f)) break
    const result = simulateResult(cur, f, rng)
    const after = recordResult(cur, f.id, result)
    if (after === cur) break
    simulated.push({ fixture: f, result })
    cur = after
  }
  return { tournament: cur, simulated }
}

/* ── Any-order play (online, and CPU games on any device) ── */

/** A small seeded random generator: same seed, same numbers, on every device. */
export function seededRng(seed) {
  let h = 1779033703 ^ String(seed).length
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** The next matchday with a human fixture; CPU-only bye days settle with it. */
export function leagueMatchday(t) {
  if (!t || t.format !== 'league' || t.championId) return null
  const human = t.fixtures.find((f) => !f.result && needsHuman(t, f))
  return human?.round ?? t.fixtures.find((f) => !f.result)?.round ?? null
}

/** Every fixture that can be played right now (both teams known, no result yet). */
export function readyFixtures(t) {
  if (!t || t.championId) return []
  const round = leagueMatchday(t)
  return allFixtures(t).filter((f) => f.home && f.away && !f.result && !f.winner
    && (t.format !== 'league' || f.round === round))
}

/**
 * Settle completed league matchdays, or every ready CPU cup tie (a cup's later
 * rounds open up as earlier ones finish). Each result comes from a generator
 * seeded with the tournament and fixture ids, so every device — and every
 * reload — gets exactly the same scores without saving them anywhere.
 */
export function settleCpu(t) {
  let cur = t
  for (let guard = 0; guard < 200; guard++) {
    // A league starts with an empty table. Settle a matchday only after all
    // its human matches finish, including intervening CPU-only bye days.
    // Never pre-play the computer's entire season at creation or on reload.
    const hasHumans = cur?.format === 'league' && cur.teams.some((x) => !x.cpu)
    if (hasHumans && !cur.fixtures.some((x) => x.result)) break
    const nextHuman = hasHumans ? cur.fixtures.find((x) => !x.result && needsHuman(cur, x)) : null
    const available = hasHumans
      ? cur.fixtures.filter((x) => !x.result && (!nextHuman || x.round < nextHuman.round))
      : readyFixtures(cur)
    const f = available.find((x) => !needsHuman(cur, x))
    if (!f) break
    const after = recordResult(cur, f.id, simulateResult(cur, f, seededRng(`${cur.id}:${f.id}`)))
    if (after === cur) break
    cur = after
  }
  return cur
}

/**
 * Rebuild an online tournament from its starting draw plus the reported
 * results (in any order). Results that don't fit (yet) are skipped.
 */
export function applyResults(start, results) {
  let cur = settleCpu(start)
  let pending = [...(results || [])]
  for (let pass = 0; pass < (results?.length || 0) + 1 && pending.length; pass++) {
    const left = []
    for (const r of pending) {
      const f = readyFixtures(cur).find((x) => x.id === r.fixtureId)
      if (!f || f.home !== r.homeTeam || f.away !== r.awayTeam) { left.push(r); continue }
      const result = { home: r.home, away: r.away, ...(r.pensHome != null && r.pensAway != null ? { pens: { home: r.pensHome, away: r.pensAway } } : {}) }
      const after = recordResult(cur, f.id, result)
      if (after === cur) continue // invalid: drop it
      cur = settleCpu(after)
    }
    if (left.length === pending.length) break
    pending = left
  }
  return cur
}

/* ── Storage ─────────────────────────────────────────────── */

/** Rebuild a saved tournament, or null if it isn't one we can trust. */
export function sanitizeTournament(input) {
  if (!isObj(input) || input.v !== TOURNAMENT_VERSION || !FORMATS.includes(input.format)) return null
  if (!Array.isArray(input.teams) || input.teams.length < MIN_TEAMS || input.teams.length > MAX_TEAMS) return null
  const teams = input.teams.map((team, i) => sanitizeTeam(team, i))
  const ids = new Set(teams.map((x) => x.id))
  if (ids.size !== teams.length) return null
  const okId = (id) => id === null || ids.has(id)
  const okResult = (r, knockout) => r === null || validResult(r, knockout)
  const base = {
    v: TOURNAMENT_VERSION,
    id: typeof input.id === 'string' ? input.id.slice(0, 40) : 'saved',
    format: input.format,
    playMode: input.playMode === 'anytime' ? 'anytime' : 'live',
    turnsPerPlayer: [10, 20, 30].includes(input.turnsPerPlayer) ? input.turnsPerPlayer : 20,
    deadlineHours: [0, 24, 48].includes(input.deadlineHours) ? input.deadlineHours : 0,
    legs: input.legs === 2 ? 2 : 1,
    matchDuration: [60, 90, 120, 150, 180].includes(input.matchDuration) ? input.matchDuration : 180,
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : 0,
    teams,
    championId: ids.has(input.championId) ? input.championId : null,
    runnerUpId: ids.has(input.runnerUpId) ? input.runnerUpId : null,
  }
  if (input.format === 'league') {
    if (!Array.isArray(input.fixtures)) return null
    const fixtures = input.fixtures.map((f) => ({
      id: String(f?.id ?? '').slice(0, 12), round: Number.isInteger(f?.round) ? f.round : 0,
      home: f?.home, away: f?.away, result: f?.result ?? null,
    }))
    if (!fixtures.every((f) => ids.has(f.home) && ids.has(f.away) && okResult(f.result, false))) return null
    return { ...base, fixtures, rounds: null }
  }
  if (!Array.isArray(input.rounds) || !input.rounds.every(Array.isArray)) return null
  const rounds = input.rounds.map((round) => round.map((x) => ({
    id: String(x?.id ?? '').slice(0, 12), home: x?.home ?? null, away: x?.away ?? null,
    result: x?.result ?? null, winner: x?.winner ?? null,
  })))
  if (!rounds.flat().every((x) => okId(x.home) && okId(x.away) && okId(x.winner) && okResult(x.result, true))) return null
  return { ...base, fixtures: null, rounds }
}

/** One line for the winners' history. */
export function historyEntry(t, now = Date.now()) {
  const champ = teamById(t, t.championId)
  if (!champ) return null
  const runner = teamById(t, t.runnerUpId)
  return {
    id: t.id,
    format: t.format,
    teams: t.teams.length,
    date: now,
    champion: { name: champ.name, primary: champ.primary, edge: champ.edge, cpu: champ.cpu },
    runnerUp: runner ? { name: runner.name, primary: runner.primary } : null,
  }
}
