/**
 * Career squad: six players (one per cap), each with a rating from 1 to 99
 * and an age. A better-rated player flicks harder and aims steadier. Results
 * earn coins, and coins buy better players in the transfer windows — one
 * before each season and one half-way through it. Young players improve
 * fastest; older ones fade and in the end retire.
 *
 * Pure functions over plain JSON.
 */
import { seededRng } from './tournament'
import { CAP_ROLES } from '../data/TeamOptions'

export const START_COINS = 300
export const SELL_SHARE = 0.6
// After how many of your matches each window opens: before the season and part-way through
export const WINDOW_AFTER = [0, 5]
export const MARKET_SIZE = 6

// The typical player in each division, bottom to top
export const DIVISION_RATING = [40, 52, 64, 76]

const FIRST = ['Sam', 'Alex', 'Jo', 'Kit', 'Ray', 'Max', 'Lou', 'Ben', 'Dev', 'Tom', 'Remi', 'Ade', 'Nico', 'Theo', 'Kofi', 'Luca', 'Ezra', 'Finn', 'Omar', 'Ravi', 'Tariq', 'Milo', 'Jude', 'Ike']
const LAST = ['Fizzwell', 'Corker', 'Crimp', 'Tinley', 'Pops', 'Bottley', 'Spinner', 'Rimmer', 'Flickson', 'Capper', 'Sodaby', 'Twister', 'Glassby', 'Ringer', 'Clinks', 'Bubbles', 'Hopsworth', 'Seltzer', 'Fizzard', 'Crowne', 'Shaker', 'Pressley', 'Tapps', 'Brewer']

export const ROLE_LABEL = { gk: 'GK', def1: 'DEF', def2: 'DEF', mid: 'MID', atk1: 'ATK', atk2: 'ATK' }

const clampRating = (r) => Math.max(1, Math.min(99, Math.round(r)))
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length]

/** How much harder (or softer) a player flicks than an average one: 0.84 at 1, 1.0 at 50, 1.16 at 99. */
export function flickScale(rating) {
  if (!Number.isFinite(rating)) return 1
  return 0.84 + ((clampRating(rating) - 1) / 98) * 0.32
}

/**
 * How far a player's flick can stray from where it was aimed, in degrees:
 * about 2.6° for a Sunday-league 40, 0.6° for a Premier 76, none at 99.
 * No ratings (ordinary matches): 0.
 */
export function aimWobble(rating) {
  if (!Number.isFinite(rating)) return 0
  return Math.round(6 * Math.pow(1 - clampRating(rating) / 99, 1.6) * 100) / 100
}

export const MIN_AGE = 17
export const RETIRE_FROM = 34

/** How a player's age moves his rating over a summer: young players grow, old ones fade. */
export function ageGrowth(age) {
  if (age <= 20) return 3
  if (age <= 23) return 2
  if (age <= 27) return 1
  if (age <= 30) return 0
  if (age <= 32) return -1
  return -2
}

/** Transfer fee for a player of this rating (youth players come at half price). */
export function priceOf(rating, youth = false) {
  const fee = Math.max(20, Math.round((clampRating(rating) ** 2) / 10))
  return youth ? Math.max(20, Math.round(fee / 2)) : fee
}

/** What you get back when you let a player go. */
export function sellValue(rating) {
  return Math.round(priceOf(rating) * SELL_SHARE)
}

/** A made-up player around `base` rating, aged between `ages[0]` and `ages[1]`. */
export function makePlayer(rng, base, keeper = false, spread = 6, ages = [19, 31]) {
  return {
    id: Math.floor(rng() * 1e9).toString(36),
    name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
    keeper,
    rating: clampRating(base + (rng() * 2 - 1) * spread),
    age: ages[0] + Math.floor(rng() * (ages[1] - ages[0] + 1)),
    youth: false,
    apps: 0, goals: 0, ratingSum: 0, form: [],
  }
}

/** A youth player: young, cheap, a little below the division, and quick to improve. */
export function makeYouth(rng, level, keeper = false) {
  return { ...makePlayer(rng, (DIVISION_RATING[level] ?? 40) - 8, keeper, 3, [17, 18]), youth: true }
}

/** Your first squad: a bit below the bottom division's average. */
export function startingSquad(seed = 'start') {
  const rng = seededRng(`squad:${seed}`)
  return Object.fromEntries(CAP_ROLES.map((role) => [role, makePlayer(rng, DIVISION_RATING[0] - 2, role === 'gk', 4)]))
}

/** Ratings by cap role, as a match uses them. */
export function squadRatings(squad) {
  if (!squad) return null
  return Object.fromEntries(CAP_ROLES.map((role) => [role, squad[role]?.rating ?? 50]))
}

/** Surnames by cap role, for printing on the caps. */
export function squadSurnames(squad) {
  if (!squad) return null
  return Object.fromEntries(CAP_ROLES.map((role) => [role, String(squad[role]?.name || '').trim().split(/\s+/).pop().slice(0, 12)]))
}

/** A computer club's ratings, the same every time for that club in that division. */
export function clubRatings(level, clubName) {
  const rng = seededRng(`club:${level}:${clubName}`)
  const base = DIVISION_RATING[level] ?? 50
  return Object.fromEntries(CAP_ROLES.map((role) => [role, clampRating(base + (rng() * 2 - 1) * 6)]))
}

/** A matchup in a word, from the two sides' overall ratings. */
export function matchupOf(mine, theirs) {
  const d = mine - theirs
  return d >= 3 ? 'favourite' : d <= -3 ? 'underdog' : 'even'
}

export function averageRating(ratings) {
  if (!ratings) return 0
  const v = Object.values(ratings)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0
}

/** Coins for one of your results. */
export function coinsForResult(gf, ga) {
  const base = gf > ga ? 60 : gf === ga ? 25 : 10
  return base + 5 * Math.max(0, gf)
}

/** Coins at the end of a season. */
export function seasonBonus(outcome) {
  return { champions: 300, promoted: 150, stayed: 50, relegated: 20 }[outcome] ?? 0
}

/**
 * Which transfer window is open, given how many of your matches you've played
 * this season: 0 (pre-season), 1 (mid-season) or -1 (shut).
 */
export function openWindow(played) {
  return WINDOW_AFTER.indexOf(played)
}

/** The players on offer in this window: the same list for a reload, minus the ones you've signed. */
export function marketFor({ season, level, windowIndex, taken = [], seed = '' }) {
  const rng = seededRng(`market:${seed}:${season}:${windowIndex}`)
  const base = DIVISION_RATING[level] ?? 50
  const players = []
  for (let i = 0; i < MARKET_SIZE; i++) {
    // Upgrades at a range of prices: a couple of stars, some solid buys, a keeper, and a youth prospect
    if (i === MARKET_SIZE - 1) { players.push(makeYouth(rng, level, rng() < 0.2)); continue }
    const lift = [13, 9, 6, 4, 5][i]
    players.push(makePlayer(rng, base + lift, i === 4, 3, i === 0 ? [24, 31] : [20, 30]))
  }
  return players.filter((p) => !taken.includes(p.id))
}

/**
 * A season's development. Each player moves by his season (average match
 * rating) plus his age: young players grow, older ones fade. Everyone gets a
 * year older; players past RETIRE_FROM may retire, and a youth player takes
 * their place. Season stats reset.
 * Returns { squad, retired: [{ role, name, age, rating }], changes: [{ role, name, from, to }] }.
 */
export function developSeason(squad, seed, level = 0) {
  const rng = seededRng(`develop:${seed}`)
  const retired = []
  const changes = []
  const next = {}
  for (const [role, p] of Object.entries(squad)) {
    const age = Number.isInteger(p.age) ? p.age : 25
    if (age >= RETIRE_FROM && rng() < 0.3 + (age - RETIRE_FROM) * 0.25) {
      retired.push({ role, name: p.name, age, rating: p.rating })
      next[role] = makeYouth(rng, level, role === 'gk')
      continue
    }
    const avg = p.apps ? p.ratingSum / p.apps : null
    const form = avg == null ? 0 : avg >= 7.5 ? 2 : avg >= 6.8 ? 1 : avg >= 6 ? 0 : -1
    const change = form + ageGrowth(age) + Math.floor(rng() * 3) - 1
    const rating = clampRating(p.rating + change)
    if (rating !== p.rating) changes.push({ role, name: p.name, from: p.rating, to: rating })
    next[role] = { ...p, rating, age: age + 1, youth: age + 1 <= 19 && !!p.youth, apps: 0, goals: 0, ratingSum: 0, form: [] }
  }
  return { squad: next, retired, changes }
}

/** The squad part of developSeason (kept for older callers). */
export function developSquad(squad, seed, level = 0) {
  return developSeason(squad, seed, level).squad
}

/* ── Match ratings ── */

const round1 = (n) => Math.round(n * 10) / 10

/**
 * Out-of-10 ratings for one side's six players after a match.
 * side: 'team1' | 'team2' — the caps are `${side}_${role}`.
 */
export function matchRatings({ side, goalLog = [], matchEvents = [], score }) {
  const other = side === 'team1' ? 'team2' : 'team1'
  const gf = score?.[side] ?? 0
  const ga = score?.[other] ?? 0
  const result = gf > ga ? 0.5 : gf < ga ? -0.4 : 0.1
  const out = {}
  for (const role of CAP_ROLES) {
    const cap = `${side}_${role}`
    let r = 6 + result
    for (const g of goalLog) {
      if (g.shootout || g.cap !== cap) continue
      r += g.own ? -1.2 : 1.3
    }
    for (const e of matchEvents) {
      if (e.cap === cap && (e.type === 'save' || e.type === 'block' || e.type === 'post')) r += 0.3 // shot on target
      if (e.by === cap && e.type === 'save') r += 0.7
      if (e.by === cap && e.type === 'block') r += 0.5
    }
    if (role === 'gk' || role.startsWith('def')) r += ga === 0 ? 1 : -0.25 * Math.max(0, ga - 1)
    out[role] = Math.max(3, Math.min(10, round1(r)))
  }
  return out
}

/** The best performer (ties go to whoever scored most, then the attacker). */
export function manOfTheMatch(ratings, goalsByRole = {}) {
  return [...CAP_ROLES].reverse().sort((a, b) => (ratings[b] - ratings[a]) || ((goalsByRole[b] || 0) - (goalsByRole[a] || 0)))[0]
}

/**
 * One match for the career squad: appearances, goals, form, and a chance to
 * grow (a great game) or slip (a poor one). Returns { squad, changes, motm, ratings }.
 */
export function applyMatchToSquad(squad, { ratings, goalsByRole = {}, seed }) {
  const rng = seededRng(`grow:${seed}`)
  const changes = []
  const next = {}
  for (const role of CAP_ROLES) {
    const p = squad[role]
    const r = ratings[role] ?? 6
    let rating = p.rating
    const roll = rng()
    if (r >= 8.5 && roll < 0.75) rating += 1
    else if (r >= 7.5 && roll < 0.45) rating += 1
    else if (r <= 4.8 && roll < 0.35) rating -= 1
    rating = clampRating(rating)
    if (rating !== p.rating) changes.push({ role, name: p.name, from: p.rating, to: rating })
    next[role] = {
      ...p,
      rating,
      apps: (p.apps || 0) + 1,
      goals: (p.goals || 0) + (goalsByRole[role] || 0),
      ratingSum: round1((p.ratingSum || 0) + r),
      form: [...(p.form || []), r].slice(-5),
    }
  }
  return { squad: next, changes, motm: manOfTheMatch(ratings, goalsByRole), ratings }
}

/** Average of the last few match ratings, or null before any. */
export const formOf = (p) => (p?.form?.length ? round1(p.form.reduce((a, b) => a + b, 0) / p.form.length) : null)

/**
 * Sign `player` into `role`, letting the current player there go.
 * Returns { squad, coins } or null when it isn't allowed.
 */
export function signPlayer(squad, coins, player, role) {
  if (!squad?.[role] || !player) return null
  if ((role === 'gk') !== !!player.keeper) return null
  const fee = priceOf(player.rating, player.youth)
  const back = sellValue(squad[role].rating)
  if (coins + back < fee) return null
  return { squad: { ...squad, [role]: { ...player } }, coins: coins + back - fee }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

/** Clean up a saved squad; fills any gap with a fresh player. */
export function sanitizeSquad(input, seed = 'fix') {
  const fresh = startingSquad(seed)
  if (!isObj(input)) return fresh
  return Object.fromEntries(CAP_ROLES.map((role) => {
    const p = input[role]
    if (!isObj(p) || !Number.isFinite(p.rating) || typeof p.name !== 'string') return [role, fresh[role]]
    const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0)
    // Players from before ages existed get one, the same on every load
    const age = Number.isInteger(p.age) && p.age >= MIN_AGE && p.age <= 45 ? p.age : 20 + (Math.abs([...String(p.id || role)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 10)
    return [role, {
      id: String(p.id || role).slice(0, 16), name: p.name.slice(0, 24), keeper: role === 'gk', rating: clampRating(p.rating), age, youth: p.youth === true,
      apps: Math.floor(n(p.apps)), goals: Math.floor(n(p.goals)), ratingSum: n(p.ratingSum),
      form: Array.isArray(p.form) ? p.form.filter((x) => Number.isFinite(x) && x >= 0 && x <= 10).slice(-5) : [],
    }]
  }))
}
