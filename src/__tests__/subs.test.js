import { describe, it, expect } from 'vitest'
import { newCareer, swapLineup, sanitizeCareer, finishSeason, nextMatch, recordCareerResult, ME } from '../game/career'
import { startingBench, swapIn, signPlayer, applyMatchByPlayer, developSeason, BENCH_POS, MAX_SUBS } from '../game/squad'
import { performanceByPlayer } from '../state/tournamentStore'

const club = { name: 'Bench FC', primary: '#123456', edge: '#FFFFFF' }

describe('a squad of ten', () => {
  it('six starters and a bench of four (GK, DEF, MID, ATK); three subs a match', () => {
    const c = newCareer(club, { now: 11 })
    expect(Object.keys(c.squad)).toHaveLength(6)
    expect(c.bench.map((p) => p.pos)).toEqual(BENCH_POS)
    expect(MAX_SUBS).toBe(3)
  })

  it('bench players swap into the six; keepers only for keepers', () => {
    const c = newCareer(club, { now: 12 })
    const s = swapLineup(c, 2, 'atk1') // the bench MID up front
    expect(s.squad.atk1.id).toBe(c.bench[2].id)
    expect(s.bench[2].id).toBe(c.squad.atk1.id)
    expect(swapLineup(c, 0, 'atk1')).toBeNull() // bench keeper can't play up front
    expect(swapLineup(c, 1, 'gk')).toBeNull()   // outfielder can't go in goal
    expect(swapLineup(c, 0, 'gk').squad.gk.pos).toBe('GK')
  })

  it('signings can go straight onto the bench', () => {
    const bench = startingBench('b')
    const star = { ...bench[3], id: 'new', name: 'New Star', rating: 60, pot: 62 }
    const deal = signPlayer({}, 100000, star, 'bench:3', bench)
    expect(deal.bench[3].id).toBe('new')
    expect(signPlayer({}, 100000, star, 'bench:0', bench)).toBeNull() // outfielder into the keeper's bench spot
  })

  it('saves keep the bench; older saves get one', () => {
    const c = newCareer(club, { now: 13 })
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c))).bench).toEqual(c.bench)
    const { bench, ...old } = c
    void bench
    expect(sanitizeCareer(JSON.parse(JSON.stringify(old))).bench).toHaveLength(4)
  })
})

describe('substitutions in a match', () => {
  it('each player is rated for his own time on: goals go to whoever was on', () => {
    const startLineup = { gk: 'g', def1: 'd1', def2: 'd2', mid: 'm', atk1: 'a1', atk2: 'a2' }
    // atk1 scores, is subbed off for 's1', then 's1' scores twice
    const goalLog = [
      { team: 'team1', cap: 'team1_atk1' },
      { team: 'team1', cap: 'team1_atk1' },
      { team: 'team1', cap: 'team1_atk1' },
    ]
    const subs = [{ role: 'atk1', outId: 'a1', inId: 's1', goalIdx: 1, eventIdx: 0 }]
    const perf = performanceByPlayer({ side: 'team1', startLineup, subs, goalLog, matchEvents: [], score: { team1: 3, team2: 0 } })
    expect(perf.a1).toMatchObject({ goals: 1, sub: 'off', role: 'atk1' })
    expect(perf.s1).toMatchObject({ goals: 2, sub: 'on', role: 'atk1' })
    expect(perf.s1.rating).toBeGreaterThan(perf.a1.rating)
    expect(Object.keys(perf)).toHaveLength(7) // six starters + one sub
  })

  it('a sub who came on gets an appearance and his goals; the bench who didn’t play is left alone', () => {
    const c = newCareer(club, { now: 14 })
    const sub = c.bench[3]
    const byPlayer = Object.fromEntries(Object.values(c.squad).map((p) => [p.id, { rating: 6.5, goals: 0 }]))
    byPlayer[sub.id] = { rating: 8, goals: 1 }
    const r = applyMatchByPlayer(c.squad, c.bench, byPlayer, 's')
    expect(r.bench[3]).toMatchObject({ apps: 1, goals: 1 })
    expect(r.bench[0].apps).toBe(0)
  })

  it('players who never get a game slide a little over the summer', () => {
    const bench = startingBench('slide')
    const keys = Object.fromEntries(bench.map((p, i) => [String(i), { ...p, age: 27 }]))
    const out = developSeason(keys, 'x', 0).squad
    const drops = bench.filter((p, i) => out[String(i)].rating < p.rating).length
    expect(drops).toBeGreaterThan(0)
  })

  it('the bench carries on into the next season', () => {
    let c = newCareer(club, { now: 15 })
    for (let f = nextMatch(c.league); f; f = nextMatch(c.league)) c = recordCareerResult(c, f.id, f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 })
    expect(finishSeason(c).bench).toHaveLength(4)
  })
})
