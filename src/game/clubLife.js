/**
 * The life of your club between matches, Football Manager style:
 *
 * - Contracts: every player has seasons left on his deal. When it runs out
 *   he leaves on a free, unless you renew (at a pay rise) first.
 * - Fitness: starting drains fitness, a rest restores it, and a tired player
 *   flicks with less power and is easier to knock aside, so rotate.
 * - Morale: a good player left out all season wants to leave, and so does
 *   a star who has outgrown your division. Unhappy players won't renew.
 * - Offers: in a window, clubs bid for your best and unhappy players.
 * - Reputation: winning things makes you a name; better players are less
 *   reluctant to drop down to play for you.
 * - Scouting: a player's potential is only a rough guess until you scout him.
 * - Awards: player of the season, top scorer and young player of the season,
 *   and a Hall of Fame of every career you've finished.
 *
 * Pure functions over plain JSON.
 */
import { seededRng } from './tournament'
import { DIVISION_RATING, ATTRS, makePlayer, randomName, priceOf, sanitizePlayer, squadRatings, averageRating, ovrAt } from './squad'
import { CAP_ROLES } from '../data/TeamOptions'
import { book, newClub } from './club'
import { allSlots, inSlot, putInSlot, offersFor, transferWindow } from './transfers'
import { compact, putPlayer } from './world'

const ROLE_FOR_POS = { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }
const round1 = (n) => Math.round(n * 10) / 10

/** Apply `fn` to every player in the first-team squad (six, bench, reserves). */
function mapPlayers(career, fn) {
  return {
    ...career,
    squad: Object.fromEntries(Object.entries(career.squad || {}).map(([r, p]) => [r, fn(p, r)])),
    bench: (career.bench || []).map((p, i) => fn(p, `bench:${i}`)),
    reserves: (career.reserves || []).map((p, i) => fn(p, `reserve:${i}`)),
  }
}

/* ── Contracts ── */

/** Seasons on a new deal: young players sign longer. */
export const contractFor = (age) => (age <= 23 ? 4 : age <= 29 ? 3 : 2)
/** Seasons left (older saves: two). 1 = this is his last season. */
export const contractOf = (p) => (Number.isInteger(p?.contract) ? p.contract : 2)

/** Give a fresh squad its contracts (1–3 seasons, so renewals come up early). */
export function withContracts(players, seed) {
  const rng = seededRng(`contracts:${seed}`)
  return players.map((p) => ({ ...p, contract: 1 + Math.floor(rng() * 3) }))
}

/** What he wants to stay: a pay rise (more for one of your best), for a new deal; unhappy players won't sign. */
export function renewTerms(career, p) {
  if (p.wantsAway) return { ok: false, why: `${p.name} wants to leave and won’t sign a new deal.` }
  const ten = Object.values(squadRatings(career.squad) || {})
  const best = ten.length ? Math.max(...ten) : 0
  const rise = p.rating >= best - 2 ? 1.3 : 1.15
  return { ok: true, years: contractFor(p.age), wageX: round1(Math.max(1, (p.wageX || 1) * rise)), rise }
}

/** Renew a player's contract on his terms. Returns the career, or { error }. */
export function renewContract(career, slot) {
  const p = inSlot(career, slot)
  if (!p) return { error: 'No one there.' }
  const t = renewTerms(career, p)
  if (!t.ok) return { error: t.why }
  return putInSlot(career, slot, { ...p, contract: t.years, ...(t.wageX > 1 ? { wageX: t.wageX } : {}) })
}

/* ── Fitness ── */

export const fitnessOf = (p) => (Number.isFinite(p?.fit) ? p.fit : 100)

/** His attributes as they play today: a tired player flicks with less power and is lighter (85–100%). */
export function matchAttrs(p) {
  if (!p?.attrs) return p?.attrs || null
  const f = 0.85 + 0.15 * (fitnessOf(p) / 100)
  return { ...p.attrs, pwr: Math.round(p.attrs.pwr * f), phy: Math.round(p.attrs.phy * f) }
}

/** After a match: everyone who played tires (−14, down to 40%), everyone else recovers (+20). */
export function afterMatch(career, playedIds) {
  const played = new Set(playedIds)
  return mapPlayers(career, (p) => {
    const q = { ...p, fit: played.has(p.id) ? Math.max(40, fitnessOf(p) - 14) : Math.min(100, fitnessOf(p) + 20) }
    if (q.fit >= 100) delete q.fit
    return q
  })
}

/* ── Morale ── */

/**
 * Who wants to leave after this season: a good player who hardly played
 * (fewer than 3 games but as good as a starter), or a star who has outgrown
 * the division. Regulars are happy. Returns a Set of ids.
 */
export function unhappyAfterSeason(career, level) {
  const out = new Set()
  const ratings = squadRatings(career.squad) || {}
  const minStarter = (keeper) => Math.min(...CAP_ROLES.filter((r) => (r === 'gk') === keeper).map((r) => ratings[r] ?? 99))
  for (const { slot, player: p } of allSlots(career)) {
    const inSix = CAP_ROLES.includes(slot)
    const starved = !inSix && (p.apps || 0) < 3 && p.age >= 20 && p.age <= 31 && p.rating >= minStarter(p.pos === 'GK') - 1
    const outgrown = level < DIVISION_RATING.length - 1 && p.rating >= (DIVISION_RATING[level] ?? 60) + 14
    // A regular (8+ games) is happy where he is
    if ((starved || outgrown) && (p.apps || 0) < 8) out.add(p.id)
  }
  return out
}

/* ── The summer: contracts run down ── */

/**
 * Contracts tick down a season. Players whose deals run out leave on a free;
 * the matchday ten is filled from the reserves, then the youth team, then a
 * trialist. Fitness resets over the summer; morale is set from
 * `unhappy` (ids). Returns { career, left: [names], unhappy: [names] }.
 */
export function contractSummer(career, { level, seed, unhappy = new Set() }) {
  const rng = seededRng(`contracts-summer:${seed}`)
  const left = []
  const sad = []
  let next = mapPlayers(career, (p) => {
    const q = { ...p, contract: contractOf(p) - 1 }
    delete q.fit
    if (unhappy.has(p.id)) { q.wantsAway = true; sad.push(p.name) } else delete q.wantsAway
    return q
  })
  let world = next.world
  // Reserves whose deals ran out just go
  for (const p of next.reserves) if (p.contract <= 0) { left.push(p.name); world = putPlayer(world, null, compact(p)) }
  next = { ...next, reserves: next.reserves.filter((p) => p.contract > 0) }
  // The matchday ten: refill each gap
  const youth = [...(next.youthTeam || [])]
  for (const { slot, player: p } of allSlots(next).filter((x) => !x.slot.startsWith('reserve:'))) {
    if (p.contract > 0) continue
    left.push(p.name)
    world = putPlayer(world, null, compact(p))
    const keeper = p.pos === 'GK'
    const role = CAP_ROLES.includes(slot) ? slot : ROLE_FOR_POS[p.pos]
    const fromRes = next.reserves.map((x, i) => ({ x, i })).filter(({ x }) => (x.pos === 'GK') === keeper).sort((a, b) => ovrAt(b.x, role) - ovrAt(a.x, role))[0]
    const fromYouth = youth.map((x, i) => ({ x, i })).filter(({ x }) => (x.pos === 'GK') === keeper).sort((a, b) => ovrAt(b.x, role) - ovrAt(a.x, role))[0]
    let cover
    if (fromRes) { cover = fromRes.x; next = { ...next, reserves: next.reserves.filter((_, j) => j !== fromRes.i) } }
    else if (fromYouth) { cover = { ...fromYouth.x, contract: 3 }; youth.splice(fromYouth.i, 1) }
    else {
      // A trialist on a one-season deal
      const t = makePlayer(rng, (DIVISION_RATING[level] ?? 52) - 6, p.pos, 2, [22, 30])
      cover = sanitizePlayer({ ...t, id: `t${seed}`.replace(/[^a-z0-9]/gi, '').slice(-9) + slot.replace(/\W/g, ''), name: randomName(rng), contract: 1 }, ROLE_FOR_POS[p.pos])
    }
    next = putInSlot(next, slot, cover)
  }
  return { career: { ...next, world, youthTeam: youth }, left, unhappy: sad }
}

/* ── Offers for your players ── */

/**
 * In a window, clubs come in for your best players (and anyone who wants
 * out): the best offer for each, at least 85% of his value (any offer for an
 * unhappy player), up to three, biggest first. Offers you turn down stay
 * down until the next window.
 */
export function inboxOffers(career) {
  const win = transferWindow(career)
  if (!win) return []
  const turned = career.rejected?.key === win.key ? career.rejected.ids : []
  const ten = averageRating(squadRatings(career.squad))
  const rows = []
  for (const { slot, player: p } of allSlots(career)) {
    if (turned.includes(p.id)) continue
    if (!p.wantsAway && p.rating < ten + 3) continue
    const best = offersFor(career, slot)[0]
    if (!best) continue
    if (!p.wantsAway && best.fee < priceOf(p) * 0.85) continue
    rows.push({ slot, player: p, offer: best })
  }
  return rows.sort((a, b) => b.offer.fee - a.offer.fee).slice(0, 3)
}

/** Turn down a club's offer for a player (until the next window). */
export function rejectOffer(career, playerId) {
  const win = transferWindow(career)
  if (!win) return career
  const ids = career.rejected?.key === win.key ? career.rejected.ids : []
  return { ...career, rejected: { key: win.key, ids: [...ids, playerId].slice(-30) } }
}

/* ── Reputation ── */

export const REP_START = 10
export const repLabel = (rep) => (rep >= 80 ? 'World-class' : rep >= 60 ? 'Renowned' : rep >= 40 ? 'Respected' : rep >= 20 ? 'Promising' : 'Unknown')

/** Your reputation after a season: trophies and promotions build it, missed targets dent it (0–100). */
export function repAfterSeason(rep, { outcome, met, cup }) {
  let r = rep ?? REP_START
  if (outcome === 'promoted') r += 15
  if (outcome === 'champions') r += 25
  if (cup === 'won') r += 10
  r += met ? 5 : -10
  return Math.max(0, Math.min(100, r))
}

/** How much of a player's drop-down premium your name takes away (none at 0, two-thirds at 100). */
export const repDiscount = (rep) => Math.max(0, Math.min(100, rep || 0)) / 150

/* ── Scouting ── */

export const SCOUT_FEE = [5, 10, 20, 40] // units, by your division
export const isScouted = (career, id) => !!career?.scouted?.includes(id)

/** Scout a player: his potential becomes clear. Returns the career, or { error }. */
export function scoutPlayer(career, id) {
  if (isScouted(career, id)) return career
  const fee = SCOUT_FEE[career.level] ?? 10
  if ((career.coins ?? 0) < fee) return { error: 'Not enough in the club budget to send a scout.' }
  return {
    ...career,
    scouted: [...(career.scouted || []), id].slice(-400),
    coins: career.coins - fee,
    biz: book(career.biz || newClub(career.level), { facilities: fee }),
  }
}

/** Before scouting: a wide guess at his potential (a 12-point range that holds the real figure). */
export function roughPotential(p) {
  let h = 0
  for (const ch of String(p.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const lo = Math.max(p.rating, p.pot - 2 - (h % 9))
  const hi = Math.min(99, lo + 12)
  return lo >= hi ? `${hi}` : `${lo}–${hi}`
}

/* ── Awards ── */

/** This season's awards for your club, from the squad's season stats (before the summer resets them). */
export function seasonAwards(career) {
  const all = allSlots(career).map((x) => x.player).concat((career.loans || []).map((l) => l.player))
  const avg = (p) => (p.apps ? p.ratingSum / p.apps : 0)
  const regulars = all.filter((p) => (p.apps || 0) >= 3)
  const pick = (list, by) => list.slice().sort((a, b) => by(b) - by(a))[0] || null
  const pots = pick(regulars, avg)
  const boot = pick(all.filter((p) => (p.goals || 0) > 0), (p) => p.goals * 100 + avg(p))
  const young = pick(regulars.filter((p) => p.age <= 21), avg)
  const out = {}
  if (pots) out.pots = { name: pots.name, avg: round1(avg(pots)) }
  if (boot) out.boot = { name: boot.name, goals: boot.goals }
  if (young) out.young = { name: young.name, avg: round1(avg(young)) }
  return out
}

/* ── Hall of Fame ── */

export const HOF_KEY = 'capball:career-hof:v1'

/** One finished career for the Hall of Fame. */
export function hallEntry(career, ended, now = Date.now()) {
  const best = Math.max(career.level ?? 0, ...(career.past || []).map((p) => p.level ?? 0))
  return {
    club: String(career.club?.name || 'My Club').slice(0, 24),
    seasons: (career.past || []).length,
    promotions: career.promotions || 0,
    titles: career.titles || 0,
    cups: career.cups || 0,
    best,
    rep: career.rep ?? REP_START,
    ended: ended === 'sacked' ? 'sacked' : 'retired',
    at: new Date(now).toISOString().slice(0, 10),
  }
}

export function sanitizeHall(input) {
  if (!Array.isArray(input)) return []
  const n = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, 999) : 0)
  return input.filter((e) => e && typeof e === 'object').slice(0, 20).map((e) => ({
    club: String(e.club || '').slice(0, 24), seasons: n(e.seasons), promotions: n(e.promotions), titles: n(e.titles), cups: n(e.cups),
    best: Math.min(3, n(e.best)), rep: Math.min(100, n(e.rep)), ended: e.ended === 'sacked' ? 'sacked' : 'retired', at: String(e.at || '').slice(0, 10),
  }))
}

/** Clean saved awards on a past season. */
export function sanitizeAwards(a) {
  if (!a || typeof a !== 'object') return undefined
  const out = {}
  for (const k of ['pots', 'boot', 'young']) {
    const x = a[k]
    if (!x || typeof x.name !== 'string') continue
    out[k] = { name: x.name.slice(0, 24), ...(Number.isFinite(x.avg) ? { avg: round1(x.avg) } : {}), ...(Number.isInteger(x.goals) ? { goals: x.goals } : {}) }
  }
  return out
}

export { ATTRS }
