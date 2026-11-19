/**
 * The Canta Champions League: the biggest trophy in caps. Finish in the top two
 * of the Premier Cap League and next season you're in it: eight clubs (the
 * best of the Premier Cap League and four from abroad), two groups of four,
 * then semi-finals (group winners meet the other group's runners-up) and a
 * final. Played midweek between league matchdays. Pure functions.
 */
import { createTournament, recordResult, standings, allFixtures, readyFixtures, settleCpu, simulateResult, seededRng, sanitizeTournament, teamById } from './tournament'
import { clubsIn, clubByName, clubOvr } from './world'

const ME = 'T1'
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

export const CCL_NAME = 'Canta Champions League'
// Your group matches open after this many league matches; then the semi-final and the final
export const CCL_AFTER = { group: [2, 4, 6], semi: 9, final: 12 }
// Prize money (units): each group win, reaching the semis, the final, and winning it
export const CCL_PRIZE = { groupWin: 200, semi: 500, final: 1_000, won: 2_500 }

/** The clubs from abroad (the best in other countries). */
export const FOREIGN = [
  { name: 'Atlas Caps', primary: '#0D47A1', edge: '#FFD54F', pattern: 'ring', badge: 'star', finish: 'chrome' },
  { name: 'Verde FC', primary: '#2E7D32', edge: '#FFFFFF', pattern: 'stripe', badge: 'shield' },
  { name: 'Sahara Utd', primary: '#E65100', edge: '#FFF3E0', pattern: 'rays', badge: 'crown' },
  { name: 'Nordic Fizz', primary: '#00838F', edge: '#E0F7FA', pattern: 'dots', badge: 'diamond', finish: 'chrome' },
]

/**
 * This season's competition for your club (in division `level`, the top).
 * Group A has you and three others; group B four more.
 */
export function createCcl(club, level, matchDuration, season, now = Date.now(), world = null) {
  const rng = seededRng(`ccl:${club.name}:${season}:${now}`)
  // The four strongest Premier clubs (by OVR, not you), and the four from abroad
  const home = clubsIn(world, level)
    .filter((c) => c.name !== club.name)
    .map((c) => ({ c, ovr: clubByName(world, c.name) ? clubOvr(clubByName(world, c.name)) : 0 }))
    .sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(({ c, ovr }) => ({ ...c, ...(ovr ? { ovr } : {}) }))
  const pool = [...home, ...FOREIGN].map((c) => ({ badge: 'none', finish: 'gloss', ...c, cpu: true, difficulty: 'hard' }))
  const order = pool.slice().sort(() => rng() - 0.5)
  const groupA = createTournament({ format: 'league', legs: 1, teams: [{ ...club, cpu: false }, ...order.slice(0, 3)], matchDuration, rng, now })
  const groupB = createTournament({ format: 'league', legs: 1, teams: order.slice(3, 7), matchDuration, rng, now })
  return { season, groups: [groupA, groupB], knockout: null, out: null }
}

/** The tournament your next CCL match is in (a group, then the knockout), or null. */
export const cclStage = (ccl) => (!ccl ? null : ccl.knockout || ccl.groups?.[0] || null)

/** Are you still in it? 'won' | 'final' | 'semi' | 'group' when out, null while still in. */
export function cclRun(ccl) {
  if (!ccl) return null
  if (ccl.out) return ccl.out
  const ko = ccl.knockout
  if (ko?.championId === ME) return 'won'
  return null
}

/** Your next CCL match if it's open now (given how many league matches you've played), else null. */
export function cclTie(ccl, played, seasonDone = false) {
  if (!ccl || cclRun(ccl)) return null
  const t = cclStage(ccl)
  if (!t) return null
  const f = ccl.knockout
    ? readyFixtures(t).find((x) => x.home === ME || x.away === ME)
    : allFixtures(t).find((x) => !x.result && (x.home === ME || x.away === ME))
  if (!f) return null
  const after = ccl.knockout ? (f.round === 0 ? CCL_AFTER.semi : CCL_AFTER.final) : CCL_AFTER.group[f.round] ?? CCL_AFTER.group.at(-1)
  return played >= after || seasonDone ? f : null
}

/** The next CCL match whether or not it's open yet, and after how many league matches it opens. */
export function cclNext(ccl) {
  if (!ccl || cclRun(ccl)) return null
  const t = cclStage(ccl)
  const f = t && (ccl.knockout
    ? readyFixtures(t).find((x) => x.home === ME || x.away === ME)
    : allFixtures(t).find((x) => !x.result && (x.home === ME || x.away === ME)))
  if (!f) return null
  return { fixture: f, opensAfter: ccl.knockout ? (f.round === 0 ? CCL_AFTER.semi : CCL_AFTER.final) : CCL_AFTER.group[f.round] }
}

const sim = (t, f) => recordResult(t, f.id, simulateResult(t, f, seededRng(`${t.id}:${f.id}`)))

/** Play out every computer match in a league-format group up to `round` (Infinity: all). */
function playGroup(t, round = Infinity) {
  let cur = t
  for (const f of allFixtures(t)) if (!f.result && f.round <= round && f.home !== ME && f.away !== ME) cur = sim(cur, f)
  return cur
}

/** Group winners and runners-up, then the semi-finals: A1 v B2, B1 v A2. You're always T1 if you're in. */
function makeKnockout(ccl, now) {
  const [a, b] = ccl.groups
  const top = (t) => standings(t).slice(0, 2).map((r) => ({ ...teamById(t, r.id), fromId: r.id, group: t }))
  const [a1, a2] = top(a)
  const [b1, b2] = top(b)
  const mineIn = [a1, a2].some((x) => x.group === a && x.fromId === ME)
  // Order the teams so you're first (T1) when you're through
  const slots = [a1, b2, b1, a2]
  const order = mineIn ? [slots.find((x) => x.group === a && x.fromId === ME), ...slots.filter((x) => !(x.group === a && x.fromId === ME))] : slots
  const teams = order.map(({ fromId, group, id, ...t }) => { void fromId; void group; void id; return t })
  const ko = createTournament({ format: 'knockout', teams, matchDuration: a.matchDuration, rng: seededRng(`ccl-ko:${a.id}`), now })
  const idOf = (x) => ko.teams[order.indexOf(x)].id
  const rounds = ko.rounds.map((r) => r.map((tie) => ({ ...tie })))
  rounds[0][0] = { ...rounds[0][0], home: idOf(a1), away: idOf(b2), winner: null, result: null }
  rounds[0][1] = { ...rounds[0][1], home: idOf(b1), away: idOf(a2), winner: null, result: null }
  return { knockout: { ...ko, rounds }, out: mineIn ? null : 'group' }
}

/** Record your CCL result; the rest of that stage plays alongside. Returns { ccl, prize }. */
export function recordCclResult(ccl, fixtureId, result, now = Date.now()) {
  if (!ccl) return { ccl, prize: 0 }
  let prize = 0
  if (!ccl.knockout) {
    const t0 = ccl.groups[0]
    const f = allFixtures(t0).find((x) => x.id === fixtureId)
    if (!f) return { ccl, prize: 0 }
    const won = (f.home === ME ? result.home - result.away : result.away - result.home) > 0
    if (won) prize += CCL_PRIZE.groupWin
    const a = playGroup(recordResult(t0, fixtureId, result), f.round)
    let next = { ...ccl, groups: [a, playGroup(ccl.groups[1], f.round)] }
    // Group stage over: the knockout is drawn
    if (allFixtures(a).every((x) => x.result)) {
      next = { ...next, groups: [a, playGroup(next.groups[1])] }
      next = { ...next, ...makeKnockout(next, now) }
      if (!next.out) prize += CCL_PRIZE.semi
      else next = finishKnockout(next)
    }
    return { ccl: next, prize }
  }
  const ko = settleCpu(recordResult(ccl.knockout, fixtureId, result))
  const tie = allFixtures(ko).find((x) => x.id === fixtureId)
  let out = null
  if (tie?.winner && tie.winner !== ME) out = tie.round === 0 ? 'semi' : 'final'
  else if (tie?.winner === ME) prize += tie.round === 0 ? CCL_PRIZE.final : CCL_PRIZE.won
  return { ccl: { ...ccl, knockout: ko, out }, prize }
}

/** You're out: the rest plays itself out (to know the winner). */
export function finishKnockout(ccl) {
  if (!ccl) return ccl
  let groups = ccl.groups
  let next = ccl
  if (!ccl.knockout) {
    groups = [playGroup(groups[0]), playGroup(groups[1])]
    next = { ...ccl, groups }
    next = { ...next, ...makeKnockout(next, Date.now()) }
  }
  let ko = next.knockout
  for (let i = 0; ko && !ko.championId && i < 4; i++) {
    const t = readyFixtures(ko).find((f) => f.home !== ME && f.away !== ME)
    if (!t) break
    ko = settleCpu(sim(ko, t))
  }
  return { ...next, knockout: ko }
}

/** The winner's name, once there is one. */
export const cclWinner = (ccl) => (ccl?.knockout?.championId ? teamById(ccl.knockout, ccl.knockout.championId)?.name || null : null)

export function sanitizeCcl(c) {
  if (!isObj(c) || !Array.isArray(c.groups) || c.groups.length !== 2) return null
  const groups = c.groups.map(sanitizeTournament)
  if (groups.some((g) => !g || g.format !== 'league')) return null
  const knockout = c.knockout ? sanitizeTournament(c.knockout) : null
  if (c.knockout && (!knockout || knockout.format !== 'knockout')) return null
  return {
    season: Number.isInteger(c.season) ? c.season : 1,
    groups, knockout,
    out: ['group', 'semi', 'final'].includes(c.out) ? c.out : null,
  }
}
