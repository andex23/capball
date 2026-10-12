/**
 * The career's football world: every computer club in every division has a
 * real squad, like a club in Football Manager or EA FC career mode.
 *
 * - Clubs differ within a division: title favourites with stars, contenders,
 *   mid-table sides, strugglers. A club's strength is its division's level
 *   plus its tier.
 * - A squad of about twelve: one or two stars, a first team, squad players
 *   and a couple of youngsters with potential. Its best six play.
 * - The world moves each summer: players age, grow, decline and retire;
 *   academies bring youngsters through; clubs buy from each other, list
 *   surplus players and release some to the free-agent pool.
 * - Every one of those players can be found and bid for in the transfer
 *   market.
 *
 * Players are kept compact here ({ id, name, pos, age, attrs, pot, listed })
 * and filled out (`hydrate`) when used. Pure functions over plain JSON.
 */
import { DIVISIONS } from './divisions'
import { seededRng } from './tournament'
import {
  DIVISION_RATING, ATTRS, POS_OF, makePlayer, ovrOf, ovrAt, priceOf, ageGrowth, shiftOvr,
  RETIRE_FROM, squadRatings, averageRating, randomName,
} from './squad'
import { CAP_ROLES } from '../data/TeamOptions'

/** Each division's clubs, best to worst, sit this far above or below its usual level. */
export const TIER_OFFSET = [6, 3, 0, -2, -5]
export const TIER_LABEL = ['Title favourites', 'Contenders', 'Mid-table', 'Battling', 'Strugglers']
export const AI_SQUAD = 12
const AI_MIN = 10
const AI_MAX = 13
const FREE_MAX = 30
// Every club keeps at least this many in each position
const NEED = { GK: 2, DEF: 3, MID: 2, ATK: 2 }

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5)

/* ── Players ── */

/** A compact player for the world. */
export function compact(p) {
  return { id: String(p.id), name: p.name, pos: p.pos, age: p.age, attrs: { ...p.attrs }, pot: p.pot, ...(p.listed ? { listed: true } : {}) }
}

/** A world player filled out with his OVR (in his position). */
export function hydrate(p) {
  if (!p) return null
  const rating = ovrOf(p.attrs, p.pos)
  return { ...p, keeper: p.pos === 'GK', rating, pot: Math.max(rating, p.pot ?? rating), youth: p.age <= 19 }
}

const ratingOf = (p) => ovrOf(p.attrs, p.pos)

/* ── Clubs ── */

/** A club's target strength (the OVR its first team is built around). */
export const strengthOf = (club) => (DIVISION_RATING[club.level] ?? 60) + (TIER_OFFSET[club.tier] ?? 0)

/** Roughly what a club can spend on one player. */
export const budgetOf = (club) => priceOf({ rating: strengthOf(club) + 2, age: 26 }) * 3

/** The best six for a squad: a keeper, two defenders, a midfielder and two attackers, each the best fit. */
export function bestSix(players) {
  const pool = (players || []).map(hydrate)
  const used = new Set()
  const six = {}
  for (const role of ['gk', 'atk1', 'mid', 'def1', 'atk2', 'def2']) {
    const keeper = role === 'gk'
    const score = (p) => ovrAt(p, role) + (p.pos === POS_OF[role] ? 3 : 0)
    const best = pool.filter((p) => !used.has(p.id) && (p.pos === 'GK') === keeper).sort((a, b) => score(b) - score(a))[0]
    if (best) { six[role] = best; used.add(best.id) }
  }
  return Object.fromEntries(CAP_ROLES.filter((r) => six[r]).map((r) => [r, six[r]]))
}

/** A club's OVR: its best six. */
export const clubOvr = (club) => averageRating(squadRatings(bestSix(club.players)))

/** A player's standing at his club: 'star' | 'key' | 'squad' | 'prospect' | 'listed'. */
export function standingOf(p, club) {
  if (!club) return 'free'
  if (p.listed) return 'listed'
  const r = ratingOf(p)
  if (r >= Math.max(...club.players.map(ratingOf))) return 'star'
  if (Object.values(bestSix(club.players)).some((x) => x.id === p.id)) return 'key'
  if (p.age <= 19 && (p.pot ?? r) - r >= 10) return 'prospect'
  return 'squad'
}
export const STANDING_LABEL = { star: 'Star player', key: 'First team', squad: 'Squad player', prospect: 'Youth prospect', listed: 'Transfer listed', free: 'Free agent' }

/* ── Building the world ── */

// A club's squad: [position, band]; the best of the first team become stars
const TEMPLATE = [
  ['GK', 'first'], ['GK', 'squad'],
  ['DEF', 'first'], ['DEF', 'first'], ['DEF', 'squad'],
  ['MID', 'first'], ['MID', 'squad'],
  ['ATK', 'star'], ['ATK', 'first'], ['ATK', 'squad'],
  [null, 'youth'], [null, 'youth'],
]
const BAND = {
  star: { lift: [6, 10], ages: [24, 30] },
  first: { lift: [0, 4], ages: [21, 31] },
  squad: { lift: [-6, -2], ages: [19, 33] },
}

function newPlayer(world, rng, pos, strength, band) {
  const id = `w${world.nextId++}`
  if (band === 'youth') {
    // Well below the club's first team, with lots of room to grow
    const base = makePlayer(rng, strength - 8 - Math.floor(rng() * 5), pos, 1, [17, 18])
    return compact({ ...base, id, name: randomName(rng), pot: Math.min(99, base.rating + 4 + Math.floor(rng() * 12)) })
  }
  const b = BAND[band]
  const lift = b.lift[0] + rng() * (b.lift[1] - b.lift[0])
  const p = makePlayer(rng, strength + lift, pos, 1, b.ages)
  return compact({ ...p, id, name: randomName(rng) })
}

/** A brand-new world for a career. */
export function createWorld(seed = 'world') {
  const rng = seededRng(`world:${seed}`)
  const world = { nextId: 1, clubs: [], free: [], news: [] }
  DIVISIONS.forEach((div, level) => {
    div.clubs.forEach((c, tier) => {
      const club = { id: `c${level}${tier}`, name: c.name, level, tier, players: [] }
      const s = strengthOf(club)
      const outfield = ['DEF', 'MID', 'ATK']
      for (const [pos0, band0] of TEMPLATE) {
        const pos = pos0 || outfield[Math.floor(rng() * 3)]
        club.players.push(newPlayer(world, rng, pos, s, band0))
      }
      // The big clubs have a second star, in midfield
      if (tier <= 1) {
        const i = club.players.findIndex((p) => p.pos === 'MID')
        club.players[i] = newPlayer(world, rng, 'MID', s, 'star')
      }
      world.clubs.push(club)
    })
  })
  // Free agents: out-of-contract players of every level, mostly older
  for (let i = 0; i < 20; i++) world.free.push(freeAgent(world, rng))
  return world
}

function freeAgent(world, rng) {
  const level = Math.floor(rng() * DIVISIONS.length)
  const pos = ['GK', 'DEF', 'MID', 'ATK'][Math.floor(rng() * 4)]
  const p = makePlayer(rng, (DIVISION_RATING[level] ?? 60) - 4 + rng() * 6, pos, 2, [24, 33])
  return compact({ ...p, id: `w${world.nextId++}`, name: randomName(rng) })
}

/* ── Finding things ── */

export const clubByName = (world, name) => world?.clubs.find((c) => c.name === name) || null
export const clubById = (world, id) => world?.clubs.find((c) => c.id === id) || null

/** Where a player is: { player, club } (club null for a free agent), or null. */
export function locate(world, id) {
  for (const club of world?.clubs || []) {
    const player = club.players.find((p) => p.id === id)
    if (player) return { player, club }
  }
  const player = world?.free.find((p) => p.id === id)
  return player ? { player, club: null } : null
}

/** A computer club's best six (filled-out players by role), by name; null if it isn't in the world. */
export function sixFor(world, name) {
  const club = clubByName(world, name)
  return club ? bestSix(club.players) : null
}

/* ── Prices and bids ── */

/** What the selling club wants for him (a free agent: his signing-on fee). */
export function askingPrice(p, club) {
  const value = priceOf(hydrate(p))
  if (!club) return round5(value * 0.15)
  const f = { star: 1.6, key: 1.3, prospect: 1.25, squad: 1, listed: 0.75 }[standingOf(p, club)] ?? 1
  return round5(value * f)
}

/**
 * Will he come? A player won't drop two divisions, and a first-teamer at a
 * higher-division club won't drop one. Free agents will always talk.
 */
export function willingness(p, club, myLevel) {
  if (!club) return { ok: true }
  const gap = club.level - myLevel
  const name = DIVISIONS[myLevel]?.name || 'your division'
  if (gap >= 2) return { ok: false, why: `Won’t drop down to the ${name}.` }
  if (gap === 1 && ['star', 'key'].includes(standingOf(p, club))) return { ok: false, why: `A first-teamer in the ${DIVISIONS[club.level].name}; he won’t drop down.` }
  return { ok: true }
}

export const MAX_BIDS = 3

/**
 * The club's answer to a bid: 'accept', 'counter' (with the fee they'd take)
 * or 'reject'. Each club has its own bottom line (85–100% of the asking
 * price), the same however often you ask. After MAX_BIDS tries they stop
 * talking until the next window.
 */
export function bidVerdict(p, club, bid, tries, seed) {
  const asking = askingPrice(p, club)
  if (!club) return bid >= asking ? { verdict: 'accept', fee: bid } : { verdict: 'reject', why: 'He wants his full signing-on fee.' }
  const rng = seededRng(`bid:${seed}:${p.id}`)
  const min = Math.round(asking * (0.85 + rng() * 0.15))
  if (bid >= min) return { verdict: 'accept', fee: bid }
  if (tries + 1 >= MAX_BIDS) return { verdict: 'reject', why: `${club.name} have ended talks for this window.`, ended: true }
  if (bid >= asking * 0.7) return { verdict: 'counter', fee: asking }
  return { verdict: 'reject', why: `${club.name} say that’s nowhere near enough.` }
}

/* ── Moving players ── */

/** Take a player out of the world. Returns { world, player, club } or null. */
export function takePlayer(world, id) {
  const where = locate(world, id)
  if (!where) return null
  const { club } = where
  const next = club
    ? { ...world, clubs: world.clubs.map((c) => (c.id === club.id ? { ...c, players: c.players.filter((p) => p.id !== id) } : c)) }
    : { ...world, free: world.free.filter((p) => p.id !== id) }
  return { world: next, player: where.player, club }
}

/** Put a player into a club (or the free agents, clubId null). */
export function putPlayer(world, clubId, p) {
  const c = compact({ ...p, listed: false })
  if (!clubId) return { ...world, free: [c, ...world.free].slice(0, FREE_MAX) }
  return { ...world, clubs: world.clubs.map((x) => (x.id === clubId ? { ...x, players: [...x.players, c] } : x)) }
}

/** Keep a club between AI_MIN and AI_MAX players with every position covered. */
export function settleClub(world, clubId, rng) {
  let w = world
  const club = () => clubById(w, clubId)
  const count = (pos) => club().players.filter((p) => p.pos === pos).length
  // Too many: let the weakest older surplus go to the free agents
  while (club().players.length > AI_MAX) {
    const six = new Set(Object.values(bestSix(club().players)).map((p) => p.id))
    const out = club().players.filter((p) => !six.has(p.id) && count(p.pos) > NEED[p.pos]).sort((a, b) => (ratingOf(a) - a.age * 0.3) - (ratingOf(b) - b.age * 0.3))[0]
    if (!out) break
    w = putPlayer(takePlayer(w, out.id).world, null, out)
  }
  // Gaps: sign the best free agent who fits, else bring a youngster up
  for (let guard = 0; guard < 8; guard++) {
    const short = Object.keys(NEED).find((pos) => count(pos) < NEED[pos]) || (club().players.length < AI_MIN ? ['DEF', 'MID', 'ATK'][Math.floor(rng() * 3)] : null)
    if (!short) break
    const s = strengthOf(club())
    const fa = w.free.filter((p) => p.pos === short && ratingOf(p) <= s + 2).sort((a, b) => ratingOf(b) - ratingOf(a))[0]
    if (fa && ratingOf(fa) >= s - 8) {
      w = putPlayer(takePlayer(w, fa.id).world, clubId, fa)
    } else {
      w = { ...w }
      const kid = newPlayer(w, rng, short, s, 'youth')
      w = putPlayer(w, clubId, kid)
    }
  }
  return w
}

/* ── Buying from you ── */

/**
 * Clubs that would buy your player: ones where he'd make the first team (or
 * close) and who can afford him. Up to three offers, best first, the same for
 * the whole window.
 */
export function buyersFor(world, p, seed) {
  const hp = hydrate(p)
  const value = priceOf(hp)
  const rng = seededRng(`offers:${seed}:${p.id}`)
  const keeper = hp.pos === 'GK'
  const fits = world.clubs.filter((c) => {
    if (c.players.length >= AI_MAX) return false
    const six = bestSix(c.players)
    const same = CAP_ROLES.filter((r) => (r === 'gk') === keeper && six[r]).map((r) => ovrAt(six[r], r))
    const weakest = same.length ? Math.min(...same) : 0
    return hp.rating >= weakest - 2 && budgetOf(c) >= value * 0.7
  })
  const shuffled = fits.map((c) => ({ c, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.c)
  return shuffled.slice(0, 3)
    .map((c) => ({ clubId: c.id, club: c.name, level: c.level, fee: round5(Math.min(budgetOf(c), value * (0.75 + rng() * 0.4))) }))
    .sort((a, b) => b.fee - a.fee)
}

/** A club to take him on loan: one where he'd start, no higher than your division, the best such. */
export function loanClubFor(world, p, myLevel) {
  const hp = hydrate(p)
  const keeper = hp.pos === 'GK'
  return world.clubs
    .filter((c) => c.level <= myLevel && c.players.length < AI_MAX + 1)
    .filter((c) => {
      const six = bestSix(c.players)
      const same = CAP_ROLES.filter((r) => (r === 'gk') === keeper && six[r]).map((r) => ovrAt(six[r], r))
      return same.length && hp.rating >= Math.min(...same) - 5
    })
    .sort((a, b) => (b.level - a.level) || (clubOvr(b) - clubOvr(a)))[0] || null
}

/* ── The market ── */

/**
 * Search everyone in the world (and the free agents). `filters`: { pos,
 * minOvr, maxOvr, maxAge, level ('free' for free agents only), listed (only
 * listed and free), name, maxPrice, sort ('ovr'|'price'|'age'|'pot') }.
 * Returns [{ player (filled out), club, asking, standing, willing }].
 */
export function searchMarket(world, filters = {}, myLevel = 0) {
  const all = [
    ...world.clubs.flatMap((club) => club.players.map((p) => ({ p, club }))),
    ...world.free.map((p) => ({ p, club: null })),
  ]
  const q = String(filters.name || '').trim().toLowerCase()
  const rows = []
  for (const { p, club } of all) {
    const player = hydrate(p)
    if (filters.pos && filters.pos !== 'ALL' && player.pos !== filters.pos) continue
    if (filters.minOvr && player.rating < filters.minOvr) continue
    if (filters.maxOvr && player.rating > filters.maxOvr) continue
    if (filters.maxAge && player.age > filters.maxAge) continue
    if (filters.level === 'free' && club) continue
    if (Number.isInteger(filters.level) && club?.level !== filters.level) continue
    if (filters.listed && club && !p.listed) continue
    if (q && !player.name.toLowerCase().includes(q) && !(club?.name || '').toLowerCase().includes(q)) continue
    const asking = askingPrice(p, club)
    if (filters.maxPrice && asking > filters.maxPrice) continue
    rows.push({ player, club, asking, standing: standingOf(p, club), willing: willingness(p, club, myLevel) })
  }
  const by = {
    ovr: (a, b) => b.player.rating - a.player.rating,
    price: (a, b) => a.asking - b.asking,
    age: (a, b) => a.player.age - b.player.age,
    pot: (a, b) => b.player.pot - a.player.pot,
  }[filters.sort || 'ovr']
  return rows.sort((a, b) => by(a, b) || b.player.rating - a.player.rating)
}

/* ── The summer ── */

/** One computer player's summer: older, better or worse, maybe retired (null). */
function developAi(p, rng, starter) {
  const r = ratingOf(p)
  if (p.age >= RETIRE_FROM && (p.age >= 37 || rng() < (p.age - RETIRE_FROM + 1) * 0.22)) return null
  let pot = p.pot ?? r
  // A regular's potential can creep up; a forgotten one's down
  if (p.age <= 24) pot = Math.min(99, Math.max(r, pot + (starter ? Math.floor(rng() * 3) : -Math.floor(rng() * 2))))
  let change = ageGrowth(p.age) + Math.floor(rng() * 3) - 1
  if (change > 0) change = Math.max(0, Math.min(change, pot - r, r >= 85 ? 1 : 9))
  const grown = shiftOvr(hydrate({ ...p, pot }), change, rng, change < 0)
  return compact({ ...grown, age: p.age + 1, pot, listed: false })
}

/**
 * The world's summer: development and retirements, an academy graduate for
 * every club, clubs buying from each other to strengthen, surplus players
 * listed, squads settled, and the free agents refreshed. Returns
 * { world, news: [{ type, ... }] } (transfers first, biggest fees first).
 */
export function worldSummer(world, seed) {
  const rng = seededRng(`summer:${seed}`)
  let w = { ...world, clubs: world.clubs.map((c) => ({ ...c, players: [...c.players] })), free: [...world.free] }
  const news = []

  // 1. Everyone a year older
  w.clubs = w.clubs.map((c) => {
    const six = new Set(Object.values(bestSix(c.players)).map((p) => p.id))
    const players = []
    for (const p of c.players) {
      const next = developAi(p, rng, six.has(p.id))
      if (next) players.push(next)
      else if (ratingOf(p) >= strengthOf(c) + 4) news.push({ type: 'retired', name: p.name, club: c.name, age: p.age })
    }
    return { ...c, players }
  })
  w.free = w.free.map((p) => developAi(p, rng, false)).filter((p) => p && p.age <= 34)

  // 2. An academy graduate for every club
  for (const c of w.clubs) {
    const kid = newPlayer(w, rng, ['DEF', 'MID', 'ATK', 'GK'][Math.floor(rng() * 4)], strengthOf(c), 'youth')
    c.players.push(kid)
  }

  // 3. Clubs strengthen: the biggest clubs shop first, buying from weaker clubs and the free agents
  const order = [...w.clubs].sort((a, b) => strengthOf(b) - strengthOf(a)).map((c) => c.id)
  for (const id of order) {
    if (rng() < 0.35) continue // not every club does business every summer
    const club = clubById(w, id)
    const s = strengthOf(club)
    const six = bestSix(club.players)
    const weak = CAP_ROLES.filter((r) => six[r]).map((r) => ({ role: r, ovr: ovrAt(six[r], r) })).sort((a, b) => a.ovr - b.ovr)[0]
    if (!weak || weak.ovr >= s + 1) continue
    const keeper = weak.role === 'gk'
    const budget = budgetOf(club)
    const sellers = w.clubs.filter((c) => c.id !== id && strengthOf(c) < s && c.players.length > AI_MIN)
    const pool = [
      ...sellers.flatMap((c) => c.players.map((p) => ({ p, from: c }))),
      ...w.free.map((p) => ({ p, from: null })),
    ].filter(({ p }) => (p.pos === 'GK') === keeper && p.age <= 31)
      .map((x) => ({ ...x, at: ovrAt(hydrate(x.p), weak.role), fee: x.from ? askingPrice(x.p, x.from) : 0 }))
      .filter((x) => x.at >= weak.ovr + 2 && x.at <= s + 8 && x.fee <= budget)
      .sort((a, b) => b.at - a.at)
    const buy = pool[0]
    if (!buy) continue
    w = takePlayer(w, buy.p.id).world
    w = putPlayer(w, id, buy.p)
    news.push({ type: 'transfer', name: buy.p.name, ovr: ratingOf(buy.p), from: buy.from?.name || null, to: club.name, fee: buy.fee, level: club.level })
    if (buy.from) w = settleClub(w, buy.from.id, rng)
  }

  // 4. Settle every squad, then list the surplus: older players out of the side and the weakest when the squad is big
  for (const c of w.clubs) w = settleClub(w, c.id, rng)
  w = {
    ...w,
    clubs: w.clubs.map((c) => {
      const six = new Set(Object.values(bestSix(c.players)).map((p) => p.id))
      const weakest = [...c.players].filter((p) => !six.has(p.id) && p.age > 19).sort((a, b) => ratingOf(a) - ratingOf(b))[0]
      return {
        ...c,
        players: c.players.map((p) => ({ ...p, listed: !six.has(p.id) && p.age > 19 && ((p.age >= 31) || (c.players.length >= AI_SQUAD && p.id === weakest?.id)) || undefined })).map(compactListed),
      }
    }),
  }

  // 5. New free agents (players released from abroad, out of contract) to keep the pool going
  while (w.free.length < 16) w.free.push(freeAgent(w, rng))
  w.free = w.free.slice(0, FREE_MAX)

  news.sort((a, b) => (a.type === 'transfer' ? 0 : 1) - (b.type === 'transfer' ? 0 : 1) || (b.fee || 0) - (a.fee || 0))
  return { world: { ...w, news: news.slice(0, 20) }, news }
}

const compactListed = (p) => (p.listed ? p : (({ listed, ...rest }) => { void listed; return rest })(p))

/* ── Saves ── */

function cleanPlayer(raw) {
  if (!isObj(raw) || typeof raw.name !== 'string' || !isObj(raw.attrs) || !['GK', 'DEF', 'MID', 'ATK'].includes(raw.pos)) return null
  const attrs = Object.fromEntries(ATTRS.map((k) => [k, Math.max(1, Math.min(99, Math.round(Number(raw.attrs[k]) || 50)))]))
  const rating = ovrOf(attrs, raw.pos)
  return {
    id: String(raw.id || '').slice(0, 16) || null,
    name: raw.name.slice(0, 24),
    pos: raw.pos,
    age: Number.isInteger(raw.age) && raw.age >= 15 && raw.age <= 45 ? raw.age : 25,
    attrs,
    pot: Math.max(rating, Math.min(99, Number.isFinite(raw.pot) ? Math.round(raw.pot) : rating)),
    ...(raw.listed === true ? { listed: true } : {}),
  }
}

/** One news item from a save: only the fields it had, each checked. */
export function cleanNews(n) {
  const out = { type: n.type === 'retired' ? 'retired' : 'transfer', name: String(n.name || '').slice(0, 24) }
  for (const k of ['club', 'to']) if (typeof n[k] === 'string') out[k] = n[k].slice(0, 24)
  if (typeof n.from === 'string' || n.from === null) out.from = n.from ? n.from.slice(0, 24) : null
  for (const k of ['fee', 'ovr', 'age', 'level']) if (Number.isFinite(n[k])) out[k] = Math.round(n[k])
  return out
}

/** Load a saved world; anything unreadable gets a fresh world. */
export function sanitizeWorld(input, seed = 'world') {
  if (!isObj(input) || !Array.isArray(input.clubs) || !Array.isArray(input.free)) return createWorld(seed)
  const fresh = () => createWorld(seed)
  const clubs = []
  for (const [level, div] of DIVISIONS.entries()) {
    for (const [tier, c] of div.clubs.entries()) {
      const raw = input.clubs.find((x) => isObj(x) && x.name === c.name)
      if (!raw || !Array.isArray(raw.players)) return fresh()
      const players = raw.players.map(cleanPlayer).filter((p) => p?.id).slice(0, AI_MAX + 2)
      if (players.length < 6) return fresh()
      clubs.push({ id: `c${level}${tier}`, name: c.name, level, tier, players })
    }
  }
  const free = input.free.map(cleanPlayer).filter((p) => p?.id).slice(0, FREE_MAX)
  const nextId = Number.isInteger(input.nextId) && input.nextId > 0 ? input.nextId : 100_000
  const news = Array.isArray(input.news) ? input.news.filter(isObj).slice(0, 20).map(cleanNews) : []
  return { nextId, clubs, free, news }
}
