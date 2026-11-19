import { standings, teamById } from './tournament'
import { ME, CUP_NAME, careerNext } from './career'
import { isDerby, derbyName } from './rivals'

function resultFor(f, id) {
  const home = f.home === id
  const gf = home ? f.result.home : f.result.away
  const ga = home ? f.result.away : f.result.home
  return { gf, ga, outcome: gf > ga ? 'W' : gf < ga ? 'L' : 'D' }
}

export function leagueForm(league, id) {
  return league.fixtures.filter((f) => f.result && (f.home === id || f.away === id))
    .sort((a, b) => a.round - b.round).slice(-5).map((f) => resultFor(f, id).outcome)
}

export function fixtureBrief(career, due = careerNext(career)) {
  if (!due) return ''
  const f = due.fixture
  const cup = due.kind === 'cup'
  const comp = cup ? career.cup?.tournament : career.league
  const otherId = f.home === ME ? f.away : f.home
  const opponent = teamById(comp, otherId)?.name
  if (!opponent) return ''
  if (cup) return f.round === comp.rounds.length - 1 ? 'The ' + CUP_NAME + ' final against ' + opponent + '.' : 'Knockout tie. A draw goes to extra time or penalties.'
  const standingsNow = standings(career.league)
  const topTwo = standingsNow.slice(0, 2)
  if (f.round >= 7 && topTwo.every((r) => r.id === ME || r.id === otherId)) {
    const [first, second] = topTwo
    const gap = first.pts - second.pts
    if (gap <= 3) return first.name + ' and ' + second.name + ' meet in the top two. ' +
      (gap === 0 ? 'Both have ' + first.pts + ' points.' : first.name + ' lead by ' + gap + (gap === 1 ? ' point.' : ' points.'))
  }
  const previous = career.league.fixtures.find((x) => x.result && (x.home === ME && x.away === otherId || x.home === otherId && x.away === ME))
  if (isDerby(career, career.league, f)) {
    if (!previous) return derbyName(opponent) + '. The whole area wants this one.'
    const { gf, ga, outcome } = resultFor(previous, ME)
    return outcome === 'L' ? 'They beat you ' + ga + '–' + gf + ' last time. Revenge counts double.'
      : outcome === 'W' ? 'You won the last one ' + gf + '–' + ga + '. They want it back.'
        : 'Last time it finished ' + gf + '–' + ga + '. Someone has to win this one.'
  }
  if (previous) {
    const { gf, ga, outcome } = resultFor(previous, ME)
    return 'Last meeting: ' + career.club.name + ' ' + ({ W: 'won', D: 'drew', L: 'lost' }[outcome]) + ' ' + gf + '–' + ga + ' against ' + opponent + '.'
  }
  const row = standingsNow.find((r) => r.id === otherId)
  if (!row?.p) return f.home === ME ? 'Season opener. ' + opponent + ' visit your table.' : 'Season opener away to ' + opponent + '.'
  return opponent + ' have ' + row.pts + ' points from ' + row.p + ' matches.'
}

export function previousTable(career) {
  const last = career.league.fixtures.filter((f) => f.result && (f.home === ME || f.away === ME)).reduce((r, f) => Math.max(r, f.round), -1)
  if (last <= 0) return []
  return standings({ ...career.league, fixtures: career.league.fixtures.filter((f) => f.round < last) })
}

export const PRESS = {
  squad: { quote: '“Every cap played a part.”', detail: 'Whole squad · +1 passing' },
  bench: { quote: '“The bench will get its chance.”', detail: 'Bench · +3 passing' },
  player: { quote: '“That performance deserves the credit.”', detail: 'Top performer · +4 passing' },
}

export function bestPerformer(career) {
  if (career.lastMatch?.best) return career.lastMatch.best
  const rep = career.lastReport
  if (!rep || rep.fixtureId !== career.lastMatch?.fixtureId) return null
  const row = rep.players?.find((p) => p.id === rep.motmId)
  const p = row ? [...Object.values(career.squad), ...career.bench, ...(career.reserves || [])].find((pl) => pl.id === row.id) : career.squad[rep.motm]
  return p ? { id: p.id, name: p.name, rating: row?.rating ?? rep.ratings?.[rep.motm], sub: row?.sub } : null
}

export function answerPress(career, choice) {
  const m = career.lastMatch
  if (!m || m.press || m.season !== career.season || !Object.hasOwn(PRESS, choice)) return null
  const best = bestPerformer(career)
  const ids = choice === 'squad' ? [...Object.values(career.squad), ...career.bench, ...(career.reserves || [])].map((p) => p.id)
    : choice === 'bench' ? career.bench.map((p) => p.id) : best ? [best.id] : []
  if (!ids.length) return null
  return { ...career, lastMatch: { ...m, press: { choice, ids } } }
}

export function pressBoost(career, player) {
  const press = career?.lastMatch?.press
  if (career?.lastMatch?.season !== career?.season || !press?.ids?.includes(player.id)) return 0
  return { squad: 1, bench: 3, player: 4 }[press.choice] || 0
}
