/**
 * Career mode: your club starts in the bottom division and plays a season at
 * a time against computer clubs, home and away. Finish high enough to go up,
 * finish bottom and you go down; win the top division to be champions.
 * Alongside the league runs the Cap Cup, an eight-club knockout, and the
 * board sets a target for the season.
 *
 * Pure functions over plain JSON, built on the league engine in tournament.js.
 */
import { createTournament, recordResult, standings, allFixtures, sanitizeTournament, simulateResult, seededRng, readyFixtures, settleCpu, teamById } from './tournament'
import { newClub, sanitizeClub, matchDay, wageBill, book, chooseSponsor, upgrade as upgradeClub, sponsorOffers, fansAfterSeason, ledgerTotals, emptyLedger, TV_MONEY, ACADEMY, TICKETS } from './club'
import { START_COINS, startingSquad, startingBench, sanitizeBench, swapIn, sanitizeSquad, makeYouth, sanitizePlayer, priceOf, sellValue, coinsForResult, seasonBonus, developSeason, openWindow, marketFor, signPlayer, squadRatings, clubRatings, averageRating } from './squad'

export const CAREER_VERSION = 1
// Each season: everyone plays everyone home and away
export const LEGS = 2

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
  return createTournament({ format: 'league', legs: LEGS, teams, matchDuration, now })
}

/* ── The Cap Cup ── */

export const CUP_NAME = 'Cap Cup'
// Each cup round opens once you've played this many league matches: quarter-final, semi-final, final
export const CUP_AFTER = [2, 5, 8]
export const CUP_PRIZE = { won: 250, final: 100, semi: 50, quarter: 0 }
const CUP_ROUNDS = ['quarter', 'semi', 'final']

/**
 * This season's cup: you, three clubs from your division and four from the
 * divisions either side. Returns { tournament, levels } — the division each
 * club comes from (for its ratings and level), by team id.
 */
export function createCup(club, level, matchDuration, season, now = Date.now()) {
  const rng = seededRng(`cup:${club.name}:${season}:${now}`)
  const own = DIVISIONS[level].clubs.slice().sort(() => rng() - 0.5).slice(0, 3).map((c) => ({ c, lv: level }))
  // Four more from the divisions next door: two above and two below, or four from the one neighbour at the ends
  const near = [level + 1, level - 1].filter((l) => l >= 0 && l <= TOP)
  const others = near.flatMap((lv) => DIVISIONS[lv].clubs.slice().sort(() => rng() - 0.5).slice(0, 4 / near.length).map((c) => ({ c, lv })))
  const entrants = [...own, ...others.slice(0, 4)]
  const teams = [
    { ...club, cpu: false },
    ...entrants.map(({ c, lv }) => ({ badge: 'none', finish: 'gloss', ...c, cpu: true, difficulty: DIVISIONS[lv].difficulty })),
  ]
  const tournament = createTournament({ format: 'knockout', teams, matchDuration, rng, now })
  const levels = { [ME]: level }
  entrants.forEach(({ lv }, i) => { levels[`T${i + 2}`] = lv })
  return { tournament: settleCpu(tournament), levels }
}

/** Your next cup tie if it's open to play now, else null. */
export function cupTie(career) {
  const cup = career.cup?.tournament
  if (!cup || cup.championId) return null
  const tie = readyFixtures(cup).find((f) => f.home === ME || f.away === ME)
  if (!tie) return null
  // Once the league season is over, any tie still to play opens straight away
  return playedThisSeason(career.league) >= CUP_AFTER[tie.round] || seasonOver(career.league) ? tie : null
}

/** Your next cup tie whether or not it's open yet, plus after how many league matches it opens. */
export function cupNext(career) {
  const cup = career.cup?.tournament
  if (!cup || cup.championId) return null
  const tie = readyFixtures(cup).find((f) => f.home === ME || f.away === ME)
  return tie ? { tie, opensAfter: CUP_AFTER[tie.round] } : null
}

/** How far you got: 'won' | 'final' | 'semi' | 'quarter' | null (still in). */
export function cupRun(cup) {
  if (!cup) return null
  if (cup.championId === ME) return 'won'
  for (let r = 0; r < cup.rounds.length; r++) {
    const tie = cup.rounds[r].find((t) => t.home === ME || t.away === ME)
    if (tie?.winner && tie.winner !== ME) return CUP_ROUNDS[r] || 'quarter'
    if (!tie?.winner) return null
  }
  return cup.championId ? 'final' : null
}

/** Are you still to play a cup tie this season? */
export function cupPending(career) {
  return !!career.cup && cupRun(career.cup.tournament) == null
}

/** Record your cup result; the other ties in that round play out alongside. */
export function recordCupResult(career, fixtureId, result) {
  const cup = career.cup?.tournament
  if (!cup) return career
  const after = settleCpu(recordResult(cup, fixtureId, result))
  const mine = allFixtures(cup).find((f) => f.id === fixtureId)
  const home = mine?.home === ME
  const gf = home ? result.home : result.away
  const ga = home ? result.away : result.home
  const next = { ...career, cup: { ...career.cup, tournament: after } }
  return mine ? payMatchDay(next, { home, gf, ga }) : next
}

/* ── The board's target ── */

export const TARGETS = {
  title: 'Win the league',
  promotion: `Finish in the top ${2}`,
  topHalf: 'Finish in the top half',
  survive: 'Stay up',
}
export const TARGET_BONUS = { title: 200, promotion: 150, topHalf: 80, survive: 60 }

/** What the board expects, from how your squad compares with the division. */
export function targetFor(level, squad) {
  const mine = averageRating(squadRatings(squad))
  const theirs = Math.round(DIVISIONS[level].clubs.reduce((a, c) => a + averageRating(clubRatings(level, c.name)), 0) / DIVISIONS[level].clubs.length)
  const d = mine - theirs
  if (d >= 3) return level === TOP ? 'title' : 'promotion'
  if (d >= -2) return level === 0 ? 'promotion' : 'topHalf'
  return level === 0 ? 'topHalf' : 'survive'
}

/** Did finishing `pos` of `count` meet the target? */
export function targetMet(target, pos, count = 6) {
  if (target === 'title') return pos === 1
  if (target === 'promotion') return pos <= PROMOTED
  if (target === 'topHalf') return pos <= Math.floor(count / 2)
  if (target === 'survive') return pos <= count - RELEGATED
  return false
}

/** A brand-new career for `club` (a kit: name, colours, badge...). */
export function newCareer(club, { matchDuration = 120, now = Date.now(), squad = null } = {}) {
  const sq = squad ? sanitizeSquad(squad, now) : startingSquad(now)
  return {
    v: CAREER_VERSION,
    club,
    level: 0,
    season: 1,
    matchDuration,
    league: createSeason(club, 0, matchDuration, now),
    cup: createCup(club, 0, matchDuration, 1, now),
    target: targetFor(0, sq),
    cups: 0,
    lastSummer: null,
    past: [],          // finished seasons, newest first
    promotions: 0,
    titles: 0,         // top-division wins
    squad: sq,
    bench: startingBench(now, 0),
    reserves: [],      // up to five more players who train but aren't in the matchday ten
    biz: newClub(0, `${club.name}:${now}`),
    youthOffer: null,
    coins: START_COINS,
    signed: { key: '', ids: [] }, // players already bought in the current window
    lastEarned: 0,
    lastReport: null,
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
  if (spendingFrozen(career)) return null
  const ids = career.signed?.key === w.key ? career.signed.ids : []
  const signed = { key: w.key, ids: [...ids, playerId] }
  // Into the reserves: a free place (no one leaves) or in place of a reserve
  const r = /^reserve(?::(\d))?$/.exec(role || '')
  if (r) {
    const reserves = career.reserves || []
    const i = r[1] == null ? null : Number(r[1])
    const out = i == null ? null : reserves[i]
    if (i == null ? reserves.length >= MAX_RESERVES : !out) return null
    const fee = priceOf(player)
    const back = out ? sellValue(out) : 0
    if ((career.coins ?? 0) + back < fee) return null
    const next = i == null ? [...reserves, { ...player }] : reserves.map((x, j) => (j === i ? { ...player } : x))
    const biz = book(career.biz || newClub(career.level), { transfers: fee, sales: back })
    return { ...career, reserves: next, coins: career.coins + back - fee, biz, signed }
  }
  const deal = signPlayer(career.squad, career.coins, player, role, career.bench)
  if (!deal) return null
  const b = /^bench:(\d)$/.exec(role || '')
  const out = b ? career.bench?.[Number(b[1])] : career.squad?.[role]
  const biz = book(career.biz || newClub(career.level), { transfers: priceOf(player), sales: out ? sellValue(out) : 0 })
  return { ...career, ...deal, bench: deal.bench || career.bench, biz, signed }
}

/** Swap a bench player into the starting six (before a match). Returns the new career, or null. */
export function swapLineup(career, benchIndex, role) {
  const r = swapIn(career.squad, career.bench, benchIndex, role)
  return r ? { ...career, ...r } : null
}

/* ── The whole squad: up to fifteen ── */

export const MATCHDAY = 10   // six start, four on the bench
export const MAX_RESERVES = 5
export const MAX_SQUAD = MATCHDAY + MAX_RESERVES

/** Everyone at the club. */
export const squadSize = (career) => Object.keys(career.squad || {}).length + (career.bench || []).length + (career.reserves || []).length

/** Who is in a slot: 'atk1' (starting six), 'bench:2' or 'reserve:0'. */
function inSlot(career, slot) {
  const b = /^bench:(\d)$/.exec(slot)
  if (b) return career.bench?.[Number(b[1])] || null
  const r = /^reserve:(\d)$/.exec(slot)
  if (r) return career.reserves?.[Number(r[1])] || null
  return career.squad?.[slot] || null
}

function putInSlot(career, slot, p) {
  const b = /^bench:(\d)$/.exec(slot)
  if (b) return { ...career, bench: career.bench.map((x, i) => (i === Number(b[1]) ? p : x)) }
  const r = /^reserve:(\d)$/.exec(slot)
  if (r) return { ...career, reserves: career.reserves.map((x, i) => (i === Number(r[1]) ? p : x)) }
  return { ...career, squad: { ...career.squad, [slot]: p } }
}

/**
 * Bring a reserve into the matchday ten, swapping with a starter or bench
 * player (who drops to the reserves). Keepers swap with keepers.
 */
export function promoteReserve(career, reserveIndex, slot) {
  const from = `reserve:${reserveIndex}`
  const a = inSlot(career, from)
  const b = inSlot(career, slot)
  if (!a || !b || slot.startsWith('reserve:')) return null
  if ((a.pos === 'GK') !== (b.pos === 'GK')) return null
  return putInSlot(putInSlot(career, from, b), slot, a)
}

/** Sell a reserve for his value (any time: it frees up his wages). */
export function sellReserve(career, index) {
  const p = career.reserves?.[index]
  if (!p) return null
  const back = sellValue(p)
  return { ...career, reserves: career.reserves.filter((_, i) => i !== index), coins: (career.coins ?? 0) + back, biz: book(career.biz || newClub(career.level), { sales: back }) }
}

/** Has every fixture of the season been played? */
export function seasonOver(league) {
  return allFixtures(league).every((f) => f.result)
}

/** Recent form for the crowd: your last three results, −0.2..0.2. */
function recentForm(league) {
  const mine = allFixtures(league).filter((f) => f.result && (f.home === ME || f.away === ME)).slice(-3)
  if (!mine.length) return 0
  const pts = mine.map((f) => { const h = f.home === ME; const gf = h ? f.result.home : f.result.away; const ga = h ? f.result.away : f.result.home; return gf > ga ? 1 : gf === ga ? 0 : -1 })
  return (pts.reduce((a, b) => a + b, 0) / mine.length) * 0.2
}

/** The money side of one of your matches (tickets if at home, sponsor, prize money, wages). */
function payMatchDay(career, { home, gf, ga }) {
  if (!Number.isFinite(gf) || !Number.isFinite(ga)) return { ...career, lastEarned: 0 }
  const biz = career.biz || newClub(career.level)
  const outcome = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss'
  const r = matchDay(biz, { home, outcome, prize: coinsForResult(gf, ga, career.level), level: career.level, wages: wageBill(career.squad, career.bench, career.reserves), form: recentForm(career.league) })
  return { ...career, biz: r.club, coins: (career.coins ?? 0) + r.net, lastEarned: r.net }
}

/** In the red: the board freezes transfers and upgrades until the books are back above zero. */
export const spendingFrozen = (career) => (career.coins ?? 0) < 0

/** Choose this season's sponsor (one of three offers). */
export function signSponsor(career, index) {
  const r = chooseSponsor(career.biz, index)
  return r ? { ...career, biz: r.club, coins: (career.coins ?? 0) + r.paid } : null
}

/** Build the next level of a facility (stadium, training, academy). */
export function buildFacility(career, kind) {
  if (spendingFrozen(career)) return null
  const r = upgradeClub(career.biz, kind, career.coins ?? 0)
  return r ? { ...career, biz: r.club, coins: career.coins - r.cost } : null
}

/** Set ticket prices: cheap, standard or premium. */
export function setTickets(career, ticket) {
  if (!Object.hasOwn(TICKETS, ticket)) return null
  return { ...career, biz: { ...career.biz, ticket } }
}

/**
 * Take on this summer's academy graduate: into a free place in the reserves
 * (slot 'reserve'), in place of a reserve ('reserve:i') or bench player (a
 * bench index) who is sold for his value, or let him go (slot null).
 */
export function takeYouth(career, slot) {
  const y = career.youthOffer
  if (!y) return career
  if (slot == null) return { ...career, youthOffer: null }
  if (slot === 'reserve') {
    if ((career.reserves || []).length >= MAX_RESERVES) return null
    return { ...career, reserves: [...(career.reserves || []), y], youthOffer: null }
  }
  const r = /^reserve:(\d)$/.exec(String(slot))
  if (r) {
    const out = career.reserves?.[Number(r[1])]
    if (!out) return null
    const back = sellValue(out)
    return { ...career, reserves: career.reserves.map((p, i) => (i === Number(r[1]) ? y : p)), youthOffer: null, coins: (career.coins ?? 0) + back, biz: book(career.biz, { sales: back }) }
  }
  const out = career.bench?.[slot]
  if (!out || (out.pos === 'GK') !== (y.pos === 'GK')) return null
  const back = sellValue(out)
  return { ...career, bench: career.bench.map((p, i) => (i === slot ? y : p)), youthOffer: null, coins: (career.coins ?? 0) + back, biz: book(career.biz, { sales: back }) }
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
  return mine ? payMatchDay({ ...career, league }, { home, gf, ga }) : { ...career, league }
}

/** Close the finished season and start the next one, in the new division. */
export function finishSeason(career, now = Date.now()) {
  const table = standings(career.league)
  const pos = table.findIndex((r) => r.id === ME) + 1
  const me = table[pos - 1]
  const outcome = outcomeFor(career.level, pos, table.length)
  const level = outcome === 'promoted' ? career.level + 1 : outcome === 'relegated' ? career.level - 1 : career.level
  const target = career.target || null
  const met = target ? targetMet(target, pos, table.length) : false
  // A cup still going (you're out) plays out to the end
  let cupT = career.cup?.tournament || null
  for (let i = 0; cupT && !cupT.championId && i < 8; i++) {
    const t = readyFixtures(cupT).find((f) => f.home !== ME && f.away !== ME)
    if (!t) break
    cupT = settleCpu(recordResult(cupT, t.id, simulateResult(cupT, t, seededRng(`${cupT.id}:${t.id}`))))
  }
  const cup = cupRun(cupT)
  const bonus = seasonBonus(outcome) + (met ? TARGET_BONUS[target] : 0) + (cup ? CUP_PRIZE[cup] : 0)
  const entry = {
    season: career.season,
    division: DIVISIONS[career.level].name,
    level: career.level,
    position: pos,
    outcome,
    bonus,
    target, targetMet: met,
    cup,
    cupWinner: cupT?.championId ? teamById(cupT, cupT.championId)?.name || null : null,
    record: me ? { w: me.w, d: me.d, l: me.l, gf: me.gf, ga: me.ga, pts: me.pts } : null,
    // The season's books (season bonus and prizes included)
    finance: (() => { const l = { ...emptyLedger(), ...(career.biz?.ledger || {}) }; l.prize += bonus; return { ...ledgerTotals(l), ledger: l } })(),
  }
  // The business side of the summer: fans move with the season, TV money for the new division,
  // new sponsor offers, a fresh set of books, and an academy graduate if there's an academy
  const biz0 = career.biz || newClub(career.level)
  const fans = fansAfterSeason(biz0.fans, outcome, cup, level)
  const tv = TV_MONEY[level] ?? 0
  const bizNext = book({ ...biz0, fans, sponsor: null, offers: sponsorOffers(level, fans, `${career.league.id}:${career.season + 1}`), ledger: emptyLedger(), lastMatch: null }, { tv })
  const academy = ACADEMY[biz0.academy || 0]
  const youthRng = seededRng(`academy:${career.league.id}:${career.season}`)
  const youthOffer = academy.pot == null ? null : makeYouth(youthRng, level, ['ATK', 'MID', 'DEF', 'GK'][Math.floor(youthRng() * 4)], academy.pot)
  const summer = developSeason(career.squad || startingSquad(career.season), `${career.league.id}:${career.season}`, level)
  // The bench develops too (and players who never got a game slide a little)
  const benchSummer = developSeason(Object.fromEntries((career.bench || []).map((p, i) => [String(i), p])), `${career.league.id}:${career.season}:bench`, level)
  const bench = (career.bench || []).map((_, i) => benchSummer.squad[String(i)])
  // Reserves develop too; any who retire simply leave (a place opens up)
  const resSummer = developSeason(Object.fromEntries((career.reserves || []).map((p, i) => [String(i), p])), `${career.league.id}:${career.season}:res`, level)
  const gone = new Set(resSummer.retired.map((r) => r.role))
  const reserves = (career.reserves || []).map((_, i) => (gone.has(String(i)) ? null : resSummer.squad[String(i)])).filter(Boolean)
  return {
    ...career,
    level,
    season: career.season + 1,
    league: createSeason(career.club, level, career.matchDuration, now),
    cup: createCup(career.club, level, career.matchDuration, career.season + 1, now),
    target: targetFor(level, summer.squad),
    past: [entry, ...career.past].slice(0, 50),
    promotions: career.promotions + (outcome === 'promoted' ? 1 : 0),
    titles: career.titles + (outcome === 'champions' ? 1 : 0),
    cups: (career.cups || 0) + (cup === 'won' ? 1 : 0),
    coins: (career.coins ?? 0) + bonus + tv,
    biz: bizNext,
    youthOffer,
    squad: summer.squad,
    bench,
    reserves,
    lastSummer: {
      season: career.season + 1,
      retired: [...summer.retired, ...benchSummer.retired, ...resSummer.retired.map((r) => ({ ...r, role: `res${r.role}`, left: true }))],
      changes: [...summer.changes, ...benchSummer.changes, ...resSummer.changes.map((c) => ({ ...c, role: `res${c.role}` }))],
    },
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
    bench: sanitizeBench(input.bench, league.id, level),
    reserves: Array.isArray(input.reserves) ? input.reserves.map((p) => sanitizePlayer(p, { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }[p?.pos] || 'mid')).filter(Boolean).slice(0, MAX_RESERVES) : [],
    coins: Number.isInteger(input.coins) ? input.coins : START_COINS,
    signed: isObj(input.signed) && typeof input.signed.key === 'string' && Array.isArray(input.signed.ids)
      ? { key: input.signed.key.slice(0, 20), ids: input.signed.ids.filter((x) => typeof x === 'string').slice(0, 20) }
      : { key: '', ids: [] },
    lastEarned: Number.isInteger(input.lastEarned) ? input.lastEarned : 0,
    biz: sanitizeClub(input.biz, level, league.id),
    youthOffer: isObj(input.youthOffer) ? sanitizePlayer(input.youthOffer, { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }[input.youthOffer.pos] || 'mid') : null,
    lastReport: sanitizeReport(input.lastReport),
    cup: sanitizeCup(input.cup),
    target: Object.hasOwn(TARGETS, input.target) ? input.target : null,
    cups: n(input.cups),
    lastSummer: isObj(input.lastSummer) ? {
      season: n(input.lastSummer.season),
      retired: Array.isArray(input.lastSummer.retired) ? input.lastSummer.retired.filter(isObj).slice(0, MAX_SQUAD) : [],
      changes: Array.isArray(input.lastSummer.changes) ? input.lastSummer.changes.filter(isObj).slice(0, MAX_SQUAD) : [],
    } : null,
  }
}

function sanitizeCup(c) {
  if (!isObj(c)) return null
  const tournament = sanitizeTournament(c.tournament)
  if (!tournament || tournament.format !== 'knockout') return null
  const levels = {}
  if (isObj(c.levels)) for (const [k, v] of Object.entries(c.levels)) if (/^T\d$/.test(k) && Number.isInteger(v) && v >= 0 && v <= TOP) levels[k] = v
  return { tournament, levels }
}

/** The last match's player ratings (kept for the career screen). */
function sanitizeReport(r) {
  if (!isObj(r)) return null
  const ratings = {}
  if (isObj(r.ratings)) for (const [k, v] of Object.entries(r.ratings)) if (Number.isFinite(v) && v >= 0 && v <= 10) ratings[k] = v
  // Who played (with substitutes): [{ id, rating, goals, role, on, off }]
  const players = Array.isArray(r.players) ? r.players.filter((p) => isObj(p) && typeof p.id === 'string' && Number.isFinite(p.rating)).slice(0, 10).map((p) => ({
    id: p.id.slice(0, 16), rating: Math.max(0, Math.min(10, p.rating)), goals: Number.isInteger(p.goals) && p.goals >= 0 ? p.goals : 0,
    role: typeof p.role === 'string' ? p.role.slice(0, 6) : '', sub: p.sub === 'on' || p.sub === 'off' ? p.sub : null,
  })) : null
  if (!players && !Object.keys(ratings).length) return null
  return {
    fixtureId: String(r.fixtureId || '').slice(0, 12),
    ratings,
    ...(players ? { players, motmId: typeof r.motmId === 'string' ? r.motmId.slice(0, 16) : null } : {}),
    motm: typeof r.motm === 'string' ? r.motm.slice(0, 8) : null,
    changes: Array.isArray(r.changes) ? r.changes.filter(isObj).slice(0, 10) : [],
    goals: isObj(r.goals) ? r.goals : {},
  }
}
