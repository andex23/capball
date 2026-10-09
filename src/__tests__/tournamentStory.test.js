import { describe, it, expect } from 'vitest'
import { createTournament, recordResult, allFixtures } from '../game/tournament'
import { tournamentStory, topScorer } from '../game/tournamentStory'

const team = (name, cpu = true) => ({ name, primary: '#123456', edge: '#FFFFFF', cpu })
const teams = [team('Lagos Fizz', false), team('Green'), team('Blue'), team('Gold')]

function playAll(t, decide) {
  let cur = t
  for (let guard = 0; guard < 40 && !cur.championId; guard++) {
    const f = allFixtures(cur).find((x) => !x.result && x.home && x.away)
    if (!f) break
    cur = recordResult(cur, f.id, decide(f))
  }
  return cur
}

describe('tournament story', () => {
  it('a league win says by how much, and names the top scorer', () => {
    const t = playAll(createTournament({ format: 'league', teams, rng: () => 0.3, now: 1 }), (f) => (f.home === 'T1'
      ? { home: 3, away: 0, scorers: [{ side: 'home', name: 'Okafor', number: 9 }, { side: 'home', name: 'Okafor', number: 9 }] }
      : f.away === 'T1' ? { home: 0, away: 2 } : { home: 1, away: 1 }))
    const s = tournamentStory(t, ['T1'])
    expect(s.outcome).toBe('champion')
    expect(s.lines.join(' ')).toMatch(/Won the league by \d+ points/)
    expect(s.lines.join(' ')).toMatch(/perfect season|Unbeaten/)
    expect(topScorer(t)).toMatchObject({ name: 'Okafor', goals: 4, team: 'Lagos Fizz' })
  })

  it('losing the cup final is "so close", with the score', () => {
    const t = playAll(createTournament({ format: 'knockout', teams, rng: () => 0.3, now: 1 }), (f) => {
      if (f.home === 'T1') return { home: 2, away: 0 }
      if (f.away === 'T1') return { home: 0, away: 2 }
      return { home: 1, away: 0 }
    })
    // Make T1 lose the final instead: replay with a rule that knows the round
    const t2 = (() => {
      let cur = createTournament({ format: 'knockout', teams, rng: () => 0.3, now: 1 })
      for (let g = 0; g < 10 && !cur.championId; g++) {
        const f = allFixtures(cur).find((x) => !x.result && x.home && x.away)
        const isFinal = f.round === cur.rounds.length - 1
        const t1Home = f.home === 'T1'
        const t1In = t1Home || f.away === 'T1'
        const t1Wins = t1In && !isFinal
        cur = recordResult(cur, f.id, t1In ? (t1Wins === t1Home ? { home: 2, away: 1 } : { home: 1, away: 2 }) : { home: 1, away: 0 })
      }
      return cur
    })()
    expect(tournamentStory(t, ['T1']).outcome).toBe('champion')
    const s = tournamentStory(t2, ['T1'])
    expect(s.outcome).toBe('runnerUp')
    expect(s.lines[0]).toMatch(/Beaten 1–2 by .* in the final/)
  })

  it('going out early names the round and who won it', () => {
    const t = playAll(createTournament({ format: 'knockout', teams, rng: () => 0.3, now: 1 }), (f) => (f.home === 'T1' ? { home: 0, away: 1 } : f.away === 'T1' ? { home: 1, away: 0 } : { home: 2, away: 1 }))
    const s = tournamentStory(t, ['T1'])
    expect(s.outcome).toBe('knockedOut')
    expect(s.lines[0]).toMatch(/Knocked out in the semi-finals — lost 0–1/)
  })

  it('a lower league finish says how far off the top', () => {
    const t = playAll(createTournament({ format: 'league', teams, rng: () => 0.3, now: 1 }), (f) => (f.home === 'T1' ? { home: 0, away: 1 } : f.away === 'T1' ? { home: 1, away: 0 } : { home: 1, away: 1 }))
    const s = tournamentStory(t, ['T1'])
    expect(s.outcome).toBe('placed')
    expect(s.title).toBe('Finished 4th')
  })
})
