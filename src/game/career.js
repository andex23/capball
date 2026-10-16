/**
 * Career mode: your club starts in the bottom division and plays a season at
 * a time against computer clubs, home and away. Finish high enough to go up,
 * finish bottom and you go down; win the top division to be champions.
 * Alongside the league runs the Cap Cup, an eight-club knockout, and the
 * board sets a target for the season.
 *
 * Pure functions over plain JSON, built on the league engine in tournament.js.
 */
import { isFinish } from '../data/StadiumData'
import { DIVISIONS } from './divisions'
import { createTournament, recordResult, standings, allFixtures, sanitizeTournament, simulateResult, seededRng, readyFixtures, settleCpu, teamById } from './tournament'
import { newClub, sanitizeClub, matchDay, wageBill, book, chooseSponsor, upgrade as upgradeClub, sponsorOffers, fansAfterSeason, ledgerTotals, emptyLedger, TV_MONEY, TICKETS } from './club'
import { START_COINS, startingSquad, startingBench, sanitizeBench, swapIn, sanitizeSquad, sanitizePlayer, coinsForResult, seasonBonus, developSeason, squadRatings, clubPlayers, averageRating } from './squad'
import { seasonAwards, unhappyAfterSeason, contractSummer, repAfterSeason, withContracts, REP_START, sanitizeAwards } from './clubLife'
import { sanitizeStory } from './matchStory'
import { createWorld, sanitizeWorld, worldSummer, clubByName, clubOvr, sixFor, cleanNews } from './world'
import {
  playedThisSeason, transferWindow, spendingFrozen, squadSize, squadFull, promoteReserve, squadSummer, youthIntake,
  sanitizeLoans, sanitizeYouth, sanitizeTalks, sanitizeDeals, MATCHDAY, MAX_RESERVES, MAX_SQUAD, YOUTH_MAX,
} from './transfers'

export { playedThisSeason, transferWindow, spendingFrozen, squadSize, squadFull, promoteReserve, MATCHDAY, MAX_RESERVES, MAX_SQUAD, YOUTH_MAX }

export const CAREER_VERSION = 1
// Each season: everyone plays everyone home and away
export const LEGS = 2

export { DIVISIONS }

export const TOP = DIVISIONS.length - 1
// Top two of a division go up; the bottom club goes down
export const PROMOTED = 2
export const RELEGATED = 1
export const ME = 'T1'

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

/** A new season's league for the club in division `level`. */
export function createSeason(club, level, matchDuration = 120, now = Date.now(), world = null) {
  const div = DIVISIONS[level]
  const teams = [
    { ...club, cpu: false },
    ...div.clubs.map((c) => ({ badge: 'none', finish: 'gloss', ...c, cpu: true, difficulty: div.difficulty, ...ovrField(world, c.name) })),
  ]
  return createTournament({ format: 'league', legs: LEGS, teams, matchDuration, now })
}

/** A computer club's OVR from the world, for simulated results (stronger clubs win more). */
function ovrField(world, name) {
  const c = clubByName(world, name)
  return c ? { ovr: clubOvr(c) } : {}
}

/** A computer club's best six (by role) for a match: from the world, or made up for older saves. */
export function opponentSix(career, name, level = career?.level ?? 0) {
  return sixFor(career?.world, name) || clubPlayers(level, name)
}

/** A computer club's OVR. */
export function opponentOvr(career, name, level) {
  return averageRating(squadRatings(opponentSix(career, name, level)))
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
export function createCup(club, level, matchDuration, season, now = Date.now(), world = null) {
  const rng = seededRng(`cup:${club.name}:${season}:${now}`)
  const own = DIVISIONS[level].clubs.slice().sort(() => rng() - 0.5).slice(0, 3).map((c) => ({ c, lv: level }))
  // Four more from the divisions next door: two above and two below, or four from the one neighbour at the ends
  const near = [level + 1, level - 1].filter((l) => l >= 0 && l <= TOP)
  const others = near.flatMap((lv) => DIVISIONS[lv].clubs.slice().sort(() => rng() - 0.5).slice(0, 4 / near.length).map((c) => ({ c, lv })))
  const entrants = [...own, ...others.slice(0, 4)]
  const teams = [
    { ...club, cpu: false },
    ...entrants.map(({ c, lv }) => ({ badge: 'none', finish: 'gloss', ...c, cpu: true, difficulty: DIVISIONS[lv].difficulty, ...ovrField(world, c.name) })),
  ]
  const tournament = createTournament({ format: 'knockout', teams, matchDuration, rng, now })
  const levels = { [ME]: level }
  entrants.forEach(({ lv }, i) => { levels[`T${i + 2}`] = lv })
  // The other ties are played alongside yours (recordCupResult), not before the round opens
  return { tournament, levels }
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

/**
 * Your next match in the season's calendar: a cup tie on its date comes
 * first (the league waits until it's played), otherwise the next league
 * match. { kind: 'cup' | 'league', fixture } or null when nothing is left.
 */
export function careerNext(career) {
  if (!career?.league) return null
  const tie = cupTie(career)
  if (tie) return { kind: 'cup', fixture: tie }
  const f = nextMatch(career.league)
  return f ? { kind: 'league', fixture: f } : null
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
  promotion: `Get promoted: finish in the top ${PROMOTED}`,
  topHalf: 'Finish in the top half (top 3)',
  survive: 'Stay up',
  notLast: 'Don’t finish bottom',
}
export const TARGET_BONUS = { title: 200, promotion: 150, topHalf: 80, survive: 60, notLast: 40 }

/**
 * What the board expects: promotion every season until you reach the top
 * division, then the title. Miss it once and you get a final warning; miss
 * it again before you meet one and you're sacked: the career is over.
 */
export function targetFor(level) {
  return level >= TOP ? 'title' : 'promotion'
}

/** Where your squad ranks on OVR among the division's clubs (1 = strongest). */
export function squadRank(level, squad, world = null) {
  const mine = averageRating(squadRatings(squad))
  const theirs = DIVISIONS[level].clubs.map((c) => averageRating(squadRatings(sixFor(world, c.name) || clubPlayers(level, c.name))))
  return 1 + theirs.filter((o) => o > mine).length
}

/** Did finishing `pos` of `count` meet the target? */
export function targetMet(target, pos, count = 6) {
  if (target === 'title') return pos === 1
  if (target === 'promotion') return pos <= PROMOTED
  if (target === 'topHalf') return pos <= Math.floor(count / 2)
  if (target === 'survive') return pos <= count - RELEGATED
  if (target === 'notLast') return pos < count
  return false
}

/** A brand-new career for `club` (a kit: name, colours, badge...). */
/** How a career is played: on your own against the computer, or against a friend online or over LAN. */
export const CAREER_MODES = ['solo', 'online', 'lan']
/** The computer's level in career matches: by division (auto), or fixed. */
export const CAREER_DIFFICULTIES = ['auto', 'easy', 'medium', 'hard']

export function newCareer(club, { matchDuration = 120, now = Date.now(), squad = null, mode = 'solo' } = {}) {
  const sq = squad ? sanitizeSquad(squad, now) : startingSquad(now)
  const world = createWorld(`${club.name}:${now}`)
  return {
    v: CAREER_VERSION,
    club,
    mode: CAREER_MODES.includes(mode) ? mode : 'solo',
    difficulty: 'auto', // the computer's level: 'auto' (harder each division up) or fixed
    level: 0,
    season: 1,
    matchDuration,
    world,             // every computer club's squad, and the free agents
    league: createSeason(club, 0, matchDuration, now, world),
    cup: createCup(club, 0, matchDuration, 1, now, world),
    target: targetFor(0),
    cups: 0,
    lastSummer: null,
    past: [],          // finished seasons, newest first
    promotions: 0,
    titles: 0,         // top-division wins
    squad: Object.fromEntries(withContracts(Object.entries(sq).map(([r, p]) => ({ ...p, _role: r })), `${now}:six`).map(({ _role, ...p }) => [_role, p])),
    bench: withContracts(startingBench(now, 0), `${now}:bench`),
    reserves: [],      // up to five more players who train but aren't in the matchday ten
    loans: [],         // your players out on loan until the summer
    youthTeam: youthIntake(0, 0, `${now}:start`, 2),
    biz: newClub(0, `${club.name}:${now}`),
    coins: START_COINS,
    talks: null,       // bids made in the current window
    deals: [],         // your recent transfers
    lastEarned: 0,
    lastReport: null,
    lastMatch: null,   // the matchday report: result, commentary, the round
    warning: false,    // missed a target: the next miss is the sack
    rep: REP_START,    // your name as a manager (0–100)
    scouted: [],       // players whose potential your scouts have checked
    rejected: null,    // offers for your players you've turned down this window
    sacked: null,      // set when the board sacks you: the career is over
  }
}

/** Swap a bench player into the starting six (before a match). Returns the new career, or null. */
export function swapLineup(career, benchIndex, role) {
  const r = swapIn(career.squad, career.bench, benchIndex, role)
  return r ? { ...career, ...r } : null
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

/** Top division only: pick the pro table your home matches at Cap Arena are played on. */
export function setTableFinish(career, finish) {
  if (career.level !== TOP || !isFinish(finish)) return null
  return { ...career, biz: { ...career.biz, finish } }
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
  // Before the summer resets the season's stats: the club's awards, and who's unhappy
  const awards = seasonAwards(career)
  const unhappy = unhappyAfterSeason(career, level)
  const bonus = seasonBonus(outcome) + (met ? TARGET_BONUS[target] : 0) + (cup ? CUP_PRIZE[cup] : 0)
  const entry = {
    season: career.season,
    division: DIVISIONS[career.level].name,
    level: career.level,
    position: pos,
    outcome,
    bonus,
    target, targetMet: met, warned: !!target && !met && !career.warning,
    awards,
    cup,
    cupWinner: cupT?.championId ? teamById(cupT, cupT.championId)?.name || null : null,
    record: me ? { w: me.w, d: me.d, l: me.l, gf: me.gf, ga: me.ga, pts: me.pts } : null,
    // The season's books (season bonus and prizes included)
    finance: (() => { const l = { ...emptyLedger(), ...(career.biz?.ledger || {}) }; l.prize += bonus; return { ...ledgerTotals(l), ledger: l } })(),
  }
  // Missed the board's target on a final warning: sacked. The season goes in the record books and the career ends here.
  if (target && !met && career.warning) {
    return {
      ...career,
      cup: career.cup ? { ...career.cup, tournament: cupT } : career.cup,
      past: [{ ...entry, sacked: true }, ...career.past].slice(0, 50),
      cups: (career.cups || 0) + (cup === 'won' ? 1 : 0),
      sacked: { season: career.season, division: DIVISIONS[career.level].name, position: pos, target },
    }
  }
  // The business side of the summer: fans move with the season, TV money for the new division,
  // new sponsor offers and a fresh set of books
  const biz0 = career.biz || newClub(career.level)
  const fans = fansAfterSeason(biz0.fans, outcome, cup, level)
  const tv = TV_MONEY[level] ?? 0
  const bizNext = book({ ...biz0, fans, sponsor: null, offers: sponsorOffers(level, fans, `${career.league.id}:${career.season + 1}`), ledger: emptyLedger(), lastMatch: null }, { tv })
  const summer = developSeason(career.squad || startingSquad(career.season), `${career.league.id}:${career.season}`, level)
  // The bench develops too (and players who never got a game slide a little)
  const benchSummer = developSeason(Object.fromEntries((career.bench || []).map((p, i) => [String(i), p])), `${career.league.id}:${career.season}:bench`, level)
  const bench = (career.bench || []).map((_, i) => benchSummer.squad[String(i)])
  // Reserves develop too; any who retire simply leave (a place opens up)
  const resSummer = developSeason(Object.fromEntries((career.reserves || []).map((p, i) => [String(i), p])), `${career.league.id}:${career.season}:res`, level)
  const gone = new Set(resSummer.retired.map((r) => r.role))
  const reserves = (career.reserves || []).map((_, i) => (gone.has(String(i)) ? null : resSummer.squad[String(i)])).filter(Boolean)
  // The rest of the world moves on: development, retirements, clubs buying and selling
  const seed = `${career.league.id}:${career.season}`
  const ws = worldSummer(career.world || createWorld(career.league.id), seed)
  // Your loans come back, the youth team grows and the academy sends up its graduates
  const sq = squadSummer({ ...career, world: ws.world, reserves }, { level, seed })
  const world = sq.career.world
  const next = {
    ...career,
    level,
    season: career.season + 1,
    world,
    league: createSeason(career.club, level, career.matchDuration, now, world),
    cup: createCup(career.club, level, career.matchDuration, career.season + 1, now, world),
    target: targetFor(level),
    past: [entry, ...career.past].slice(0, 50),
    promotions: career.promotions + (outcome === 'promoted' ? 1 : 0),
    titles: career.titles + (outcome === 'champions' ? 1 : 0),
    cups: (career.cups || 0) + (cup === 'won' ? 1 : 0),
    coins: (career.coins ?? 0) + bonus + tv,
    biz: bizNext,
    squad: summer.squad,
    bench,
    reserves: sq.career.reserves,
    loans: [],
    youthTeam: sq.career.youthTeam,
    talks: null,
    lastSummer: {
      season: career.season + 1,
      retired: [...summer.retired, ...benchSummer.retired, ...resSummer.retired.map((r) => ({ ...r, role: `res${r.role}`, left: true }))],
      changes: [...summer.changes, ...benchSummer.changes, ...resSummer.changes.map((c) => ({ ...c, role: `res${c.role}` }))],
      loansBack: sq.loansBack.map((p) => ({ name: p.name, rating: p.rating })),
      youthIn: sq.youthIn.map((p) => ({ name: p.name, pos: p.pos, rating: p.rating })),
      youthOut: sq.youthOut.map((p) => ({ name: p.name })),
      world: ws.news.slice(0, 8),
    },
    lastEarned: 0,
    // Missing the target earns a final warning; meeting one clears it
    warning: !!target && !met,
    // Your name as a manager: trophies and promotions build it
    rep: repAfterSeason(career.rep ?? REP_START, { outcome, met, cup }),
    rejected: null,
  }
  // Contracts run down: expired deals leave on a free; unhappy players want out
  const cs = contractSummer(next, { level, seed, unhappy })
  return { ...cs.career, lastSummer: { ...next.lastSummer, left: cs.left, unhappy: cs.unhappy } }
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
    mode: CAREER_MODES.includes(input.mode) ? input.mode : 'solo',
    difficulty: CAREER_DIFFICULTIES.includes(input.difficulty) ? input.difficulty : 'auto',
    level,
    season: Math.max(1, n(input.season)),
    matchDuration: [60, 90, 120, 150, 180].includes(input.matchDuration) ? input.matchDuration : 120,
    league,
    past: Array.isArray(input.past) ? input.past.filter(isObj).slice(0, 50).map((e) => (e.awards ? { ...e, awards: sanitizeAwards(e.awards) } : e)) : [],
    promotions: n(input.promotions),
    titles: n(input.titles),
    // Careers from before the squad existed get a starting squad and purse
    squad: sanitizeSquad(input.squad, league.id),
    bench: sanitizeBench(input.bench, league.id, level),
    // Returning loans can push the reserves past five for a while (no signings until you're back to fifteen)
    reserves: Array.isArray(input.reserves) ? input.reserves.map((p) => sanitizePlayer(p, { GK: 'gk', DEF: 'def1', MID: 'mid', ATK: 'atk1' }[p?.pos] || 'mid')).filter(Boolean).slice(0, MAX_SQUAD) : [],
    loans: sanitizeLoans(input.loans),
    youthTeam: sanitizeYouth(input.youthTeam) ?? youthIntake(level, 0, `${league.id}:start`, 2),
    world: sanitizeWorld(input.world, league.id),
    talks: sanitizeTalks(input.talks),
    deals: sanitizeDeals(input.deals),
    coins: Number.isInteger(input.coins) ? input.coins : START_COINS,
    lastEarned: Number.isInteger(input.lastEarned) ? input.lastEarned : 0,
    biz: sanitizeClub(input.biz, level, league.id),
    lastReport: sanitizeReport(input.lastReport),
    lastMatch: sanitizeLastMatch(input.lastMatch),
    warning: input.warning === true,
    rep: Number.isInteger(input.rep) ? Math.max(0, Math.min(100, input.rep)) : REP_START,
    scouted: Array.isArray(input.scouted) ? input.scouted.filter((x) => typeof x === 'string').map((x) => x.slice(0, 16)).slice(-400) : [],
    rejected: isObj(input.rejected) && typeof input.rejected.key === 'string' && Array.isArray(input.rejected.ids)
      ? { key: input.rejected.key.slice(0, 20), ids: input.rejected.ids.filter((x) => typeof x === 'string').slice(-30) } : null,
    sacked: isObj(input.sacked) ? {
      season: n(input.sacked.season), division: String(input.sacked.division || '').slice(0, 30),
      position: n(input.sacked.position), target: Object.hasOwn(TARGETS, input.sacked.target) ? input.sacked.target : 'promotion',
    } : null,
    cup: sanitizeCup(input.cup),
    target: Object.hasOwn(TARGETS, input.target) ? input.target : null,
    cups: n(input.cups),
    lastSummer: isObj(input.lastSummer) ? {
      season: n(input.lastSummer.season),
      retired: Array.isArray(input.lastSummer.retired) ? input.lastSummer.retired.filter(isObj).slice(0, MAX_SQUAD) : [],
      changes: Array.isArray(input.lastSummer.changes) ? input.lastSummer.changes.filter(isObj).slice(0, MAX_SQUAD) : [],
      loansBack: Array.isArray(input.lastSummer.loansBack) ? input.lastSummer.loansBack.filter(isObj).slice(0, MAX_SQUAD) : [],
      youthIn: Array.isArray(input.lastSummer.youthIn) ? input.lastSummer.youthIn.filter(isObj).slice(0, YOUTH_MAX) : [],
      youthOut: Array.isArray(input.lastSummer.youthOut) ? input.lastSummer.youthOut.filter(isObj).slice(0, YOUTH_MAX) : [],
      world: Array.isArray(input.lastSummer.world) ? input.lastSummer.world.filter(isObj).slice(0, 8).map(cleanNews) : [],
      left: Array.isArray(input.lastSummer.left) ? input.lastSummer.left.filter((x) => typeof x === 'string').slice(0, MAX_SQUAD) : [],
      unhappy: Array.isArray(input.lastSummer.unhappy) ? input.lastSummer.unhappy.filter((x) => typeof x === 'string').slice(0, MAX_SQUAD) : [],
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

/** The last matchday report (result, written commentary, which round). */
function sanitizeLastMatch(m) {
  if (!isObj(m) || typeof m.fixtureId !== 'string' || !isObj(m.result)) return null
  const goals = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, 99) : 0)
  return {
    fixtureId: m.fixtureId.slice(0, 12),
    competition: m.competition === 'cup' ? 'cup' : 'league',
    round: Number.isInteger(m.round) ? m.round : 0,
    home: String(m.home || '').slice(0, 4),
    away: String(m.away || '').slice(0, 4),
    result: { home: goals(m.result.home), away: goals(m.result.away), ...(isObj(m.result.pens) ? { pens: { home: goals(m.result.pens.home), away: goals(m.result.pens.away) } } : {}) },
    story: sanitizeStory(m.story),
    seen: m.seen === true,
    season: Number.isInteger(m.season) ? m.season : 1,
  }
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
