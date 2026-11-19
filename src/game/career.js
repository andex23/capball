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
import { legendById } from '../data/Legends'
import { isDerby, noteHeadToHead, sanitizeH2h, DERBY_PRIZE, DERBY_CROWD } from './rivals'
import { jobOfferFor, takeJob, declineJob, sanitizeOffer, sanitizeJobs } from './jobs'
import { createCcl, cclTie, cclRun, recordCclResult, finishKnockout, sanitizeCcl, cclStage, CCL_AFTER, CCL_NAME } from './championsLeague'
export { CCL_NAME }
import { sanitizeExtras } from './matchReport'
import { createWorld, sanitizeWorld, worldSummer, clubByName, clubOvr, sixFor, cleanNews, clubsIn } from './world'
import {
  playedThisSeason, transferWindow, spendingFrozen, squadSize, squadFull, promoteReserve, squadSummer, youthIntake,
  sanitizeLoans, sanitizeYouth, sanitizeTalks, sanitizeDeals, MATCHDAY, MAX_RESERVES, MAX_SQUAD, YOUTH_MAX,
} from './transfers'

export { playedThisSeason, transferWindow, spendingFrozen, squadSize, squadFull, promoteReserve, MATCHDAY, MAX_RESERVES, MAX_SQUAD, YOUTH_MAX }

// 2: a fifth division (the Street League) went in at the bottom, so every division number moved up one
export const CAREER_VERSION = 2
// Each season: everyone plays everyone home and away
export const LEGS = 2

export { DIVISIONS }

export const TOP = DIVISIONS.length - 1
// Top two of a division go up; the bottom two go down
export const PROMOTED = 2
export const RELEGATED = 2
export const ME = 'T1'

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

/** A new season's league for the club in division `level`. */
export function createSeason(club, level, matchDuration = 120, now = Date.now(), world = null) {
  const div = DIVISIONS[level]
  const teams = [
    { ...club, cpu: false },
    ...clubsIn(world, level).map((c) => ({ badge: 'none', finish: 'gloss', ...c, cpu: true, difficulty: div.difficulty, ...ovrField(world, c.name) })),
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
export const CUP_AFTER = [3, 7, 11]
export const CUP_PRIZE = { won: 250, final: 100, semi: 50, quarter: 0 }
const CUP_ROUNDS = ['quarter', 'semi', 'final']

/**
 * This season's cup: you, three clubs from your division and four from the
 * divisions either side. Returns { tournament, levels } — the division each
 * club comes from (for its ratings and level), by team id.
 */
export function createCup(club, level, matchDuration, season, now = Date.now(), world = null) {
  const rng = seededRng(`cup:${club.name}:${season}:${now}`)
  const own = clubsIn(world, level).slice().sort(() => rng() - 0.5).slice(0, 3).map((c) => ({ c, lv: level }))
  // Four more from the divisions next door: two above and two below, or four from the one neighbour at the ends
  const near = [level + 1, level - 1].filter((l) => l >= 0 && l <= TOP)
  const others = near.flatMap((lv) => clubsIn(world, lv).slice().sort(() => rng() - 0.5).slice(0, 4 / near.length).map((c) => ({ c, lv })))
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

/* ── The season's calendar ──
   Game dates, not real ones (as in FIFA or Football Manager): the league plays
   on Saturdays from early August, one round a week, and each cup round on the
   Wednesday after the league matchday that opens it. Playing your match moves
   the calendar on to your next date, so no two of your matches share a day. */
const FIRST_SEASON = 2026

/** Saturday of league round 0 in this season (the first Saturday of August). */
export function seasonStart(season = 1) {
  const d = new Date(Date.UTC(FIRST_SEASON + Math.max(1, season | 0) - 1, 7, 1))
  d.setUTCDate(1 + ((6 - d.getUTCDay() + 7) % 7))
  return d
}

const addDays = (d, n) => new Date(d.getTime() + n * 86400000)

/** The date of a league fixture (by its round). */
export function leagueDate(career, fixture) {
  return addDays(seasonStart(career?.season), 7 * (fixture?.round || 0))
}

/** The date of a cup round: the Wednesday after the league matchday it waits for. */
export function cupDate(career, round) {
  const mine = allFixtures(career.league).filter((f) => f.home === ME || f.away === ME).sort((a, b) => a.round - b.round)
  const after = CUP_AFTER[round] ?? CUP_AFTER[CUP_AFTER.length - 1]
  const anchor = mine[Math.min(after, mine.length) - 1]
  // Past the end of the league season: a week on for each matchday it's short
  const extra = Math.max(0, after - mine.length)
  return addDays(anchor ? leagueDate(career, anchor) : seasonStart(career.season), 4 + 7 * extra)
}

/** A Champions League night: the Tuesday after the league matchday it waits for. */
export function cclDate(career, fixture) {
  const after = career.ccl?.knockout ? (fixture.round === 0 ? CCL_AFTER.semi : CCL_AFTER.final) : CCL_AFTER.group[fixture.round] ?? CCL_AFTER.group.at(-1)
  const mine = allFixtures(career.league).filter((f) => f.home === ME || f.away === ME).sort((a, b) => a.round - b.round)
  const anchor = mine[Math.min(after, mine.length) - 1]
  const extra = Math.max(0, after - mine.length)
  return addDays(anchor ? leagueDate(career, anchor) : seasonStart(career.season), 3 + 7 * extra)
}

/**
 * The tournament a fixture of yours belongs to: the league, the Cap Cup, or the
 * Champions League (its group, or the knockout once drawn).
 */
export function compOf(career, competition, fixtureId = null) {
  if (competition === 'cup') return career?.cup?.tournament || null
  if (competition === 'ccl') {
    const c = career?.ccl
    if (!c) return null
    return [c.knockout, c.groups?.[0]].find((t) => t && (!fixtureId || allFixtures(t).some((f) => f.id === fixtureId))) || cclStage(c)
  }
  return career?.league || null
}

/** "Cap Champions League · Group A" or "… · Semi-final": what a Champions League fixture is. */
export function cclLabel(career, fixtureId) {
  const t = compOf(career, 'ccl', fixtureId)
  if (!t) return CCL_NAME
  if (t.format === 'league') return `${CCL_NAME} · Group A`
  const f = allFixtures(t).find((x) => x.id === fixtureId)
  return `${CCL_NAME} · ${f?.round === 1 ? 'Final' : 'Semi-final'}`
}

/** Are you still to play a Champions League match this season? */
export function cclPending(career) {
  return !!career.ccl && cclRun(career.ccl) == null
}

/** Record your Champions League result: the rest of the stage plays alongside, and prize money comes in. */
export function recordCclMatch(career, fixtureId, result, now = Date.now()) {
  const t = cclStage(career.ccl)
  const mine = t ? allFixtures(t).find((f) => f.id === fixtureId) : null
  if (!mine) return career
  const r = recordCclResult(career.ccl, fixtureId, result, now)
  const home = mine.home === ME
  const gf = home ? result.home : result.away
  const ga = home ? result.away : result.home
  const other = teamById(t, home ? mine.away : mine.home)?.name
  let next = payMatchDay(noteHeadToHead({ ...career, ccl: r.ccl }, other, gf, ga), { home, gf, ga })
  if (r.prize) next = { ...next, biz: book(next.biz, { prize: r.prize }), coins: next.coins + r.prize, lastEarned: next.lastEarned + r.prize }
  return next
}

/** The date of your next match: the career's "today". null when nothing is left. */
export function careerDate(career) {
  const due = careerNext(career)
  if (!due) return null
  if (due.kind === 'ccl') return cclDate(career, due.fixture)
  return due.kind === 'cup' ? cupDate(career, due.fixture.round) : leagueDate(career, due.fixture)
}

/** "Sat 4 Oct 2026" (or without the year). */
export function formatGameDate(d, { year = true } = {}) {
  if (!d) return ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  return `${day} ${d.getUTCDate()} ${month}${year ? ` ${d.getUTCFullYear()}` : ''}`
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
  const ccl = cclTie(career.ccl, playedThisSeason(career.league), seasonOver(career.league))
  if (ccl) return { kind: 'ccl', fixture: ccl }
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
  if (!mine) return next
  const other = teamById(cup, home ? mine.away : mine.home)?.name
  return payMatchDay(noteHeadToHead(next, other, gf, ga), { home, gf, ga, derby: isDerby(career, cup, mine) })
}

/* ── The board's target ── */

export const TARGETS = {
  title: 'Win the league',
  promotion: `Get promoted: finish in the top ${PROMOTED}`,
  topHalf: 'Finish in the top half',
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
  const theirs = clubsIn(world, level).map((c) => averageRating(squadRatings(sixFor(world, c.name) || clubPlayers(level, c.name))))
  return 1 + theirs.filter((o) => o > mine).length
}

/** Did finishing `pos` of `count` meet the target? */
export function targetMet(target, pos, count = 8) {
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
    legendSignings: [],
    scoutCredits: 0,
    scouted: [],       // players whose potential your scouts have checked
    rejected: null,    // offers for your players you've turned down this window
    sacked: null,      // set when the board sacks you: the career is over
    ccl: null,         // this season's Cap Champions League, when you qualified
    cclTitles: 0,
    jobOffer: null,    // a club that wants you as manager: { name, level, reason }
    lastMove: 0,       // the season you last changed clubs
    jobs: [],          // clubs you've moved between
    h2h: {},           // head to head with every club you've played: { name: { w, d, l } }
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
function payMatchDay(career, { home, gf, ga, derby = false }) {
  if (!Number.isFinite(gf) || !Number.isFinite(ga)) return { ...career, lastEarned: 0 }
  const biz = career.biz || newClub(career.level)
  const outcome = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss'
  const prize = coinsForResult(gf, ga, career.level) * (derby && outcome === 'win' ? DERBY_PRIZE : 1)
  const r = matchDay(biz, { home, outcome, prize, level: career.level, wages: wageBill(career.squad, career.bench, career.reserves), form: recentForm(career.league), crowdBoost: derby ? DERBY_CROWD : 1 })
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

/** Your season so far in the league: matches won, goals scored, clean sheets. */
export function seasonRecord(league) {
  let w = 0; let gf = 0; let cs = 0
  for (const f of allFixtures(league)) {
    if (!f.result || (f.home !== ME && f.away !== ME)) continue
    const h = f.home === ME
    const mine = h ? f.result.home : f.result.away
    const theirs = h ? f.result.away : f.result.home
    if (mine > theirs) w++
    gf += mine
    if (theirs === 0) cs++
  }
  return { w, gf, cs }
}

/** Your league position (1-based). */
export function myPosition(league) {
  return standings(league).findIndex((r) => r.id === ME) + 1
}

/** What finishing `pos` of `count` in division `level` means. */
export function outcomeFor(level, pos, count = 8) {
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
  if (!mine) return { ...career, league }
  const other = teamById(career.league, home ? mine.away : mine.home)?.name
  const derby = isDerby(career, career.league, mine)
  return payMatchDay(noteHeadToHead({ ...career, league }, other, gf, ga), { home, gf, ga, derby })
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
  // The Champions League, if you were in it: whatever's left plays out
  const cclT = career.ccl ? (cclRun(career.ccl) === 'won' ? career.ccl : finishKnockout(career.ccl)) : null
  const ccl = cclT ? (cclRun(cclT) || 'group') : null
  // Top two in the top division (and staying there): into next season's Champions League
  const qualified = career.level === TOP && pos <= 2 && level === TOP
  // Before the summer resets the season's stats: the club's awards, and who's unhappy
  const awards = seasonAwards(career)
  const unhappy = unhappyAfterSeason(career, level)
  const bonus = seasonBonus(outcome) + (met ? TARGET_BONUS[target] : 0) + (cup ? CUP_PRIZE[cup] : 0)
  const entry = {
    season: career.season,
    club: career.club?.name || null,
    division: DIVISIONS[career.level].name,
    level: career.level,
    position: pos,
    outcome,
    bonus,
    target, targetMet: met, warned: !!target && !met && !career.warning,
    awards,
    cup,
    cupWinner: cupT?.championId ? teamById(cupT, cupT.championId)?.name || null : null,
    ...(ccl ? { ccl } : {}),
    ...(qualified ? { qualified: true } : {}),
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
      // A smaller club may still want you
      jobOffer: jobOfferFor(career, { outcome, level, cup, sacked: true }),
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
    cclTitles: (career.cclTitles || 0) + (ccl === 'won' ? 1 : 0),
    ccl: qualified ? createCcl(career.club, level, career.matchDuration, career.season + 1, now, world) : null,
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
      youthIn: sq.youthIn.map((p) => ({ name: p.name, pos: p.pos, rating: p.rating, age: p.age, pot: p.pot })),
      youthOut: sq.youthOut.map((p) => ({ name: p.name })),
      world: ws.news.slice(0, 8),
      seen: false,
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
  // A big season and a bigger club may call
  const jobOffer = jobOfferFor(career, { outcome, level, cup, world })
  return { ...cs.career, jobOffer, lastSummer: { ...next.lastSummer, left: cs.left, unhappy: cs.unhappy } }
}

/** Take the job you've been offered: their club, squad, division and budget; your records come with you. */
export function acceptJob(career, now = Date.now()) {
  return takeJob(career, { createSeason, createCup, targetFor }, now)
}

/** Turn the job down and stay. */
export function stayPut(career) {
  return declineJob(career)
}

/** Load a saved career, or null if it's missing or unreadable. */
export function sanitizeCareer(input) {
  if (isObj(input) && input.v === 1) input = fromV1(input)
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
    legendSignings: Array.isArray(input.legendSignings) ? input.legendSignings.filter((id) => legendById(id)).slice(0, 12) : [],
    coins: Number.isInteger(input.coins) ? input.coins : START_COINS,
    lastEarned: Number.isInteger(input.lastEarned) ? input.lastEarned : 0,
    biz: sanitizeClub(input.biz, level, league.id),
    lastReport: sanitizeReport(input.lastReport),
    lastMatch: sanitizeLastMatch(input.lastMatch),
    warning: input.warning === true,
    // The day the last career match was played (one a day)
    rep: Number.isInteger(input.rep) ? Math.max(0, Math.min(100, input.rep)) : REP_START,
    scoutCredits: Number.isSafeInteger(input.scoutCredits) ? Math.max(0, input.scoutCredits) : 0,
    scouted: Array.isArray(input.scouted) ? input.scouted.filter((x) => typeof x === 'string').map((x) => x.slice(0, 16)).slice(-400) : [],
    rejected: isObj(input.rejected) && typeof input.rejected.key === 'string' && Array.isArray(input.rejected.ids)
      ? { key: input.rejected.key.slice(0, 20), ids: input.rejected.ids.filter((x) => typeof x === 'string').slice(-30) } : null,
    sacked: isObj(input.sacked) ? {
      season: n(input.sacked.season), division: String(input.sacked.division || '').slice(0, 30),
      position: n(input.sacked.position), target: Object.hasOwn(TARGETS, input.sacked.target) ? input.sacked.target : 'promotion',
    } : null,
    cup: sanitizeCup(input.cup),
    h2h: sanitizeH2h(input.h2h),
    ccl: sanitizeCcl(input.ccl),
    cclTitles: n(input.cclTitles),
    jobOffer: sanitizeOffer(input.jobOffer),
    lastMove: Number.isInteger(input.lastMove) && input.lastMove >= 0 ? input.lastMove : 0,
    jobs: sanitizeJobs(input.jobs),
    target: Object.hasOwn(TARGETS, input.target) ? input.target : null,
    cups: n(input.cups),
    lastSummer: isObj(input.lastSummer) ? {
      season: n(input.lastSummer.season),
      retired: Array.isArray(input.lastSummer.retired) ? input.lastSummer.retired.filter(isObj).slice(0, MAX_SQUAD) : [],
      changes: Array.isArray(input.lastSummer.changes) ? input.lastSummer.changes.filter(isObj).slice(0, MAX_SQUAD) : [],
      loansBack: Array.isArray(input.lastSummer.loansBack) ? input.lastSummer.loansBack.filter(isObj).slice(0, MAX_SQUAD) : [],
      youthIn: Array.isArray(input.lastSummer.youthIn) ? input.lastSummer.youthIn.filter(isObj).slice(0, YOUTH_MAX) : [],
      // The summer review has been shown (it opens once, when the new season starts)
      seen: input.lastSummer.seen === true,
      youthOut: Array.isArray(input.lastSummer.youthOut) ? input.lastSummer.youthOut.filter(isObj).slice(0, YOUTH_MAX) : [],
      world: Array.isArray(input.lastSummer.world) ? input.lastSummer.world.filter(isObj).slice(0, 8).map(cleanNews) : [],
      left: Array.isArray(input.lastSummer.left) ? input.lastSummer.left.filter((x) => typeof x === 'string').slice(0, MAX_SQUAD) : [],
      unhappy: Array.isArray(input.lastSummer.unhappy) ? input.lastSummer.unhappy.filter((x) => typeof x === 'string').slice(0, MAX_SQUAD) : [],
    } : null,
  }
}

/**
 * A career saved before the Street League existed: every division number moves up one
 * (the Sunday League was 0, now it's 1). The season in progress carries on as it was;
 * the new clubs join from next season.
 */
function fromV1(c) {
  const up = (v) => (Number.isInteger(v) && v >= 0 ? v + 1 : v)
  return {
    ...c,
    v: 2,
    level: up(c.level),
    past: Array.isArray(c.past) ? c.past.map((e) => (isObj(e) ? { ...e, level: up(e.level) } : e)) : c.past,
    cup: isObj(c.cup) && isObj(c.cup.levels) ? { ...c.cup, levels: Object.fromEntries(Object.entries(c.cup.levels).map(([k, v]) => [k, up(v)])) } : c.cup,
    // Loans name the club by id (c + division + tier), which moves up with its division
    loans: Array.isArray(c.loans) ? c.loans.map((l) => (isObj(l) ? { ...l, level: up(l.level), clubId: String(l.clubId || '').replace(/^c(\d)(\d)$/, (_, lv, t) => `c${Number(lv) + 1}${t}`) } : l)) : c.loans,
    lastSummer: isObj(c.lastSummer) && Array.isArray(c.lastSummer.world) ? { ...c.lastSummer, world: c.lastSummer.world.map((n) => (isObj(n) ? { ...n, level: up(n.level) } : n)) } : c.lastSummer,
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
    competition: m.competition === 'cup' || m.competition === 'ccl' ? m.competition : 'league',
    round: Number.isInteger(m.round) ? m.round : 0,
    home: String(m.home || '').slice(0, 4),
    away: String(m.away || '').slice(0, 4),
    result: { home: goals(m.result.home), away: goals(m.result.away), ...(isObj(m.result.pens) ? { pens: { home: goals(m.result.pens.home), away: goals(m.result.pens.away) } } : {}) },
    story: sanitizeStory(m.story),
    ...sanitizeExtras(m),
    ...(Array.isArray(m.debuts) ? { debuts: m.debuts.filter((n) => typeof n === 'string').slice(0, 9).map((n) => n.slice(0, 24)) } : {}),
    ...(typeof m.best?.name === 'string' && typeof m.best.id === 'string' && Number.isFinite(m.best.rating) ? {
      best: { name: m.best.name.slice(0, 32), id: m.best.id.slice(0, 16), rating: Math.min(10, Math.max(0, m.best.rating)), sub: m.best.sub === 'on' ? 'on' : null },
    } : {}),
    ...(typeof m.brief === 'string' ? { brief: m.brief.slice(0, 160) } : {}),
    ...(typeof m.derby === 'string' ? { derby: m.derby.slice(0, 40) } : {}),
    ...(['squad', 'bench', 'player'].includes(m.press?.choice) && Array.isArray(m.press.ids) ? {
      press: { choice: m.press.choice, ids: m.press.ids.filter((id) => typeof id === 'string').slice(0, 30) },
    } : {}),
    ...(Number.isInteger(m.posBefore) && m.posBefore > 0 ? { posBefore: m.posBefore } : {}),
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
