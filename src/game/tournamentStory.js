/**
 * The end of a tournament, told from the player's side: did they win it, lose
 * the final, get knocked out, or where did they finish — and how.
 *
 * Pure: tournament JSON plus the ids of the player's own teams.
 */
import { allFixtures, standings, teamById, roundName } from './tournament'

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** A team's record over every played match of the tournament. */
export function recordOf(t, id) {
  const r = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pensWon: 0, bestWin: null }
  for (const f of allFixtures(t)) {
    if (!f.result || (f.home !== id && f.away !== id)) continue
    const home = f.home === id
    const gf = home ? f.result.home : f.result.away
    const ga = home ? f.result.away : f.result.home
    r.p += 1; r.gf += gf; r.ga += ga
    let won = gf > ga, lost = gf < ga
    if (gf === ga && f.result.pens) {
      const pf = home ? f.result.pens.home : f.result.pens.away
      const pa = home ? f.result.pens.away : f.result.pens.home
      won = pf > pa; lost = !won
      if (won) r.pensWon += 1
    }
    if (won) r.w += 1; else if (lost) r.l += 1; else r.d += 1
    if (gf > ga && (!r.bestWin || gf - ga > r.bestWin.gf - r.bestWin.ga)) r.bestWin = { gf, ga, vs: teamById(t, home ? f.away : f.home)?.name }
  }
  return r
}

/** The tournament's top scorer from the recorded scorers (own goals don't count). */
export function topScorer(t) {
  const tally = new Map()
  for (const f of allFixtures(t)) {
    for (const g of f.result?.scorers || []) {
      if (g.own) continue
      const teamId = g.side === 'home' ? f.home : f.away
      const key = `${teamId}:${g.number}:${g.name}`
      const cur = tally.get(key) || { teamId, name: g.name, number: g.number, goals: 0 }
      cur.goals += 1
      tally.set(key, cur)
    }
  }
  const best = [...tally.values()].sort((a, b) => b.goals - a.goals)[0]
  return best ? { ...best, team: teamById(t, best.teamId)?.name } : null
}

/** How a knockout team's run ended: the tie they went out in (or null if they won it). */
function exitTie(t, id) {
  for (let r = 0; r < t.rounds.length; r++) {
    for (const tie of t.rounds[r]) {
      if (tie.winner && (tie.home === id || tie.away === id) && tie.winner !== id) return { tie, round: r }
    }
  }
  return null
}

const scoreFor = (tie, id) => {
  if (!tie?.result) return ''
  const home = tie.home === id
  const a = home ? tie.result.home : tie.result.away
  const b = home ? tie.result.away : tie.result.home
  const pens = tie.result.pens ? ` (${home ? tie.result.pens.home : tie.result.pens.away}–${home ? tie.result.pens.away : tie.result.pens.home} on penalties)` : ''
  return `${a}–${b}${pens}`
}

/**
 * { outcome: 'champion' | 'runnerUp' | 'knockedOut' | 'placed' | 'watched',
 *   team, champ, title, headline, lines[], record, scorer }
 * `mine`: the player's team ids (several on a pass-and-play phone).
 */
export function tournamentStory(t, mine = []) {
  if (!t?.championId) return null
  const champ = teamById(t, t.championId)
  const league = t.format === 'league'
  const comp = league ? 'league' : 'cup'
  const scorer = topScorer(t)
  // Whose story: a winning human team first, else the best-placed human team
  const humans = mine.length ? mine : t.teams.filter((x) => !x.cpu).map((x) => x.id)
  let focus = humans.includes(t.championId) ? t.championId : null
  if (!focus && humans.length) {
    if (league) focus = standings(t).find((r) => humans.includes(r.id))?.id || null
    else focus = humans.includes(t.runnerUpId) ? t.runnerUpId : humans[0]
  }
  const team = focus ? teamById(t, focus) : null
  const record = team ? recordOf(t, focus) : null
  const lines = []
  const recordLine = record ? `${plural(record.w, 'win')}, ${plural(record.d, 'draw')}, ${plural(record.l, 'defeat')} · ${record.gf} scored, ${record.ga} conceded` : ''

  if (!team) {
    return { outcome: 'watched', team: null, champ, title: league ? 'League champions' : 'Cup winners', headline: `${champ.name} win the ${comp}!`, lines: [], record: null, scorer }
  }

  if (focus === t.championId) {
    if (league) {
      const table = standings(t)
      const gap = table[0].pts - (table[1]?.pts ?? 0)
      lines.push(gap > 0 ? `Won the league by ${plural(gap, 'point')}.` : `Won it on ${table[0].gd !== table[1]?.gd ? 'goal difference' : 'goals scored'}!`)
      if (record.l === 0) lines.push(record.d === 0 ? 'A perfect season — won every match.' : 'Unbeaten all the way.')
    } else {
      const final = t.rounds[t.rounds.length - 1][0]
      const opp = teamById(t, final.home === focus ? final.away : final.home)
      lines.push(`Beat ${opp?.name} ${scoreFor(final, focus)} in the final.`)
      if (record.l === 0 && record.pensWon === 0) lines.push(`Won every tie on the way${record.ga === 0 ? ' without conceding a goal' : ''}.`)
      else if (record.pensWon) lines.push(`Held their nerve in ${plural(record.pensWon, 'shootout')}.`)
    }
    if (record.bestWin && record.bestWin.gf - record.bestWin.ga >= 3) lines.push(`Biggest win: ${record.bestWin.gf}–${record.bestWin.ga} against ${record.bestWin.vs}.`)
    return { outcome: 'champion', team, champ, title: 'Champions!', headline: `${team.name} win the ${comp}!`, lines, recordLine, record, scorer }
  }

  if (league) {
    const table = standings(t)
    const pos = table.findIndex((r) => r.id === focus) + 1
    const gap = table[0].pts - table[pos - 1].pts
    const runnerUp = pos === 2
    lines.push(runnerUp
      ? (gap === 0 ? `Level on points with ${champ.name} — pipped on goal difference.` : `Just ${plural(gap, 'point')} behind ${champ.name}.`)
      : `${plural(gap, 'point')} off the top. ${champ.name} took the title.`)
    return { outcome: runnerUp ? 'runnerUp' : 'placed', team, champ, title: runnerUp ? 'So close' : `Finished ${ordinal(pos)}`, headline: `${team.name} finish ${ordinal(pos)} of ${t.teams.length}`, lines, recordLine, record, scorer }
  }

  const out = exitTie(t, focus)
  const opp = out ? teamById(t, out.tie.home === focus ? out.tie.away : out.tie.home) : null
  if (out && out.round === t.rounds.length - 1) {
    lines.push(`Beaten ${scoreFor(out.tie, focus)} by ${opp?.name} in the final.`)
    return { outcome: 'runnerUp', team, champ, title: 'So close', headline: `${team.name} are runners-up`, lines, recordLine, record, scorer }
  }
  const stage = out ? roundName(out.round, t.rounds.length) : 'the cup'
  lines.push(`Knocked out in the ${stage.toLowerCase()} — lost ${scoreFor(out?.tie, focus)} to ${opp?.name}.`)
  if (opp?.id === champ.id) lines.push(`${champ.name} went on to win the cup.`)
  else lines.push(`${champ.name} went on to lift the cup.`)
  return { outcome: 'knockedOut', team, champ, title: 'Knocked out', headline: `${team.name} go out in the ${stage.toLowerCase()}`, lines, recordLine, record, scorer }
}
