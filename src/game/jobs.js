/**
 * Job offers, as in FIFA career mode: a big season (promotion, the title, the
 * Cap Cup) and a bigger club calls. Take it and you manage their club: their
 * name and kit, their squad, their division and budget. Your manager rating,
 * trophies and records come with you; your old club and its players take the
 * new club's place in its division. Sacked? A smaller club may still call.
 * Pure functions over the career.
 */
import { DIVISIONS } from './divisions'
import { seededRng } from './tournament'
import { clubByName, clubsIn, swapClub, bestSix, hydrate, compact } from './world'
import { sanitizePlayer, BENCH_POS } from './squad'
import { withContracts } from './clubLife'
import { newClub, FAN_BASE } from './club'
import { youthIntake, MAX_RESERVES } from './transfers'

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const ROLE_FOR_POS = { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }

/** What a club hands a new manager to spend (units, see squad.js money()), by division. */
export const JOB_BUDGET = [600, 900, 1_800, 4_000, 9_000]
// A club won't call again until you've had this many seasons in the job
export const SETTLE_SEASONS = 2

/**
 * After a season: is there a job offer? `level` is the division you'll be in
 * next, `world` the world after the summer. Returns { name, level, reason } or null.
 */
export function jobOfferFor(career, { outcome, level, cup, sacked = false, world = career.world }) {
  const top = DIVISIONS.length - 1
  const seed = `${career.club?.name}:${career.season}:job`
  if (sacked) {
    // Only a smaller club: one of the weaker sides a division down (or in the bottom division)
    const lv = Math.max(0, career.level - 1)
    return pick(world, lv, career, seed, [3, 6], 'sacked')
  }
  if (career.season - (career.lastMove ?? 0) < SETTLE_SEASONS) return null
  const big = outcome === 'champions' ? 'champions' : outcome === 'promoted' ? 'promoted' : cup === 'won' ? 'cup' : null
  if (!big) return null
  // Champions get a call from another big club at the top; otherwise a strong club a division above where you're going
  const lv = big === 'champions' ? top : Math.min(top, level + 1)
  return pick(world, lv, career, seed, [0, 2], big)
}

function pick(world, level, career, seed, [from, to], reason) {
  const clubs = clubsIn(world, level).map((c, tier) => ({ c, tier })).filter(({ c, tier }) => tier >= from && tier <= to && c.name !== career.club?.name && clubByName(world, c.name))
  if (!clubs.length) return null
  const { c } = clubs[Math.floor(seededRng(seed)() * clubs.length)]
  return { name: c.name, level, reason }
}

/** The offering club as it stands: its kit, OVR and squad (for the offer card). */
export function offerDetails(career, offer) {
  const club = clubByName(career.world, offer?.name)
  if (!club) return null
  const kit = clubsIn(career.world, offer.level).find((c) => c.name === offer.name) || { name: offer.name }
  const six = Object.values(bestSix(club.players))
  const ovr = six.length ? Math.round(six.reduce((a, p) => a + p.rating, 0) / six.length) : 0
  return { kit, ovr, budget: JOB_BUDGET[offer.level] ?? JOB_BUDGET[0], division: DIVISIONS[offer.level].name, players: club.players.length }
}

/** All your players, compact, for your old club to keep. */
function myPlayers(career) {
  return [...Object.values(career.squad || {}), ...(career.bench || []), ...(career.reserves || []), ...(career.loans || []).map((l) => l.player)]
    .filter(Boolean).map((p) => compact({ ...p, pot: p.pot ?? p.rating }))
}

/**
 * Take the job. Returns the new career, or null if the club can't be found.
 * `create` is { createSeason, createCup, targetFor } from career.js (passed in to avoid a cycle).
 */
export function takeJob(career, create, now = Date.now()) {
  const offer = career.jobOffer
  if (!offer) return null
  const club = clubByName(career.world, offer.name)
  if (!club) return null
  const kit = clubsIn(career.world, offer.level).find((c) => c.name === offer.name) || { name: offer.name }
  const swap = swapClub(career.world, offer.name, career.club, myPlayers(career))
  if (!swap) return null
  const level = offer.level
  const seed = `${offer.name}:${career.season}:${now}`
  // Their squad becomes yours: the best six start, the best left in each position make the bench, the rest are reserves
  const pool = club.players.map(hydrate)
  const six = bestSix(club.players)
  const used = new Set(Object.values(six).map((p) => p.id))
  const rest = pool.filter((p) => !used.has(p.id)).sort((a, b) => b.rating - a.rating)
  const bench = []
  for (const pos of BENCH_POS) {
    const p = rest.find((x) => x.pos === pos && !used.has(x.id)) || rest.find((x) => !used.has(x.id))
    if (p) { bench.push(p); used.add(p.id) }
  }
  const reserves = rest.filter((p) => !used.has(p.id)).slice(0, MAX_RESERVES)
  const sign = (p, role) => sanitizePlayer({ ...p, id: p.id }, role)
  const contracted = (list, tag) => withContracts(list, `${seed}:${tag}`)
  const squad = Object.fromEntries(contracted(Object.entries(six).map(([role, p]) => ({ ...sign(p, role), _role: role })), 'six').map(({ _role, ...p }) => [_role, p]))
  const newClubKit = {
    ...career.club,
    name: kit.name, primary: kit.primary || career.club.primary, edge: kit.edge || career.club.edge,
    pattern: kit.pattern || 'none', badge: kit.badge || 'none', finish: kit.finish || 'gloss', capText: '', art: '',
  }
  const biz = { ...newClub(level, seed), stadium: Math.min(4, level), training: Math.min(3, level), academy: Math.min(3, level), fans: Math.round((FAN_BASE[level] ?? FAN_BASE[0]) * 0.5) }
  const season = career.sacked ? career.season + 1 : career.season
  const next = {
    ...career,
    club: newClubKit,
    level,
    season,
    world: swap.world,
    squad,
    bench: contracted(bench.map((p) => sign(p, ROLE_FOR_POS[p.pos] || 'mid')), 'bench'),
    reserves: contracted(reserves.map((p) => sign(p, ROLE_FOR_POS[p.pos] || 'mid')), 'res'),
    loans: [],
    youthTeam: youthIntake(level, biz.academy, `${seed}:youth`, 2),
    biz,
    coins: JOB_BUDGET[level] ?? JOB_BUDGET[0],
    talks: null,
    deals: [],
    legendSignings: [],
    rejected: null,
    warning: false,
    sacked: null,
    jobOffer: null,
    ccl: null,
    lastMove: season,
    jobs: [{ season, from: career.club.name, to: kit.name, reason: offer.reason }, ...(career.jobs || [])].slice(0, 20),
    lastMatch: null,
    lastReport: null,
  }
  next.league = create.createSeason(newClubKit, level, career.matchDuration, now, swap.world)
  next.cup = create.createCup(newClubKit, level, career.matchDuration, season, now, swap.world)
  next.target = create.targetFor(level)
  return next
}

/** Turn it down: you stay, and the fans love you for it. */
export function declineJob(career) {
  if (!career.jobOffer) return career
  const fans = Math.round((career.biz?.fans || 0) * 1.1)
  return { ...career, jobOffer: null, ...(career.biz && !career.sacked ? { biz: { ...career.biz, fans } } : {}) }
}

export function sanitizeOffer(o) {
  if (!isObj(o) || typeof o.name !== 'string' || !Number.isInteger(o.level) || o.level < 0 || o.level >= DIVISIONS.length) return null
  return { name: o.name.slice(0, 24), level: o.level, reason: ['promoted', 'champions', 'cup', 'sacked'].includes(o.reason) ? o.reason : 'promoted' }
}

export function sanitizeJobs(list) {
  if (!Array.isArray(list)) return []
  return list.filter(isObj).slice(0, 20).map((j) => ({
    season: Number.isInteger(j.season) ? j.season : 1, from: String(j.from || '').slice(0, 24), to: String(j.to || '').slice(0, 24),
    reason: ['promoted', 'champions', 'cup', 'sacked'].includes(j.reason) ? j.reason : 'promoted',
  }))
}
