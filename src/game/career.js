/**
 * Career mode: your club starts in the bottom division and plays a season at
 * a time against computer clubs. Finish high enough to go up, finish bottom
 * and you go down; win the top division to be champions.
 *
 * Pure functions over plain JSON, built on the league engine in tournament.js.
 */
import { createTournament, recordResult, standings, allFixtures, sanitizeTournament, simulateResult, seededRng } from './tournament'
import { START_COINS, startingSquad, sanitizeSquad, coinsForResult, seasonBonus, developSquad, openWindow, marketFor, signPlayer } from './squad'

export const CAREER_VERSION = 1

// Bottom (index 0) to top. Each division is a league of you plus five computer clubs.
export const DIVISIONS = [
  {
    name: 'Sunday League', difficulty: 'easy',
    clubs: [
      { name: 'Bottle Rockets', primary: '#FF7043', edge: '#FFFFFF', pattern: 'stripe' },
      { name: 'Corner Shop FC', primary: '#8D6E63', edge: '#FFE082', pattern: 'ring' },
      { name: 'Fizzy Rovers', primary: '#26C6DA', edge: '#FFFFFF', pattern: 'dots' },
      { name: 'Park Rangers', primary: '#43A047', edge: '#FFFFFF', pattern: 'split' },
      { name: 'Kerbside Utd', primary: '#757575', edge: '#FFEB3B', pattern: 'cross' },
    ],
  },
  {
    name: 'District League', difficulty: 'easy',
    clubs: [
      { name: 'Crown City', primary: '#5E35B1', edge: '#FFD54F', pattern: 'ring', badge: 'crown' },
      { name: 'Tin Town', primary: '#90A4AE', edge: '#263238', pattern: 'stripe' },
      { name: 'Soda Valley', primary: '#EC407A', edge: '#FFFFFF', pattern: 'wave' },
      { name: 'Flick Athletic', primary: '#1E88E5', edge: '#FFEB3B', pattern: 'split' },
      { name: 'Rimside Wdrs', primary: '#6D4C41', edge: '#FFFFFF', pattern: 'rays' },
    ],
  },
  {
    name: 'National League', difficulty: 'medium',
    clubs: [
      { name: 'Cola Athletic', primary: '#C8102E', edge: '#FFFFFF', pattern: 'wave' },
      { name: 'Crimp United', primary: '#0D47A1', edge: '#FFFFFF', pattern: 'stripe', badge: 'shield' },
      { name: 'Bottleneck City', primary: '#00897B', edge: '#FFFFFF', pattern: 'ring' },
      { name: 'Seaside Pop', primary: '#FFB300', edge: '#0D47A1', pattern: 'rays' },
      { name: 'Ginger Town', primary: '#0B4D2C', edge: '#E8C766', pattern: 'stripe' },
    ],
  },
  {
    name: 'Premier Cap League', difficulty: 'hard',
    clubs: [
      { name: 'Royal Crowns', primary: '#4A148C', edge: '#FFD700', pattern: 'ring', badge: 'crown', finish: 'chrome' },
      { name: 'Chrome FC', primary: '#B0BEC5', edge: '#B71C1C', pattern: 'none', badge: 'star', finish: 'chrome' },
      { name: 'Golden Caps', primary: '#F9A825', edge: '#3E2723', pattern: 'rays', finish: 'gloss' },
      { name: 'Sparkle Utd', primary: '#E53935', edge: '#FFFFFF', pattern: 'dots', badge: 'bolt' },
      { name: 'Metro Fizz', primary: '#212121', edge: '#00E5FF', pattern: 'split', badge: 'flame' },
    ],
  },
]

export const TOP = DIVISIONS.length - 1
// Top two of a division go up; the bottom club goes down
export const PROMOTED = 2
export const RELEGATED = 1
export const ME = 'T1'

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

/** A new season's league for the club in division `level`. */
export function createSeason(club, level, matchDuration = 120, now = Date.now()) {
  const div = DIVISIONS[level]
  const teams = [
    { ...club, cpu: false },
    ...div.clubs.map((c) => ({ badge: 'none', finish: 'gloss', ...c, cpu: true, difficulty: div.difficulty })),
  ]
  return createTournament({ format: 'league', legs: 1, teams, matchDuration, now })
}

/** A brand-new career for `club` (a kit: name, colours, badge...). */
export function newCareer(club, { matchDuration = 120, now = Date.now() } = {}) {
  return {
    v: CAREER_VERSION,
    club,
    level: 0,
    season: 1,
    matchDuration,
    league: createSeason(club, 0, matchDuration, now),
    past: [],          // finished seasons, newest first
    promotions: 0,
    titles: 0,         // top-division wins
    squad: startingSquad(now),
    coins: START_COINS,
    signed: { key: '', ids: [] }, // players already bought in the current window
  }
}

/** How many of your matches you've played this season. */
export function playedThisSeason(league) {
  return allFixtures(league).filter((f) => f.result && (f.home === ME || f.away === ME)).length
}

/** The open transfer window: { index, key, market } or null when it's shut. */
export function transferWindow(career) {
  const index = openWindow(playedThisSeason(career.league))
  if (index < 0) return null
  const key = `${career.season}:${index}`
  const taken = career.signed?.key === key ? career.signed.ids : []
  return { index, key, market: marketFor({ season: career.season, level: career.level, windowIndex: index, taken, seed: career.league.id }) }
}

/** Buy a player from the open window into `role`. Returns the new career, or null if you can't. */
export function buyPlayer(career, playerId, role) {
  const w = transferWindow(career)
  const player = w?.market.find((p) => p.id === playerId)
  if (!player) return null
  const deal = signPlayer(career.squad, career.coins, player, role)
  if (!deal) return null
  const ids = career.signed?.key === w.key ? career.signed.ids : []
  return { ...career, ...deal, signed: { key: w.key, ids: [...ids, playerId] } }
}

/** Has every fixture of the season been played? */
export function seasonOver(league) {
  return allFixtures(league).every((f) => f.result)
}

/** Your club's next match, or null when your season is done. */
export function nextMatch(league) {
  return allFixtures(league).find((f) => !f.result && (f.home === ME || f.away === ME)) || null
}

/** Your league position (1-based). */
export function myPosition(league) {
  return standings(league).findIndex((r) => r.id === ME) + 1
}

/** What finishing `pos` of `count` in division `level` means. */
export function outcomeFor(level, pos, count = 6) {
  if (level === TOP && pos === 1) return 'champions'
  if (level < TOP && pos <= PROMOTED) return 'promoted'
  if (level > 0 && pos > count - RELEGATED) return 'relegated'
  return 'stayed'
}

/**
 * Play out the computer clubs' games up to and including `round` (the whole
 * season when round is Infinity), with seeded scores so a reload agrees.
 */
export function playCpuRounds(league, round = Infinity) {
  let cur = league
  for (const f of allFixtures(league)) {
    if (f.result || f.round > round || f.home === ME || f.away === ME) continue
    cur = recordResult(cur, f.id, simulateResult(cur, f, seededRng(`${cur.id}:${f.id}`)))
  }
  return cur
}

/** Record one of your results; the other games on that matchday play out alongside. */
export function recordCareerResult(career, fixtureId, result) {
  const mine = allFixtures(career.league).find((f) => f.id === fixtureId)
  let league = recordResult(career.league, fixtureId, result)
  // Once your season is done, the rest of the league finishes too
  league = playCpuRounds(league, nextMatch(league) ? (mine?.round ?? 0) : Infinity)
  const home = mine?.home === ME
  const gf = home ? result.home : result.away
  const ga = home ? result.away : result.home
  const earned = mine && Number.isFinite(gf) && Number.isFinite(ga) ? coinsForResult(gf, ga) : 0
  return { ...career, league, coins: (career.coins ?? 0) + earned, lastEarned: earned }
}

/** Close the finished season and start the next one, in the new division. */
export function finishSeason(career, now = Date.now()) {
  const table = standings(career.league)
  const pos = table.findIndex((r) => r.id === ME) + 1
  const me = table[pos - 1]
  const outcome = outcomeFor(career.level, pos, table.length)
  const level = outcome === 'promoted' ? career.level + 1 : outcome === 'relegated' ? career.level - 1 : career.level
  const entry = {
    season: career.season,
    division: DIVISIONS[career.level].name,
    level: career.level,
    position: pos,
    outcome,
    bonus: seasonBonus(outcome),
    record: me ? { w: me.w, d: me.d, l: me.l, gf: me.gf, ga: me.ga, pts: me.pts } : null,
  }
  return {
    ...career,
    level,
    season: career.season + 1,
    league: createSeason(career.club, level, career.matchDuration, now),
    past: [entry, ...career.past].slice(0, 50),
    promotions: career.promotions + (outcome === 'promoted' ? 1 : 0),
    titles: career.titles + (outcome === 'champions' ? 1 : 0),
    coins: (career.coins ?? 0) + seasonBonus(outcome),
    squad: developSquad(career.squad || startingSquad(career.season), `${career.league.id}:${career.season}`),
    signed: { key: '', ids: [] },
    lastEarned: 0,
  }
}

/** Load a saved career, or null if it's missing or unreadable. */
export function sanitizeCareer(input) {
  if (!isObj(input) || input.v !== CAREER_VERSION) return null
  const league = sanitizeTournament(input.league)
  if (!league || !isObj(input.club)) return null
  const level = Number.isInteger(input.level) && input.level >= 0 && input.level <= TOP ? input.level : 0
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0)
  return {
    v: CAREER_VERSION,
    club: input.club,
    level,
    season: Math.max(1, n(input.season)),
    matchDuration: [60, 90, 120, 150, 180].includes(input.matchDuration) ? input.matchDuration : 120,
    league,
    past: Array.isArray(input.past) ? input.past.filter(isObj).slice(0, 50) : [],
    promotions: n(input.promotions),
    titles: n(input.titles),
    // Careers from before the squad existed get a starting squad and purse
    squad: sanitizeSquad(input.squad, league.id),
    coins: Number.isInteger(input.coins) && input.coins >= 0 ? input.coins : START_COINS,
    signed: isObj(input.signed) && typeof input.signed.key === 'string' && Array.isArray(input.signed.ids)
      ? { key: input.signed.key.slice(0, 20), ids: input.signed.ids.filter((x) => typeof x === 'string').slice(0, 20) }
      : { key: '', ids: [] },
    lastEarned: n(input.lastEarned),
  }
}
