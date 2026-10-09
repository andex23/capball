/**
 * Career squad: six players (one per cap), each with a rating from 1 to 99.
 * A better-rated player flicks a little harder. Results earn coins, and coins
 * buy better players in the transfer windows — one before each season and
 * one half-way through it.
 *
 * Pure functions over plain JSON.
 */
import { seededRng } from './tournament'
import { CAP_ROLES } from '../data/TeamOptions'

export const START_COINS = 300
export const SELL_SHARE = 0.6
// After how many of your matches each window opens: before the season and part-way through
export const WINDOW_AFTER = [0, 3]
export const MARKET_SIZE = 6

// The typical player in each division, bottom to top
export const DIVISION_RATING = [40, 52, 64, 76]

const FIRST = ['Sam', 'Alex', 'Jo', 'Kit', 'Ray', 'Max', 'Lou', 'Ben', 'Dev', 'Tom', 'Remi', 'Ade', 'Nico', 'Theo', 'Kofi', 'Luca', 'Ezra', 'Finn', 'Omar', 'Ravi', 'Tariq', 'Milo', 'Jude', 'Ike']
const LAST = ['Fizzwell', 'Corker', 'Crimp', 'Tinley', 'Pops', 'Bottley', 'Spinner', 'Rimmer', 'Flickson', 'Capper', 'Sodaby', 'Twister', 'Glassby', 'Ringer', 'Clinks', 'Bubbles', 'Hopsworth', 'Seltzer', 'Fizzard', 'Crowne', 'Shaker', 'Pressley', 'Tapps', 'Brewer']

export const ROLE_LABEL = { gk: 'GK', def1: 'DEF', def2: 'DEF', mid: 'MID', atk1: 'ATK', atk2: 'ATK' }

const clampRating = (r) => Math.max(1, Math.min(99, Math.round(r)))
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length]

/** How much harder (or softer) a player flicks than an average one: 0.88 at 1, 1.0 at 50, 1.12 at 99. */
export function flickScale(rating) {
  if (!Number.isFinite(rating)) return 1
  return 0.88 + ((clampRating(rating) - 1) / 98) * 0.24
}

/** Transfer fee for a player of this rating. */
export function priceOf(rating) {
  return Math.max(20, Math.round((clampRating(rating) ** 2) / 10))
}

/** What you get back when you let a player go. */
export function sellValue(rating) {
  return Math.round(priceOf(rating) * SELL_SHARE)
}

/** A made-up player around `base` rating. */
export function makePlayer(rng, base, keeper = false, spread = 6) {
  return {
    id: Math.floor(rng() * 1e9).toString(36),
    name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
    keeper,
    rating: clampRating(base + (rng() * 2 - 1) * spread),
  }
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
    // Upgrades at a range of prices: a couple of stars, some solid buys, a cheap keeper
    const lift = [13, 9, 6, 4, 2, 5][i]
    players.push(makePlayer(rng, base + lift, i === 5, 3))
  }
  return players.filter((p) => !taken.includes(p.id))
}

/** A season's development: each player moves a few points (mostly up). */
export function developSquad(squad, seed) {
  const rng = seededRng(`develop:${seed}`)
  return Object.fromEntries(Object.entries(squad).map(([role, p]) => [role, { ...p, rating: clampRating(p.rating + Math.floor(rng() * 5) - 1) }]))
}

/**
 * Sign `player` into `role`, letting the current player there go.
 * Returns { squad, coins } or null when it isn't allowed.
 */
export function signPlayer(squad, coins, player, role) {
  if (!squad?.[role] || !player) return null
  if ((role === 'gk') !== !!player.keeper) return null
  const fee = priceOf(player.rating)
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
    return [role, { id: String(p.id || role).slice(0, 16), name: p.name.slice(0, 24), keeper: role === 'gk', rating: clampRating(p.rating) }]
  }))
}
