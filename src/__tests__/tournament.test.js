import { describe, it, expect } from 'vitest'
import {
  createTournament, leagueFixtures, knockoutRounds, nextFixture, recordResult, standings,
  simulateCpuFixtures, simulateResult, sanitizeTournament, progress, needsHuman, resultWinner,
  roundName, historyEntry, allFixtures, settleCpu, applyResults, readyFixtures, seededRng,
} from '../game/tournament'

// Deterministic rng
function seeded(seed = 1) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}
const teams = (n, cpuFrom = 1) => Array.from({ length: n }, (_, i) => ({
  name: `Club ${i + 1}`, primary: '#123456', edge: '#FFFFFF', cpu: i >= cpuFrom, difficulty: 'medium',
}))

describe('league fixtures', () => {
  for (const n of [3, 4, 5, 6, 7, 8]) {
    it(`${n} teams: everyone meets everyone once, nobody twice in a round`, () => {
      const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`)
      const fx = leagueFixtures(ids, 1)
      expect(fx.length).toBe((n * (n - 1)) / 2)
      const pairs = new Set(fx.map((f) => [f.home, f.away].sort().join('-')))
      expect(pairs.size).toBe(fx.length)
      const byRound = {}
      for (const f of fx) (byRound[f.round] ||= []).push(f.home, f.away)
      for (const list of Object.values(byRound)) expect(new Set(list).size).toBe(list.length)
    })
  }

  it('home and away: every pairing twice, once each way', () => {
    const fx = leagueFixtures(['A', 'B', 'C', 'D'], 2)
    expect(fx.length).toBe(12)
    const directed = new Set(fx.map((f) => `${f.home}>${f.away}`))
    expect(directed.size).toBe(12)
  })

  it('home games are shared out fairly', () => {
    const fx = leagueFixtures(['A', 'B', 'C', 'D', 'E', 'F'], 1)
    const home = {}
    for (const f of fx) home[f.home] = (home[f.home] || 0) + 1
    for (const n of Object.values(home)) expect(n).toBeGreaterThanOrEqual(2)
  })
})

describe('knockout draw', () => {
  for (const n of [3, 4, 5, 6, 7, 8]) {
    it(`${n} teams: every team placed once; byes only against nobody`, () => {
      const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`)
      const rounds = knockoutRounds(ids, seeded(n))
      const first = rounds[0]
      const placed = first.flatMap((t) => [t.home, t.away]).filter(Boolean)
      expect(new Set(placed).size).toBe(n)
      expect(placed.length).toBe(n)
      for (const tie of first) expect(tie.home).not.toBeNull() // no empty ties
      expect(rounds[rounds.length - 1].length).toBe(1) // a single final
    })
  }

  it('names the rounds from the final backwards', () => {
    expect(roundName(2, 3)).toBe('Final')
    expect(roundName(1, 3)).toBe('Semi-finals')
    expect(roundName(0, 3)).toBe('Quarter-finals')
  })
})

describe('playing a cup', () => {
  it('runs from the first tie to a champion, with a shootout for draws', () => {
    let t = createTournament({ format: 'knockout', teams: teams(5), rng: seeded(3) })
    expect(progress(t)).toEqual({ played: 0, total: 4 })
    let guard = 0
    while (!t.championId && guard++ < 10) {
      const f = nextFixture(t)
      // A draw without pens isn't a cup result…
      expect(recordResult(t, f.id, { home: 1, away: 1 })).toBe(t)
      // …with pens it is
      t = recordResult(t, f.id, { home: 1, away: 1, pens: { home: 4, away: 3 } })
    }
    expect(t.championId).toBeTruthy()
    expect(t.runnerUpId).toBeTruthy()
    expect(t.runnerUpId).not.toBe(t.championId)
    expect(progress(t)).toEqual({ played: 4, total: 4 })
    expect(nextFixture(t)).toBeNull()
    expect(historyEntry(t).champion.name).toMatch(/Club/)
  })

  it('ignores a second result for the same tie and nonsense scores', () => {
    let t = createTournament({ format: 'knockout', teams: teams(4), rng: seeded(9) })
    const f = nextFixture(t)
    t = recordResult(t, f.id, { home: 2, away: 0 })
    expect(recordResult(t, f.id, { home: 0, away: 5 })).toBe(t)
    const g = nextFixture(t)
    expect(recordResult(t, g.id, { home: -1, away: 0 })).toBe(t)
    expect(recordResult(t, g.id, { home: 2, away: 1, pens: { home: 1, away: 0 } })).toBe(t) // pens only after a draw
    expect(resultWinner({ home: 'A', away: 'B', result: { home: 0, away: 3 } })).toBe('B')
  })
})

describe('playing a league', () => {
  it('builds the table: points, then goal difference, then goals', () => {
    let t = createTournament({ format: 'league', teams: teams(3), rng: seeded(1) })
    const fx = allFixtures(t)
    expect(fx.length).toBe(3)
    // Club 1 beats both; the other game is a draw
    for (const f of fx) {
      const c1 = t.teams[0].id
      if (f.home === c1) t = recordResult(t, f.id, { home: 3, away: 0 })
      else if (f.away === c1) t = recordResult(t, f.id, { home: 0, away: 1 })
      else t = recordResult(t, f.id, { home: 2, away: 2 })
    }
    const table = standings(t)
    expect(table[0]).toMatchObject({ name: 'Club 1', p: 2, w: 2, pts: 6, gf: 4, ga: 0, gd: 4 })
    expect(table[1].pts).toBe(1)
    expect(t.championId).toBe(table[0].id)
    expect(t.runnerUpId).toBe(table[1].id)
  })

  it('draws count in a league', () => {
    const t = createTournament({ format: 'league', teams: teams(4), rng: seeded(2) })
    const f = nextFixture(t)
    expect(recordResult(t, f.id, { home: 0, away: 0 })).not.toBe(t)
  })
})

describe('CPU teams', () => {
  it('plays out CPU-only fixtures and stops at the next one with a human', () => {
    const t = createTournament({ format: 'league', teams: teams(6, 1), rng: seeded(4) })
    const { tournament, simulated } = simulateCpuFixtures(t, seeded(5))
    const next = nextFixture(tournament)
    if (next) expect(needsHuman(tournament, next)).toBe(true)
    for (const s of simulated) expect(needsHuman(t, s.fixture)).toBe(false)
  })

  it('an all-CPU cup plays itself to a champion', () => {
    const t = createTournament({ format: 'knockout', teams: teams(8, 0), rng: seeded(6) })
    const { tournament } = simulateCpuFixtures(t, seeded(7))
    expect(tournament.championId).toBeTruthy()
  })

  it('simulated cup ties always have a winner', () => {
    const t = createTournament({ format: 'knockout', teams: teams(4, 0), rng: seeded(8) })
    const rng = seeded(10)
    for (let i = 0; i < 200; i++) {
      const r = simulateResult(t, nextFixture(t), rng)
      expect(resultWinner({ home: 'a', away: 'b', result: r })).not.toBeNull()
    }
  })
})

describe('saving', () => {
  it('round-trips through JSON and rejects tampered saves', () => {
    let t = createTournament({ format: 'knockout', teams: teams(6), rng: seeded(11) })
    t = recordResult(t, nextFixture(t).id, { home: 2, away: 1 })
    const back = sanitizeTournament(JSON.parse(JSON.stringify(t)))
    expect(back).toEqual(t)
    expect(sanitizeTournament({ ...t, v: 99 })).toBeNull()
    expect(sanitizeTournament({ ...t, teams: t.teams.slice(0, 1) })).toBeNull()
    const bad = JSON.parse(JSON.stringify(t))
    bad.rounds[0][0].home = 'nobody'
    expect(sanitizeTournament(bad)).toBeNull()
    const league = createTournament({ format: 'league', legs: 2, teams: teams(4), rng: seeded(12) })
    expect(sanitizeTournament(JSON.parse(JSON.stringify(league)))).toEqual(league)
  })

  it('refuses impossible set-ups', () => {
    expect(() => createTournament({ format: 'league', teams: teams(2) })).toThrow()
    expect(() => createTournament({ format: 'cup', teams: teams(4) })).toThrow()
    expect(() => createTournament({ format: 'knockout', teams: teams(9) })).toThrow()
  })
})

describe('any-order play', () => {
  it('CPU games come out the same on every device', () => {
    const t = createTournament({ format: 'knockout', teams: teams(8, 1), rng: seeded(20) })
    expect(settleCpu(t)).toEqual(settleCpu(JSON.parse(JSON.stringify(t))))
    expect(seededRng('a')()).toBe(seededRng('a')())
    expect(seededRng('a')()).not.toBe(seededRng('b')())
  })

  it('rebuilds a cup from results reported in any order', () => {
    const start = createTournament({ format: 'knockout', teams: teams(4, 4), rng: seeded(21) }) // all human
    // Play it straight through, collecting the results as the server would store them
    let t = start
    const reported = []
    while (!t.championId) {
      const f = readyFixtures(t)[0]
      const r = { fixtureId: f.id, homeTeam: f.home, awayTeam: f.away, home: 2, away: 1 }
      reported.push(r)
      t = recordResult(t, f.id, { home: 2, away: 1 })
    }
    const shuffledResults = [...reported].reverse() // final first
    const rebuilt = applyResults(start, shuffledResults)
    expect(rebuilt.championId).toBe(t.championId)
  })

  it('ignores results that do not match the fixture', () => {
    const start = createTournament({ format: 'league', teams: teams(4, 4), rng: seeded(22) })
    const f = readyFixtures(start)[0]
    const t = applyResults(start, [{ fixtureId: f.id, homeTeam: f.away, awayTeam: f.home, home: 9, away: 0 }])
    expect(t).toEqual(settleCpu(start))
  })
})

describe('league matchday progression', () => {
  it('starts with an empty table and only offers the first human matchday', () => {
    const t = createTournament({ format: 'league', teams: teams(6), rng: seeded(30) })
    expect(settleCpu(t)).toEqual(t)
    expect(standings(settleCpu(t)).every((row) => row.p === 0)).toBe(true)
    expect(new Set(readyFixtures(t).map((f) => f.round))).toEqual(new Set([0]))
  })

  it('settles each matchday after its human matches, never future CPU games', () => {
    for (const count of [3, 4, 5, 6, 7, 8]) {
      let t = createTournament({ format: 'league', legs: 2, teams: teams(count), rng: seeded(count) })
      expect(settleCpu(t)).toEqual(t)
      for (let guard = 0; !t.championId && guard < 30; guard++) {
        const f = readyFixtures(t).find((x) => needsHuman(t, x))
        expect(f).toBeTruthy()
        t = settleCpu(recordResult(t, f.id, { home: 2, away: 1 }))
        const pendingHuman = t.fixtures.find((x) => !x.result && needsHuman(t, x))
        if (pendingHuman) {
          expect(t.fixtures.filter((x) => x.round >= pendingHuman.round && !needsHuman(t, x)).every((x) => !x.result)).toBe(true)
        }
        expect(settleCpu(t)).toEqual(t)
      }
      expect(t.championId).toBeTruthy()
      expect(standings(t).every((row) => row.p === 2 * (count - 1))).toBe(true)
    }
  })

  it('waits for all player matches in the matchday before simulating CPU matches', () => {
    let t = createTournament({ format: 'league', teams: teams(8, 3), rng: seeded(33) })
    const round = readyFixtures(t)
    const humans = round.filter((f) => needsHuman(t, f))
    const cpus = round.filter((f) => !needsHuman(t, f))
    expect(humans.length).toBeGreaterThan(1)
    expect(cpus.length).toBeGreaterThan(0)
    t = settleCpu(recordResult(t, humans[0].id, { home: 1, away: 0 }))
    expect(cpus.every((f) => !t.fixtures.find((x) => x.id === f.id).result)).toBe(true)
    for (const f of humans.slice(1)) t = settleCpu(recordResult(t, f.id, { home: 1, away: 0 }))
    expect(cpus.every((f) => t.fixtures.find((x) => x.id === f.id).result)).toBe(true)
  })

  it('reconstructs an online season from reversed reports without advancing future rounds', () => {
    const start = createTournament({ format: 'league', legs: 2, teams: teams(8), rng: seeded(34) })
    let t = start
    const reports = []
    for (let i = 0; i < 14; i++) {
      const f = readyFixtures(t).find((x) => needsHuman(t, x))
      reports.push({ fixtureId: f.id, homeTeam: f.home, awayTeam: f.away, home: 2, away: 1 })
      t = settleCpu(recordResult(t, f.id, { home: 2, away: 1 }))
    }
    expect(applyResults(start, reports.reverse())).toEqual(t)
    expect(applyResults(start, [])).toEqual(start)
  })
})


describe('balanced league venues', () => {
  it.each([3, 4, 5, 6, 7, 8])('%i teams share home and away games fairly', (n) => {
    const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`)
    const fixtures = leagueFixtures(ids)
    for (const id of ids) {
      const home = fixtures.filter((f) => f.home === id).length
      const away = fixtures.filter((f) => f.away === id).length
      expect(Math.abs(home - away)).toBeLessThanOrEqual(1)
    }
  })
})
