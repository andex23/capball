/**
 * Career squad, modelled on EA Sports FC / FIFA career mode and Football
 * Manager:
 *
 * - Each player has four attributes (1–99), and each does something real on
 *   the pitch: PWR (how hard he flicks), SHT (how straight a hard flick goes),
 *   PAS (how straight a soft one goes) and PHY (how heavy his cap is).
 * - His OVR is those attributes weighted by position, the way FIFA weights
 *   Finishing for a striker and Tackling for a centre-back.
 * - He has a hidden Potential: the ceiling he grows towards. Young players
 *   grow fastest; players peak in their late twenties, decline in their
 *   thirties and retire.
 * - Form moves it all: good match ratings speed growth (and can raise
 *   potential), poor ones slow it.
 *
 * Pure functions over plain JSON.
 */
import { seededRng } from './tournament'
import { CAP_ROLES } from '../data/TeamOptions'

export const START_COINS = 800
export const SELL_SHARE = 0.6
// Transfer windows, like football's summer and January windows: each is open from
// the first to the last of these counts of your league matches played, then shuts
export const WINDOWS = [[0, 2], [5, 6]]
// When each window opens (matches played)
export const WINDOW_AFTER = WINDOWS.map((w) => w[0])

// A typical player's OVR in each division, bottom to top (FIFA-like: a lower-league side in the
// 50s, a top-flight side in the high 70s; stars in the 80s and 90s)
export const DIVISION_RATING = [52, 60, 68, 78]

export const ROLE_LABEL = { gk: 'GK', def1: 'DEF', def2: 'DEF', mid: 'MID', atk1: 'ATK', atk2: 'ATK' }
export const POS_OF = { gk: 'GK', def1: 'DEF', def2: 'DEF', mid: 'MID', atk1: 'ATK', atk2: 'ATK' }
export const ATTRS = ['pwr', 'sht', 'pas', 'phy']
export const ATTR_LABEL = { pwr: 'PWR', sht: 'SHT', pas: 'PAS', phy: 'PHY' }

/** How much each attribute counts towards OVR in each position (sums to 1). */
export const WEIGHTS = {
  ATK: { sht: 0.40, pwr: 0.35, pas: 0.15, phy: 0.10 },
  MID: { pas: 0.40, sht: 0.20, pwr: 0.20, phy: 0.20 },
  DEF: { phy: 0.40, pas: 0.25, pwr: 0.20, sht: 0.15 },
  GK: { phy: 0.45, pas: 0.25, pwr: 0.20, sht: 0.10 },
}

export const MIN_AGE = 15
export const RETIRE_FROM = 33

const clamp99 = (r) => Math.max(1, Math.min(99, Math.round(r)))
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length]
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

const FIRST = ['Sam', 'Alex', 'Jo', 'Kit', 'Ray', 'Max', 'Lou', 'Ben', 'Dev', 'Tom', 'Remi', 'Ade', 'Nico', 'Theo', 'Kofi', 'Luca', 'Ezra', 'Finn', 'Omar', 'Ravi', 'Tariq', 'Milo', 'Jude', 'Ike', 'Tunde', 'Emeka', 'Seun', 'Bayo',
  'Chidi', 'Femi', 'Kunle', 'Uche', 'Dayo', 'Segun', 'Obi', 'Nnamdi', 'Wale', 'Ayo', 'Musa', 'Sani', 'Yusuf', 'Kwame', 'Yaw', 'Mo', 'Ibra', 'Leo', 'Rafa', 'Marco', 'Diego', 'Hugo', 'Ola', 'Tobi', 'Gbenga', 'Chuka', 'Efe', 'Victor', 'Joel', 'Kayode']
const LAST = ['Fizzwell', 'Corker', 'Crimp', 'Tinley', 'Pops', 'Bottley', 'Spinner', 'Rimmer', 'Flickson', 'Capper', 'Sodaby', 'Twister', 'Glassby', 'Ringer', 'Clinks', 'Bubbles', 'Hopsworth', 'Seltzer', 'Fizzard', 'Crowne', 'Shaker', 'Pressley', 'Tapps', 'Brewer',
  'Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Nwosu', 'Okon', 'Bello', 'Danjuma', 'Afolabi', 'Mensah', 'Boateng', 'Fizzola', 'Capello', 'Corkoran', 'Tinsley', 'Flickett', 'Kapsule', 'Lidwell', 'Crownfield', 'Popoola', 'Sodiq', 'Bottomley', 'Gassama', 'Ekwueme', 'Ogun', 'Fasanya', 'Ironcap', 'Twistle', 'Spritzer', 'Cordell']

/* ── OVR ── */

/** OVR for these attributes in a position. */
export function ovrOf(attrs, pos) {
  const w = WEIGHTS[pos] || WEIGHTS.MID
  if (!isObj(attrs)) return 50
  return clamp99(ATTRS.reduce((a, k) => a + (attrs[k] ?? 50) * w[k], 0))
}

/** A player's OVR in a squad role (an attacker played at the back rates lower). */
export const ovrAt = (p, role) => ovrOf(p?.attrs, POS_OF[role])

/** The player with his OVR (in his own position) brought up to date. */
const withOvr = (p) => ({ ...p, rating: ovrOf(p.attrs, p.pos) })

/** Attributes for a player of `pos` around `ovr`: strong where his position needs it. */
function shapeAttrs(rng, ovr, pos, spread = 4) {
  const w = WEIGHTS[pos]
  // The attributes a position leans on sit above the OVR, the others below
  const raw = Object.fromEntries(ATTRS.map((k) => [k, ovr + (w[k] - 0.25) * 30 + (rng() * 2 - 1) * spread]))
  // Nudge so the weighted total lands on the OVR asked for
  const off = ovr - ATTRS.reduce((a, k) => a + raw[k] * w[k], 0)
  return Object.fromEntries(ATTRS.map((k) => [k, clamp99(raw[k] + off)]))
}

/** How much higher a player of this age might go (FIFA-style: the young have the most room). */
function potentialGap(rng, age) {
  if (age <= 19) return 8 + Math.floor(rng() * 14)
  if (age <= 22) return 4 + Math.floor(rng() * 10)
  if (age <= 25) return 1 + Math.floor(rng() * 6)
  if (age <= 28) return Math.floor(rng() * 3)
  return 0
}

/** A made-up player of position `pos` around OVR `base`, aged between ages[0] and ages[1]. */
export function makePlayer(rng, base, pos = 'MID', spread = 3, ages = [19, 31]) {
  const age = ages[0] + Math.floor(rng() * (ages[1] - ages[0] + 1))
  const ovr = clamp99(base + (rng() * 2 - 1) * spread)
  const attrs = shapeAttrs(rng, ovr, pos)
  const rating = ovrOf(attrs, pos)
  return {
    id: Math.floor(rng() * 1e9).toString(36),
    name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
    pos,
    keeper: pos === 'GK',
    age,
    attrs,
    rating,
    pot: Math.min(99, rating + potentialGap(rng, age)),
    youth: false,
    apps: 0, goals: 0, ratingSum: 0, form: [], xp: 0,
  }
}

/** A made-up name. */
export const randomName = (rng) => `${pick(rng, FIRST)} ${pick(rng, LAST)}`

/** A youth prospect: 17–18 (or `ages`), a few points below the division, with plenty of potential. */
export function makeYouth(rng, level, pos = 'MID', potBonus = 0, ages = [17, 18], below = 7) {
  const p = makePlayer(rng, (DIVISION_RATING[level] ?? 52) - below, pos, 3, ages)
  return { ...p, youth: true, pot: Math.min(99, p.rating + 12 + Math.floor(rng() * 12) + potBonus) }
}

/** What the scouts say about his potential: a range, not the exact figure (like Football Manager's stars). */
export function potentialRange(p) {
  if (!p) return null
  const lo = Math.max(p.rating, p.pot - 3)
  const hi = Math.min(99, p.pot + 2)
  return lo >= hi ? `${hi}` : `${lo}–${hi}`
}

/* ── On the pitch ── */

/** How hard a player flicks for his PWR: 0.88× at 45, 1.0× at 70, 1.12× at 95. */
export function powerScale(pwr) {
  if (!Number.isFinite(pwr)) return 1
  return 0.88 + ((Math.max(30, Math.min(99, pwr)) - 45) / 50) * 0.24
}

/** How far (degrees) a flick can stray for this accuracy: 4.5° at 45, 1.7° at 70, none from 95. */
export function accuracyWobble(acc) {
  if (!Number.isFinite(acc)) return 0
  const x = Math.max(0, (95 - Math.max(30, Math.min(99, acc))) / 50)
  return Math.round(4.5 * Math.pow(x, 1.4) * 100) / 100
}

/** How heavy his cap is for his PHY: 0.9× at 45, 1.0× at 70, 1.1× at 95 (harder to knock off the ball). */
export function massScale(phy) {
  if (!Number.isFinite(phy)) return 1
  return 0.9 + ((Math.max(30, Math.min(99, phy)) - 45) / 50) * 0.2
}

/** A flick's possible stray: PAS for a soft pass, SHT for a hard shot, in between for in between. */
export function flickWobble(attrs, power = 1) {
  if (!isObj(attrs)) return 0
  const t = Math.max(0, Math.min(1, power))
  return accuracyWobble(attrs.pas) * (1 - t) + accuracyWobble(attrs.sht) * t
}

/** Older one-number ratings (no attributes): power from the overall. */
export function flickScale(rating) {
  if (!Number.isFinite(rating)) return 1
  return powerScale(rating)
}

/** Older one-number ratings: aim from the overall. */
export function aimWobble(rating) {
  return accuracyWobble(rating)
}

/* ── Value ── */

/**
 * Transfer fee, rising steeply with OVR like real market values; young
 * players with room to grow cost more, veterans less.
 */
export function priceOf(p) {
  const player = typeof p === 'number' ? { rating: p, age: 26, pot: p } : p
  const ovr = player?.rating ?? 50
  const age = player?.age ?? 26
  const room = Math.max(0, (player?.pot ?? ovr) - ovr)
  const ageF = age <= 21 ? 1.25 : age <= 25 ? 1.1 : age <= 29 ? 1 : age <= 31 ? 0.75 : 0.5
  const fee = 30 * Math.pow(1.115, ovr - 50) * ageF * (1 + room * 0.025)
  return Math.max(20, Math.round(fee / 5) * 5)
}

/** What you get back when you let a player go. */
export function sellValue(p) {
  return Math.round(priceOf(p) * SELL_SHARE)
}

/* ── Squads ── */

/** Your first squad: about a mid-table Sunday League side, one young prospect among them. */
export function startingSquad(seed = 'start') {
  const rng = seededRng(`squad:${seed}`)
  return Object.fromEntries(CAP_ROLES.map((role) => {
    const p = role === 'mid' ? makeYouth(rng, 0, 'MID') : makePlayer(rng, DIVISION_RATING[0] + 2, POS_OF[role], 2, [20, 30])
    return [role, p]
  }))
}

/* ── The bench ── */

// Ten caps a club: six on the pitch and four on the bench, one of each position
export const BENCH_POS = ['GK', 'DEF', 'MID', 'ATK']
export const BENCH_SIZE = 4
export const MAX_SUBS = 3
// A squad role to read a position by (for migrating and replacing bench players)
const ROLE_FOR_POS = { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }

/** Your first bench: a backup for each position, a little below the starters. */
export function startingBench(seed = 'bench', level = 0) {
  const rng = seededRng(`bench:${seed}`)
  return BENCH_POS.map((pos) => makePlayer(rng, (DIVISION_RATING[level] ?? 52) - 6, pos, 2, [18, 31]))
}

/** OVR by cap role, as shown and as a match uses them. */
export function squadRatings(squad) {
  if (!squad) return null
  return Object.fromEntries(CAP_ROLES.map((role) => [role, squad[role] ? ovrAt(migratePlayer(squad[role], role), role) : 50]))
}

/** Attributes by cap role, for the match. */
export function squadAttrs(squad) {
  if (!squad) return null
  return Object.fromEntries(CAP_ROLES.map((role) => [role, migratePlayer(squad[role], role)?.attrs || null]))
}

/** Surnames by cap role, for printing on the caps. */
export function squadSurnames(squad) {
  if (!squad) return null
  return Object.fromEntries(CAP_ROLES.map((role) => [role, String(squad[role]?.name || '').trim().split(/\s+/).pop().slice(0, 12)]))
}

/** A computer club's players (attributes and OVR), the same every time for that club in that division. */
export function clubPlayers(level, clubName) {
  const rng = seededRng(`club:${level}:${clubName}`)
  const base = DIVISION_RATING[level] ?? 60
  return Object.fromEntries(CAP_ROLES.map((role) => [role, makePlayer(rng, base, POS_OF[role], 4)]))
}

/** A computer club's OVR by role. */
export function clubRatings(level, clubName) {
  return squadRatings(clubPlayers(level, clubName))
}

/** A computer club's attributes by role. */
export function clubAttrs(level, clubName) {
  return squadAttrs(clubPlayers(level, clubName))
}

/** A matchup in a word, from the two sides' OVR. */
export function matchupOf(mine, theirs) {
  const d = mine - theirs
  return d >= 3 ? 'favourite' : d <= -3 ? 'underdog' : 'even'
}

export function averageRating(ratings) {
  if (!ratings) return 0
  const v = Object.values(ratings)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0
}

/* ── Money ── */

// Club money is kept in units; on screen it's naira at a football-like scale
export const NAIRA_PER_UNIT = 10_000

/** Club money as naira, short: ₦600k, ₦1.5m, ₦2.1bn. */
export function money(units) {
  const n = Math.round((Number(units) || 0) * NAIRA_PER_UNIT)
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  const short = (v, s) => `${(Math.round(v * 10) / 10).toLocaleString('en-NG')}${s}`
  if (a >= 1e9) return `${sign}₦${short(a / 1e9, 'bn')}`
  if (a >= 1e6) return `${sign}₦${short(a / 1e6, 'm')}`
  if (a >= 1e3) return `${sign}₦${short(a / 1e3, 'k')}`
  return `${sign}₦${a}`
}

/** Coins for one of your results; bigger divisions pay more. */
export function coinsForResult(gf, ga, level = 0) {
  const base = gf > ga ? 60 : gf === ga ? 25 : 10
  return Math.round((base + 5 * Math.max(0, gf)) * (1 + 0.5 * (level || 0)))
}

/** Coins at the end of a season. */
export function seasonBonus(outcome) {
  return { champions: 600, promoted: 250, stayed: 80, relegated: 40 }[outcome] ?? 0
}

/** Which transfer window is open: 0 (pre-season), 1 (mid-season) or -1 (shut). */
export function openWindow(played) {
  return WINDOWS.findIndex(([from, to]) => played >= from && played <= to)
}

/** The league matchday a window shuts at (it's open until you play this one). */
export const windowDeadline = (index) => (WINDOWS[index]?.[1] ?? 0) + 1

/* ── Growth ── */

/** Move a player's OVR by `steps` (±), putting the change into the attributes his position needs most. */
export function shiftOvr(p, steps, rng = Math.random, declining = false) {
  if (!steps) return p
  const w = WEIGHTS[p.pos] || WEIGHTS.MID
  // Growth goes where the position needs it; old age takes physique and power first
  const order = declining ? ['phy', 'pwr', 'sht', 'pas'] : [...ATTRS].sort((a, b) => w[b] - w[a])
  const attrs = { ...p.attrs }
  const target = clamp99(ovrOf(attrs, p.pos) + steps)
  for (let i = 0; i < 60 && ovrOf(attrs, p.pos) !== target; i++) {
    const k = rng() < 0.7 ? order[i % 2] : order[2 + (i % 2)]
    attrs[k] = clamp99(attrs[k] + Math.sign(steps))
  }
  return withOvr({ ...p, attrs })
}

/** How a player's age moves his OVR over a summer (FIFA-like: quick growth young, peak 27–30, decline after). */
export function ageGrowth(age) {
  if (age <= 20) return 4
  if (age <= 23) return 3
  if (age <= 26) return 2
  if (age <= 28) return 1
  if (age <= 30) return 0
  if (age <= 32) return -2
  return -3
}

/**
 * A season's development. Each player grows (towards his potential, never
 * past it) or declines, by age and by his season's average match rating.
 * A great season can raise his potential, a poor one lower it. Everyone gets
 * a year older; veterans may retire, and a youth prospect takes their place.
 * Returns { squad, retired: [{ role, name, age, rating }], changes: [{ role, name, from, to }] }.
 */
export function developSeason(squad, seed, level = 0) {
  const rng = seededRng(`develop:${seed}`)
  const retired = []
  const changes = []
  const next = {}
  for (const [role, p0] of Object.entries(squad)) {
    const p = migratePlayer(p0, ROLE_FOR_POS[p0?.pos] && !POS_OF[role] ? ROLE_FOR_POS[p0.pos] : role)
    const age = p.age
    if (age >= RETIRE_FROM && (age >= 37 || rng() < (age - RETIRE_FROM + 1) * 0.2)) {
      retired.push({ role, name: p.name, age, rating: p.rating })
      next[role] = makeYouth(rng, level, POS_OF[role] || p.pos)
      continue
    }
    const avg = p.apps ? p.ratingSum / p.apps : null
    // Like EA FC: a player who never gets a game slides a little
    const form = avg == null ? -1 : avg >= 7.5 ? 2 : avg >= 7 ? 1 : avg >= 6.3 ? 0 : -1
    let pot = p.pot
    // Dynamic potential: a great season lifts the ceiling of a young player; a poor one lowers it
    if (avg != null && avg >= 7.5 && age <= 26) pot = Math.min(99, pot + 1 + Math.floor(rng() * 2))
    if (avg != null && avg < 6 && age <= 28) pot = Math.max(p.rating, pot - 1 - Math.floor(rng() * 2))
    let change = ageGrowth(age) + form + Math.floor(rng() * 3) - 1
    // Growth stops at the ceiling; decline doesn't care
    if (change > 0) change = Math.max(0, Math.min(change, pot - p.rating))
    const grown = shiftOvr({ ...p, pot }, change, rng, change < 0)
    if (grown.rating !== p.rating) changes.push({ role, name: p.name, from: p.rating, to: grown.rating })
    next[role] = { ...grown, age: age + 1, youth: age + 1 <= 19 && !!p.youth, apps: 0, goals: 0, ratingSum: 0, form: [], xp: 0 }
  }
  return { squad: next, retired, changes }
}

/** The squad part of developSeason. */
export function developSquad(squad, seed, level = 0) {
  return developSeason(squad, seed, level).squad
}

/* ── Match ratings ── */

const round1 = (n) => Math.round(n * 10) / 10

/**
 * Out-of-10 ratings for one side's six players after a match, the way FIFA
 * and Football Manager do it: everyone starts on 6, goals count most, then
 * shots, saves, blocks and clean sheets, and the result.
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
 * One match for the career squad: appearances, goals and form, plus match
 * experience. Like FIFA's in-season growth, good games build experience and a
 * player under his potential steps up a point when he has enough (young
 * players need less); a run of poor games can cost a point.
 * Returns { squad, changes, motm, ratings }.
 */
export function applyMatchToSquad(squad, { ratings, goalsByRole = {}, seed }) {
  const rng = seededRng(`grow:${seed}`)
  const changes = []
  const next = {}
  for (const role of CAP_ROLES) {
    let p = migratePlayer(squad[role], role)
    const r = ratings[role] ?? 6
    const before = p.rating
    let xp = (p.xp || 0) + (r - 6.3)
    const need = p.age <= 21 ? 2 : p.age <= 25 ? 3 : 4.5
    if (xp >= need && p.rating < p.pot && p.age <= 30) { p = shiftOvr(p, 1, rng); xp = 0 }
    else if (xp <= -3) { p = shiftOvr(p, -1, rng); xp = 0 }
    if (p.rating !== before) changes.push({ role, name: p.name, from: before, to: p.rating })
    next[role] = {
      ...p,
      xp: round1(Math.max(-3, Math.min(need, xp))),
      apps: (p.apps || 0) + 1,
      goals: (p.goals || 0) + (goalsByRole[role] || 0),
      ratingSum: round1((p.ratingSum || 0) + r),
      form: [...(p.form || []), r].slice(-5),
    }
  }
  return { squad: next, changes, motm: manOfTheMatch(ratings, goalsByRole), ratings }
}

/**
 * One match for a whole club (starters and bench), by player: everyone who
 * played gets his rating, goals, an appearance and experience; those who
 * didn't are left alone. byPlayer: { [id]: { rating, goals } }.
 * Returns { squad, bench, changes }.
 */
export function applyMatchByPlayer(squad, bench, byPlayer, seed, xpMult = 1) {
  const rng = seededRng(`grow:${seed}`)
  const changes = []
  const one = (p0, key) => {
    const perf = byPlayer?.[p0?.id]
    if (!perf) return p0
    let p = migratePlayer(p0, POS_OF[key] ? key : ROLE_FOR_POS[p0.pos])
    const r = perf.rating ?? 6
    const before = p.rating
    // A better training ground turns good games into growth faster
    let xp = (p.xp || 0) + (r - 6.3) * (r > 6.3 ? xpMult : 1)
    const need = p.age <= 21 ? 2 : p.age <= 25 ? 3 : 4.5
    if (xp >= need && p.rating < p.pot && p.age <= 30) { p = shiftOvr(p, 1, rng); xp = 0 }
    else if (xp <= -3) { p = shiftOvr(p, -1, rng); xp = 0 }
    if (p.rating !== before) changes.push({ id: p.id, name: p.name, from: before, to: p.rating })
    return {
      ...p,
      xp: round1(Math.max(-3, Math.min(need, xp))),
      apps: (p.apps || 0) + 1,
      goals: (p.goals || 0) + (perf.goals || 0),
      ratingSum: round1((p.ratingSum || 0) + r),
      form: [...(p.form || []), r].slice(-5),
    }
  }
  return {
    squad: Object.fromEntries(Object.entries(squad).map(([role, p]) => [role, one(p, role)])),
    bench: (bench || []).map((p) => one(p, null)),
    changes,
  }
}

/** Average of the last few match ratings, or null before any. */
export const formOf = (p) => (p?.form?.length ? round1(p.form.reduce((a, b) => a + b, 0) / p.form.length) : null)

/**
 * Swap a bench player into the starting six. Keepers only for keepers;
 * outfield players can start anywhere outfield. Returns { squad, bench } or null.
 */
export function swapIn(squad, bench, benchIndex, role) {
  const incoming = bench?.[benchIndex]
  const outgoing = squad?.[role]
  if (!incoming || !outgoing) return null
  if ((role === 'gk') !== (incoming.pos === 'GK')) return null
  return { squad: { ...squad, [role]: incoming }, bench: bench.map((p, i) => (i === benchIndex ? outgoing : p)) }
}

/* ── Saves ── */

/**
 * Bring a player from an older save up to date: a one-number rating becomes
 * attributes and potential on the new scale (a Sunday-league 40 ≈ 52 now).
 */
export function migratePlayer(p, role) {
  if (!isObj(p)) return p
  if (isObj(p.attrs) && p.pos) return p
  const rng = seededRng(`migrate:${p.id || role}`)
  const pos = POS_OF[role] || p.pos || 'MID'
  const old = Number.isFinite(p.rating) ? p.rating : 40
  const ovr = clamp99(52 + (old - 40) * 0.72)
  const age = Number.isInteger(p.age) ? p.age : 20 + Math.floor(rng() * 10)
  const attrs = shapeAttrs(rng, ovr, pos, 2)
  const rating = ovrOf(attrs, pos)
  return { ...p, pos, keeper: pos === 'GK', age, attrs, rating, pot: Math.min(99, rating + potentialGap(rng, age)), xp: 0 }
}

/** Clean up one saved player (or null if he isn't one). `role` decides his position if he has none. */
export function sanitizePlayer(raw, role) {
    if (!isObj(raw) || typeof raw.name !== 'string' || (!Number.isFinite(raw.rating) && !isObj(raw.attrs))) return null
    const p = migratePlayer(raw, role)
    const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0)
    const attrs = Object.fromEntries(ATTRS.map((k) => [k, clamp99(Number.isFinite(p.attrs?.[k]) ? p.attrs[k] : 50)]))
    const pos = ['GK', 'DEF', 'MID', 'ATK'].includes(p.pos) ? p.pos : POS_OF[role]
    const rating = ovrOf(attrs, pos)
    return {
      id: String(p.id || role).slice(0, 16),
      name: p.name.slice(0, 24),
      pos,
      keeper: pos === 'GK',
      age: Number.isInteger(p.age) && p.age >= MIN_AGE && p.age <= 45 ? p.age : 25,
      attrs,
      rating,
      pot: Math.max(rating, Math.min(99, Number.isFinite(p.pot) ? Math.round(p.pot) : rating)),
      youth: p.youth === true,
      apps: Math.floor(n(p.apps)), goals: Math.floor(n(p.goals)), ratingSum: n(p.ratingSum),
      form: Array.isArray(p.form) ? p.form.filter((x) => Number.isFinite(x) && x >= 0 && x <= 10).slice(-5) : [],
      xp: Number.isFinite(p.xp) ? Math.max(-3, Math.min(5, p.xp)) : 0,
      ...(Number.isFinite(p.wageX) && p.wageX > 1 ? { wageX: Math.min(10, Math.round(p.wageX * 10) / 10) } : {}),
    }
}

/** Clean up a saved squad; fills any gap with a fresh player. */
export function sanitizeSquad(input, seed = 'fix') {
  const fresh = startingSquad(seed)
  if (!isObj(input)) return fresh
  return Object.fromEntries(CAP_ROLES.map((role) => [role, sanitizePlayer(input[role], role) || fresh[role]]))
}

/** Clean up a saved bench (four players); careers from before the bench get one. */
export function sanitizeBench(input, seed = 'fix', level = 0) {
  const fresh = startingBench(seed, level)
  if (!Array.isArray(input)) return fresh
  return BENCH_POS.map((pos, i) => {
    const raw = input[i]
    const role = ROLE_FOR_POS[raw?.pos] || ROLE_FOR_POS[pos]
    return sanitizePlayer(raw, role) || fresh[i]
  })
}
