/**
 * Running the club as a business, the Football Manager way: fans come to
 * watch at your venue and buy tickets, a sponsor pays, TV money grows with the division;
 * players earn wages every match; the owner invests in the venue, the
 * training ground and the youth academy. Money is kept in units (₦10,000 —
 * see `money` in squad.js).
 *
 * Pure functions over plain JSON.
 */
import { seededRng } from './tournament'
import { priceOf } from './squad'
import { isFinish } from '../data/StadiumData'

/* ── Facilities: five levels each (0–4) ── */

// Counterball is a tabletop game, so the "stadium" is where your table is: a
// better table in a bigger room, with space for more people to watch. Each
// level is a real venue your home matches are played in.

export const VENUE = [
  { name: 'Street corner', venue: 'street', table: 'Folding table on the pavement', seats: 150 },
  { name: 'Garden', venue: 'gravel', table: 'Picnic table in the compound', seats: 400 },
  { name: 'Viewing centre', venue: 'bar', table: 'Varnished table at the bar', seats: 750 },
  { name: 'Game room', venue: 'arena', table: 'Black table under neon lights', seats: 1_500 },
  { name: 'Cap Arena', venue: 'capArena', table: 'Pro table with stands all round', seats: 3_000 },
]
/** Older name for the same thing. */
export const STADIUM = VENUE
export const TRAINING = [
  { name: 'Open field', xp: 1 },
  { name: 'Training pitch', xp: 1.15 },
  { name: 'Training centre', xp: 1.3 },
  { name: 'Performance centre', xp: 1.45 },
  { name: 'Elite campus', xp: 1.6 },
]
export const ACADEMY = [
  { name: 'Youth team', intake: 1, pot: -4 },
  { name: 'Youth academy', intake: 2, pot: 0 },
  { name: 'Category 3 academy', intake: 2, pot: 3 },
  { name: 'Category 2 academy', intake: 3, pot: 6 },
  { name: 'Category 1 academy', intake: 3, pot: 9 },
]
export const FACILITIES = { stadium: VENUE, training: TRAINING, academy: ACADEMY }
/** What it costs (units) to reach each level. */
export const UPGRADE_COST = {
  stadium: [0, 300, 1_000, 3_000, 8_000],
  training: [0, 200, 600, 1_500, 4_000],
  academy: [0, 200, 600, 1_500, 4_000],
}

/**
 * Where a career match is played: your own venue at home; away, the other
 * club's, which is grander the higher the division (the same every time).
 */
export function matchVenue(club, home, level = 0, opponentName = '') {
  if (home) return VENUE[club?.stadium ?? 0]?.venue || VENUE[0].venue
  let h = 0
  for (const ch of String(opponentName)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const i = Math.max(0, Math.min(VENUE.length - 1, level + (h % 2)))
  return VENUE[i].venue
}

/* ── Tickets ── */

// A normal ticket in each division, in naira (bottom to top)
export const BASE_TICKET = [2_000, 2_800, 4_000, 6_000]
export const TICKETS = {
  cheap: { label: 'Cheap', price: 0.7, demand: 1.15 },
  standard: { label: 'Standard', price: 1, demand: 0.9 },
  premium: { label: 'Premium', price: 1.5, demand: 0.6 },
}
export const ticketPrice = (level, ticket) => Math.round((BASE_TICKET[level] ?? 500) * (TICKETS[ticket] || TICKETS.standard).price)

/* ── TV money, at the start of each season ── */
export const TV_MONEY = [0, 150, 500, 1_500]

export const START_FANS = 75
const NAIRA_PER_UNIT = 10_000

export function newClub(level = 0, seed = 'club') {
  return {
    fans: START_FANS,
    stadium: 0,
    training: 0,
    academy: 0,
    ticket: 'standard',
    sponsor: null,
    offers: sponsorOffers(level, START_FANS, `${seed}:1`),
    ledger: emptyLedger(),
    lastMatch: null,
  }
}

export const emptyLedger = () => ({ gate: 0, prize: 0, sponsor: 0, tv: 0, sales: 0, wages: 0, transfers: 0, facilities: 0 })
export const INCOME = ['gate', 'prize', 'sponsor', 'tv', 'sales']
export const COSTS = ['wages', 'transfers', 'facilities']
export const LEDGER_LABEL = { gate: 'Ticket sales', prize: 'Prize money', sponsor: 'Sponsor', tv: 'TV money', sales: 'Player sales', wages: 'Wages', transfers: 'Transfer fees', facilities: 'Facilities' }

export const ledgerTotals = (l) => {
  const income = INCOME.reduce((a, k) => a + (l?.[k] || 0), 0)
  const costs = COSTS.reduce((a, k) => a + (l?.[k] || 0), 0)
  return { income, costs, profit: income - costs }
}

/** Add amounts to the season's books. */
export const book = (club, entries) => {
  const ledger = { ...emptyLedger(), ...club.ledger }
  for (const [k, v] of Object.entries(entries)) ledger[k] = (ledger[k] || 0) + Math.round(v)
  return { ...club, ledger }
}

/* ── Wages ── */

/** A player's wage per match (units), rising with his value like real wages (a season's wages ≈ two-thirds of his fee). */
// `wageX`: a player who dropped divisions to join you is on higher wages
export const wageOf = (p) => Math.max(1, Math.round((priceOf(p) / 20) * (p?.wageX > 1 ? p.wageX : 1) * 10) / 10)

/** The whole squad's wage bill per match (starters, bench and reserves). */
export const wageBill = (squad, bench = [], reserves = []) => Math.round([...Object.values(squad || {}), ...(bench || []), ...(reserves || [])].reduce((a, p) => a + (p ? wageOf(p) : 0), 0))

/* ── Match day ── */

/** How many come to a home match: fans × how keen they are at this price (and recent form), up to the seats. */
export function attendance(club, form = 0) {
  const t = TICKETS[club.ticket] || TICKETS.standard
  const want = club.fans * t.demand * (1 + Math.max(-0.2, Math.min(0.2, form)))
  return Math.max(0, Math.min(VENUE[club.stadium]?.seats ?? VENUE[0].seats, Math.round(want)))
}

// How many supporters a club in each division can hope to draw (growth slows as you near it)
export const FAN_BASE = [500, 1_500, 3_750, 10_000]

/** Fans after a result: wins bring people in (less as you near your division's fan base), losses lose a few. */
export function fansAfter(fans, outcome, level = 0) {
  const cap = FAN_BASE[level] ?? FAN_BASE[0]
  const room = Math.max(0, cap - fans)
  const next = outcome === 'win' ? fans + Math.max(1, room * 0.06) : outcome === 'draw' ? fans + room * 0.02 : fans * 0.98
  return Math.max(25, Math.round(next))
}

/**
 * The money side of one match: ticket sales if you were at home, the
 * sponsor's payment, and the wage bill. `form` is recent results (−0.2..0.2).
 * Returns { club, lines: { gate, sponsor, wages, prize }, attendance, net }.
 */
export function matchDay(club, { home, outcome, prize, level, wages, form = 0 }) {
  const crowd = home ? attendance(club, form) : 0
  const gate = home ? Math.round((crowd * ticketPrice(level, club.ticket)) / NAIRA_PER_UNIT) : 0
  const s = club.sponsor
  const sponsor = !s ? 0 : s.kind === 'steady' ? s.amount : s.kind === 'win' && outcome === 'win' ? s.amount : 0
  let next = book(club, { gate, sponsor, prize, wages })
  next = { ...next, fans: fansAfter(club.fans, outcome, level), lastMatch: { home, attendance: crowd, gate, sponsor, prize, wages } }
  return { club: next, net: gate + sponsor + prize - wages, attendance: crowd }
}

/* ── Sponsors ── */

/**
 * Three offers for the season: steady money each match, a bonus for each
 * win, or a lump sum up front. Bigger clubs and divisions get better ones.
 */
export function sponsorOffers(level, fans, seed) {
  const rng = seededRng(`sponsor:${seed}`)
  // Grows with the size of the club, but more slowly than the crowd (like real shirt deals)
  const base = (8 + Math.sqrt(Math.max(0, fans)) * 1.2) * (1 + level * 0.6)
  const names = ['Mama Put Foods', 'Okada Express', 'Naija Fizz', 'Bukka Hut Caps', 'Danfo Logistics', 'Jollof Kings', 'Suya Spot', 'Eko Mobile', 'Agege Bread Co', 'Island Telecom']
  const pickName = () => names.splice(Math.floor(rng() * names.length), 1)[0]
  const vary = () => 0.9 + rng() * 0.2
  return [
    { kind: 'steady', name: pickName(), amount: Math.round(base * vary()) },
    { kind: 'win', name: pickName(), amount: Math.round(base * 2.2 * vary()) },
    { kind: 'upfront', name: pickName(), amount: Math.round(base * 9 * vary()) },
  ]
}

/** Sign a sponsor for the season (an up-front deal pays at once). */
export function chooseSponsor(club, index) {
  const offer = club.offers?.[index]
  if (!offer || club.sponsor) return null
  let next = { ...club, sponsor: offer, offers: [] }
  if (offer.kind === 'upfront') next = book(next, { sponsor: offer.amount })
  return { club: next, paid: offer.kind === 'upfront' ? offer.amount : 0 }
}

/* ── Facilities ── */

/** Upgrade a facility one level, if the money's there. Returns { club, cost } or null. */
export function upgrade(club, kind, coins) {
  const lv = club[kind]
  const cost = UPGRADE_COST[kind]?.[lv + 1]
  if (cost == null || coins < cost) return null
  return { club: book({ ...club, [kind]: lv + 1 }, { facilities: cost }), cost }
}

/* ── The season ── */

/** Fans over a season's end: promotion and trophies bring a wave, relegation costs some. `level` is the new division. */
export function fansAfterSeason(fans, outcome, cup, level = 0) {
  let f = fans
  if (outcome === 'promoted') f *= 1.25
  if (outcome === 'champions') f *= 1.1
  if (outcome === 'relegated') f *= 0.85
  if (cup === 'won') f *= 1.1
  // A club can outgrow its division a little, not endlessly
  return Math.max(25, Math.round(Math.min(f, (FAN_BASE[level] ?? FAN_BASE[0]) * 1.2)))
}

/** Club value: the squad's market value plus the ground. */
export function clubValue(squad, bench, club, reserves = []) {
  const players = [...Object.values(squad || {}), ...(bench || []), ...(reserves || [])].reduce((a, p) => a + (p ? priceOf(p) : 0), 0)
  const ground = UPGRADE_COST.stadium.slice(0, (club?.stadium ?? 0) + 1).reduce((a, b) => a + b, 0) + UPGRADE_COST.training.slice(0, (club?.training ?? 0) + 1).reduce((a, b) => a + b, 0) + UPGRADE_COST.academy.slice(0, (club?.academy ?? 0) + 1).reduce((a, b) => a + b, 0)
  return players + ground
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const lvl = (v) => (Number.isInteger(v) && v >= 0 && v <= 4 ? v : 0)

/** Clean up a saved club; careers from before the business side get a fresh one. */
export function sanitizeClub(input, level = 0, seed = 'club') {
  if (!isObj(input)) return newClub(level, seed)
  const num = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  const offer = (o) => isObj(o) && ['steady', 'win', 'upfront'].includes(o.kind) && typeof o.name === 'string' && Number.isFinite(o.amount)
    ? { kind: o.kind, name: o.name.slice(0, 24), amount: Math.max(0, Math.round(o.amount)) } : null
  const ledger = emptyLedger()
  if (isObj(input.ledger)) for (const k of Object.keys(ledger)) ledger[k] = Math.max(0, num(input.ledger[k]))
  return {
    fans: Math.max(25, num(input.fans, START_FANS)),
    stadium: lvl(input.stadium),
    training: lvl(input.training),
    academy: lvl(input.academy),
    ticket: Object.hasOwn(TICKETS, input.ticket) ? input.ticket : 'standard',
    sponsor: offer(input.sponsor),
    offers: Array.isArray(input.offers) ? input.offers.map(offer).filter(Boolean).slice(0, 3) : [],
    ledger,
    // Top division: the pro table finish at Cap Arena
    ...(isFinish(input.finish) ? { finish: input.finish } : {}),
    lastMatch: isObj(input.lastMatch) ? {
      home: !!input.lastMatch.home, attendance: Math.max(0, num(input.lastMatch.attendance)), gate: Math.max(0, num(input.lastMatch.gate)),
      sponsor: Math.max(0, num(input.lastMatch.sponsor)), prize: Math.max(0, num(input.lastMatch.prize)), wages: Math.max(0, num(input.lastMatch.wages)),
    } : null,
  }
}
