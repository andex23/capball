/**
 * Your squad and the transfer market, Football Manager style:
 *
 * - A squad of up to fifteen: the starting six, four on the bench (the
 *   matchday ten) and up to five reserves. Once all fifteen places are
 *   filled you can't sign anyone until you sell, release or loan someone out.
 * - A youth team beside it (it doesn't count towards the fifteen): academy
 *   graduates arrive each summer; promote them when there's room.
 * - The market is the whole world: search any club's players or the free
 *   agents and bid. Clubs accept, counter or turn you down, and stop talking
 *   after three tries in a window. Free agents can sign at any time; players
 *   at clubs only while a window is open.
 * - Selling: clubs where he'd play and who can afford him make offers.
 *   Releasing costs five matches' wages. A loan sends him to a club where
 *   he'll start until the summer: he isn't paid by you, doesn't take a place,
 *   and comes back better for the games.
 *
 * Pure functions over plain JSON; each returns a new career (or null / a
 * result object saying why not).
 */
import { allFixtures, seededRng } from './tournament'
import { newClub, book, wageOf, ACADEMY, TRAINING } from './club'
import { money, openWindow, sanitizePlayer, developSeason, makeYouth, priceOf, ageGrowth, shiftOvr, DIVISION_RATING, POS_OF } from './squad'
import {
  locate, takePlayer, putPlayer, settleClub, hydrate, compact, askingPrice, willingness, bidVerdict, buyersFor,
  loanClubFor, MAX_BIDS, clubById,
} from './world'

export const ME = 'T1'
export const MATCHDAY = 10   // six start, four on the bench
export const MAX_RESERVES = 5
export const MAX_SQUAD = MATCHDAY + MAX_RESERVES
export const YOUTH_MAX = 8
export const RELEASE_MATCHES = 5 // a released player is paid this many matches' wages

const ROLE_FOR_POS = { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }

/** How many of your matches you've played this season. */
export function playedThisSeason(league) {
  return allFixtures(league).filter((f) => f.result && (f.home === ME || f.away === ME)).length
}

/** The open transfer window: { index, key } or null when it's shut. */
export function transferWindow(career) {
  const index = openWindow(playedThisSeason(career.league))
  if (index < 0) return null
  return { index, key: `${career.season}:${index}` }
}

/** In the red: the board freezes transfers and upgrades until the books are back above zero. */
export const spendingFrozen = (career) => (career.coins ?? 0) < 0

/** Everyone in the first-team squad (not the youth team, not out on loan). */
export const squadSize = (career) => Object.keys(career.squad || {}).length + (career.bench || []).length + (career.reserves || []).length
export const squadFull = (career) => squadSize(career) >= MAX_SQUAD

/* ── Slots: 'atk1' (starting six), 'bench:2', 'reserve:0' ── */

export function inSlot(career, slot) {
  const b = /^bench:(\d)$/.exec(slot)
  if (b) return career.bench?.[Number(b[1])] || null
  const r = /^reserve:(\d+)$/.exec(slot)
  if (r) return career.reserves?.[Number(r[1])] || null
  return career.squad?.[slot] || null
}

function putInSlot(career, slot, p) {
  const b = /^bench:(\d)$/.exec(slot)
  if (b) return { ...career, bench: career.bench.map((x, i) => (i === Number(b[1]) ? p : x)) }
  const r = /^reserve:(\d+)$/.exec(slot)
  if (r) return { ...career, reserves: career.reserves.map((x, i) => (i === Number(r[1]) ? p : x)) }
  return { ...career, squad: { ...career.squad, [slot]: p } }
}

const isReserve = (slot) => /^reserve:\d+$/.test(slot)

/** Every player at the club with his slot. */
export function allSlots(career) {
  return [
    ...Object.entries(career.squad || {}).map(([slot, player]) => ({ slot, player })),
    ...(career.bench || []).map((player, i) => ({ slot: `bench:${i}`, player })),
    ...(career.reserves || []).map((player, i) => ({ slot: `reserve:${i}`, player })),
  ]
}

/**
 * Bring a reserve into the matchday ten, swapping with a starter or bench
 * player (who drops to the reserves). Keepers swap with keepers.
 */
export function promoteReserve(career, reserveIndex, slot) {
  const from = `reserve:${reserveIndex}`
  const a = inSlot(career, from)
  const b = inSlot(career, slot)
  if (!a || !b || isReserve(slot)) return null
  if ((a.pos === 'GK') !== (b.pos === 'GK')) return null
  return putInSlot(putInSlot(career, from, b), slot, a)
}

/**
 * Take a player out of his slot. A place in the matchday ten is filled by the
 * best reserve who can play there (a keeper for a keeper); if there's nobody,
 * returns { error }.
 */
export function vacate(career, slot) {
  const player = inSlot(career, slot)
  if (!player) return { error: 'No one there.' }
  if (isReserve(slot)) {
    const i = Number(slot.split(':')[1])
    return { career: { ...career, reserves: career.reserves.filter((_, j) => j !== i) }, player }
  }
  const keeper = player.pos === 'GK'
  const role = /^bench:/.test(slot) ? ROLE_FOR_POS[player.pos] : slot
  const cover = (career.reserves || []).map((p, i) => ({ p, i })).filter(({ p }) => (p.pos === 'GK') === keeper)
    .sort((a, b) => hydrate(b.p).rating - hydrate(a.p).rating + ((b.p.pos === POS_OF[role]) - (a.p.pos === POS_OF[role])) * 3)[0]
  if (!cover) return { error: keeper ? 'You need another keeper in the reserves to take his place.' : 'You need a reserve to take his place in the matchday ten.' }
  const next = putInSlot({ ...career, reserves: career.reserves.filter((_, j) => j !== cover.i) }, slot, cover.p)
  return { career: next, player, cover: cover.p }
}

/* ── Buying ── */

const talksFor = (career, key) => (career.talks?.key === key ? career.talks : { key, bids: {} })

/** Your recent deals, newest first (kept for the screens). */
const logDeal = (career, deal) => [deal, ...(career.deals || [])].slice(0, 12)

/**
 * Bid `amount` (units) for a player. Returns { career, result } where result
 * is { verdict: 'accept' | 'counter' | 'reject' | 'full' | 'shut' | 'frozen' |
 * 'funds' | 'ended', fee?, bonus?, why? }. A successful signing joins
 * the reserves.
 */
export function makeBid(career, playerId, amount) {
  const where = locate(career.world, playerId)
  if (!where) return { career, result: { verdict: 'reject', why: 'He’s no longer available.' } }
  const { player, club } = where
  const win = transferWindow(career)
  const key = win?.key || `${career.season}:free`
  if (squadFull(career)) return { career, result: { verdict: 'full', why: `Your squad is full (${MAX_SQUAD}). Sell, release or loan out a player first.` } }
  if (club && !win) return { career, result: { verdict: 'shut', why: 'The transfer window is shut. Free agents can sign any time.' } }
  if (spendingFrozen(career)) return { career, result: { verdict: 'frozen', why: 'The board has frozen spending while the club is in the red.' } }
  // A player dropping down wants a signing bonus on top (and higher wages)
  const will = willingness(player, club, career.level)
  const bid = Math.max(0, Math.round(amount))
  if ((career.coins ?? 0) < bid + will.bonus) return { career, result: { verdict: 'funds', why: will.bonus ? `With his ${money(will.bonus)} signing bonus that’s more than your budget.` : 'You don’t have that much in the club budget.' } }
  const talks = talksFor(career, key)
  const t = talks.bids[playerId] || { tries: 0 }
  if (t.ended || t.tries >= MAX_BIDS) return { career, result: { verdict: 'ended', why: `${club?.name || 'His agent'} won’t talk again until the next window.` } }
  const verdict = bidVerdict(player, club, bid, t.tries, key)
  const nextTalks = { key, bids: { ...talks.bids, [playerId]: { tries: t.tries + 1, ended: !!verdict.ended, counter: verdict.verdict === 'counter' ? verdict.fee : undefined } } }
  if (verdict.verdict !== 'accept') return { career: { ...career, talks: nextTalks }, result: verdict }
  // Done deal
  let world = takePlayer(career.world, playerId).world
  if (club) world = settleClub(world, club.id, seededRng(`settle:${key}:${playerId}`))
  const signed = sanitizePlayer({ ...hydrate(player), id: player.id, ...(will.premium > 1 ? { wageX: will.premium } : {}) }, ROLE_FOR_POS[player.pos] || 'mid')
  const cost = bid + will.bonus
  const biz = book(career.biz || newClub(career.level), { transfers: cost })
  return {
    career: {
      ...career,
      world,
      talks: nextTalks,
      reserves: [...(career.reserves || []), signed],
      coins: (career.coins ?? 0) - cost,
      biz,
      deals: logDeal(career, { type: 'in', name: player.name, club: club?.name || null, fee: cost, season: career.season }),
    },
    result: { verdict: 'accept', fee: bid, bonus: will.bonus },
  }
}

/** Where talks stand for a player this window: { tries, ended, counter } or null. */
export function talksWith(career, playerId) {
  const win = transferWindow(career)
  const key = win?.key || `${career.season}:free`
  return talksFor(career, key).bids[playerId] || null
}

/* ── Selling, releasing, loaning out ── */

/** Offers for one of your players this window (none while it's shut). */
export function offersFor(career, slot) {
  const win = transferWindow(career)
  const p = inSlot(career, slot)
  if (!win || !p) return []
  return buyersFor(career.world, compact(p), `${career.league.id}:${win.key}`)
}

/** Accept a club's offer (from offersFor). Returns the new career, or { error }. */
export function sellTo(career, slot, clubId) {
  const offer = offersFor(career, slot).find((o) => o.clubId === clubId)
  if (!offer) return { error: 'That offer isn’t on the table.' }
  const v = vacate(career, slot)
  if (v.error) return v
  let world = putPlayer(career.world, clubId, compact(v.player))
  world = settleClub(world, clubId, seededRng(`sold:${v.player.id}`))
  return {
    ...v.career,
    world,
    coins: (career.coins ?? 0) + offer.fee,
    biz: book(career.biz || newClub(career.level), { sales: offer.fee }),
    deals: logDeal(career, { type: 'out', name: v.player.name, club: offer.club, fee: offer.fee, season: career.season }),
  }
}

/** What releasing him costs: his wages for RELEASE_MATCHES matches. */
export const releaseCost = (p) => wageOf(p) * RELEASE_MATCHES

/** Let a player go: he becomes a free agent; you pay off his wages. Any time. */
export function releasePlayer(career, slot) {
  const v = vacate(career, slot)
  if (v.error) return v
  const cost = releaseCost(v.player)
  return {
    ...v.career,
    world: putPlayer(career.world, null, compact(v.player)),
    coins: (career.coins ?? 0) - cost,
    biz: book(career.biz || newClub(career.level), { wages: cost }),
    deals: logDeal(career, { type: 'released', name: v.player.name, fee: cost, season: career.season }),
  }
}

/** The club that would take him on loan now, or null. */
export function loanClub(career, slot) {
  const p = inSlot(career, slot)
  return p ? loanClubFor(career.world, compact(p), career.level) : null
}

/** Loan a player out until the summer (window open only). */
export function loanOut(career, slot) {
  if (!transferWindow(career)) return { error: 'Loans are agreed in a transfer window.' }
  const club = loanClub(career, slot)
  if (!club) return { error: 'No club wants him on loan: he wouldn’t get games anywhere.' }
  const v = vacate(career, slot)
  if (v.error) return v
  return {
    ...v.career,
    loans: [...(career.loans || []), { player: v.player, clubId: club.id, club: club.name, level: club.level }],
    deals: logDeal(career, { type: 'loan', name: v.player.name, club: club.name, fee: 0, season: career.season }),
  }
}

/* ── The youth team ── */

/** Promote a youth player into the squad (to the reserves). */
export function promoteYouth(career, index) {
  const p = career.youthTeam?.[index]
  if (!p) return { error: 'No such player.' }
  if (squadFull(career)) return { error: `Your squad is full (${MAX_SQUAD}). Make room first.` }
  return { ...career, youthTeam: career.youthTeam.filter((_, i) => i !== index), reserves: [...(career.reserves || []), { ...p, youth: p.age <= 19 }] }
}

/** Release a youth player (free). */
export function releaseYouth(career, index) {
  const p = career.youthTeam?.[index]
  if (!p) return { error: 'No such player.' }
  return { ...career, youthTeam: career.youthTeam.filter((_, i) => i !== index), world: putPlayer(career.world, null, compact(p)) }
}

/** This summer's academy graduates (15–16, well below the first team, with potential). */
export function youthIntake(level, academyLevel, seed, count = null) {
  const a = ACADEMY[academyLevel] || ACADEMY[0]
  const rng = seededRng(`intake:${seed}`)
  const n = count ?? a.intake
  return Array.from({ length: n }, (_, i) => {
    const pos = ['ATK', 'MID', 'DEF', 'GK', 'DEF', 'ATK', 'MID'][Math.floor(rng() * 7)]
    const y = makeYouth(rng, level, pos, 0, [15, 16], 13)
    const pot = Math.min(99, y.rating + 14 + Math.floor(rng() * 14) + a.pot)
    return sanitizePlayer({ ...y, id: `y${seed}`.replace(/[^a-z0-9]/gi, '').slice(-10) + i, pot, youth: true }, ROLE_FOR_POS[pos])
  })
}

/* ── The summer, for your squad ── */

/**
 * Loans come back (they played: a good season's growth), the youth team
 * grows (faster with better training), anyone over 18 must leave it, and the
 * academy sends up its graduates. Returns { career, loansBack, youthIn, youthOut }.
 */
export function squadSummer(career, { level, seed }) {
  const rng = seededRng(`youth:${seed}`)
  const xp = TRAINING[career.biz?.training || 0]?.xp || 1
  // Loans: they played regularly, so they grow like a starter with a 7.0 season
  const loaned = (career.loans || []).map((l) => ({ ...l.player, apps: 10, ratingSum: 70 }))
  const back = developSeason(Object.fromEntries(loaned.map((p, i) => [String(i), p])), `${seed}:loans`, level)
  const loansBack = loaned.map((_, i) => back.squad[String(i)]).filter((p, i) => !back.retired.some((r) => r.role === String(i)))
  // Youth team
  const youthOut = []
  const youthTeam = []
  for (const p0 of career.youthTeam || []) {
    const p = hydrate(p0)
    let change = ageGrowth(p.age) + Math.floor(rng() * 3) - 1 + (xp >= 1.3 ? 1 : 0)
    change = Math.max(0, Math.min(change, p.pot - p.rating))
    const grown = sanitizePlayer({ ...shiftOvr(p, change, rng), age: p.age + 1, youth: true }, ROLE_FOR_POS[p.pos])
    if (grown.age >= 19) youthOut.push(grown)
    else youthTeam.push(grown)
  }
  const youthIn = youthIntake(level, career.biz?.academy || 0, seed).slice(0, Math.max(0, YOUTH_MAX - youthTeam.length))
  let world = career.world
  for (const p of youthOut) world = putPlayer(world, null, compact(p))
  return {
    career: { ...career, world, loans: [], reserves: [...(career.reserves || []), ...loansBack], youthTeam: [...youthTeam, ...youthIn] },
    loansBack, youthIn, youthOut,
  }
}

/* ── Saves ── */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

export function sanitizeLoans(input) {
  if (!Array.isArray(input)) return []
  return input.filter((l) => isObj(l) && isObj(l.player)).map((l) => {
    const player = sanitizePlayer(l.player, ROLE_FOR_POS[l.player.pos] || 'mid')
    return player ? { player, clubId: String(l.clubId || '').slice(0, 8), club: String(l.club || '').slice(0, 24), level: Number.isInteger(l.level) ? l.level : 0 } : null
  }).filter(Boolean).slice(0, MAX_SQUAD)
}

export function sanitizeYouth(input) {
  if (!Array.isArray(input)) return null
  return input.map((p) => sanitizePlayer(p, ROLE_FOR_POS[p?.pos] || 'mid')).filter(Boolean).slice(0, YOUTH_MAX)
}

export function sanitizeTalks(input) {
  if (!isObj(input) || typeof input.key !== 'string' || !isObj(input.bids)) return null
  const bids = {}
  for (const [id, b] of Object.entries(input.bids).slice(0, 200)) {
    if (!isObj(b)) continue
    bids[String(id).slice(0, 16)] = { tries: Math.max(0, Math.min(MAX_BIDS, Math.floor(Number(b.tries) || 0))), ended: b.ended === true, ...(Number.isFinite(b.counter) ? { counter: Math.round(b.counter) } : {}) }
  }
  return { key: input.key.slice(0, 20), bids }
}

export function sanitizeDeals(input) {
  if (!Array.isArray(input)) return []
  return input.filter(isObj).slice(0, 12).map((d) => ({
    type: ['in', 'out', 'released', 'loan'].includes(d.type) ? d.type : 'in',
    name: String(d.name || '').slice(0, 24),
    club: d.club ? String(d.club).slice(0, 24) : null,
    fee: Number.isFinite(d.fee) ? Math.round(d.fee) : 0,
    season: Number.isInteger(d.season) ? d.season : 1,
  }))
}

/** For the screens: the market value of a player at your club. */
export const valueOf = (p) => priceOf(p)
export { askingPrice, clubById, DIVISION_RATING }
