import { describe, it, expect } from 'vitest'
import {
  newCareer, nextMatch, recordCareerResult, finishSeason, sanitizeCareer, ME,
  cupTie, cupNext, cupRun, cupPending, recordCupResult, CUP_AFTER, targetFor, targetMet, playedThisSeason,
} from '../game/career'
import { aimWobble, flickScale, ageGrowth, developSeason, startingSquad, matchupOf, priceOf, marketFor, RETIRE_FROM } from '../game/squad'
import { wobble } from '../game/flick'

const club = { name: 'Lions', primary: '#D32F2F', edge: '#FFFFFF' }
const win = (f) => (f.home === ME ? { home: 2, away: 0 } : { home: 0, away: 2 })
const playLeague = (c, n = Infinity) => {
  for (let i = 0; i < n; i++) { const f = nextMatch(c.league); if (!f) break; c = recordCareerResult(c, f.id, win(f)) }
  return c
}

describe('ratings you can feel', () => {
  it('better players flick harder over a wider range and aim steadier', () => {
    expect(flickScale(40)).toBeLessThan(flickScale(76))
    expect(flickScale(76) - flickScale(40)).toBeGreaterThan(0.1)
    expect(aimWobble(40)).toBeGreaterThan(2)
    expect(aimWobble(76)).toBeLessThan(1)
    expect(aimWobble(99)).toBe(0)
    expect(aimWobble(undefined)).toBe(0) // ordinary matches: no wobble
  })
  it('a wobble turns the flick but keeps its strength', () => {
    const v = wobble({ x: 10, y: 0 }, 3, () => 1)
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10, 6)
    expect(Math.atan2(v.y, v.x) * 180 / Math.PI).toBeCloseTo(3, 6)
    expect(wobble({ x: 1, y: 2 }, 0)).toEqual({ x: 1, y: 2 })
  })
  it('matchups read favourite / even / underdog', () => {
    expect(matchupOf(45, 40)).toBe('favourite')
    expect(matchupOf(41, 40)).toBe('even')
    expect(matchupOf(36, 40)).toBe('underdog')
  })
})

describe('bigger seasons', () => {
  it('home and away: ten league matches', () => {
    const c = newCareer(club, { now: 1 })
    let n = 0
    let cur = c
    while (nextMatch(cur.league)) { cur = playLeague(cur, 1); n++ }
    expect(n).toBe(10)
  })

  it('the Cap Cup opens round by round as the league goes on, and can be won', () => {
    let c = newCareer(club, { now: 2 })
    expect(c.cup.tournament.teams).toHaveLength(8)
    expect(cupTie(c)).toBeNull()                       // the quarter-final opens after 2 league games
    expect(cupNext(c).opensAfter).toBe(CUP_AFTER[0])
    c = playLeague(c, CUP_AFTER[0])
    for (let round = 0; round < 3; round++) {
      c = playLeague(c, Math.max(0, CUP_AFTER[round] - playedThisSeason(c.league)))
      const tie = cupTie(c)
      expect(tie, `round ${round}`).toBeTruthy()
      c = recordCupResult(c, tie.id, win(tie))
    }
    expect(cupRun(c.cup.tournament)).toBe('won')
    expect(cupPending(c)).toBe(false)
    c = playLeague(c)
    const next = finishSeason(c)
    expect(next.cups).toBe(1)
    expect(next.past[0].cup).toBe('won')
    expect(next.cup.tournament.championId).toBeNull() // a fresh cup for the new season
  })

  it('a cup tie never blocks the season: once the league is done, it opens', () => {
    let c = newCareer(club, { now: 6 })
    c = playLeague(c)                       // the whole league, no cup played
    expect(cupTie(c)).toBeTruthy()
  })

  it('knocked out: the rest of the cup plays itself at season end', () => {
    let c = playLeague(newCareer(club, { now: 3 }), CUP_AFTER[0])
    const tie = cupTie(c)
    c = recordCupResult(c, tie.id, tie.home === ME ? { home: 0, away: 1 } : { home: 1, away: 0 })
    expect(cupRun(c.cup.tournament)).toBe('quarter')
    c = playLeague(c)
    const next = finishSeason(c)
    expect(next.past[0].cup).toBe('quarter')
    expect(next.past[0].cupWinner).toBeTruthy()
  })

  it('the board sets a target from how the squad compares, and pays when it is met', () => {
    const c = newCareer(club, { now: 4 })
    expect(['promotion', 'topHalf']).toContain(c.target)
    expect(targetMet('promotion', 2)).toBe(true)
    expect(targetMet('topHalf', 4)).toBe(false)
    expect(targetMet('survive', 5)).toBe(true)
    // A much stronger squad is expected to go up; a much weaker one to stay up
    const strong = Object.fromEntries(Object.entries(startingSquad(1)).map(([r, p]) => [r, { ...p, rating: 70 }]))
    const weak = Object.fromEntries(Object.entries(startingSquad(1)).map(([r, p]) => [r, { ...p, rating: 30 }]))
    expect(targetFor(1, strong)).toBe('promotion')
    expect(targetFor(1, weak)).toBe('survive')
  })

  it('saves and loads with the cup, target and ages', () => {
    let c = playLeague(newCareer(club, { now: 5 }), 3)
    const tie = cupTie(c)
    if (tie) c = recordCupResult(c, tie.id, win(tie))
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c)))).toEqual(c)
  })
})

describe('ages, growth and retirement', () => {
  it('young players grow, older ones fade', () => {
    expect(ageGrowth(18)).toBeGreaterThan(ageGrowth(26))
    expect(ageGrowth(33)).toBeLessThan(0)
  })
  it('everyone gets a year older; veterans retire and a youth player steps in', () => {
    const squad = startingSquad(9)
    squad.atk1 = { ...squad.atk1, age: RETIRE_FROM + 3, rating: 60 }
    const { squad: next, retired } = developSeason(squad, 'seed', 0)
    expect(retired.map((r) => r.role)).toContain('atk1')
    expect(next.atk1.youth).toBe(true)
    expect(next.atk1.age).toBeLessThanOrEqual(18)
    expect(next.def1.age).toBe(squad.def1.age + 1)
  })
  it('the market always has a youth prospect at half price', () => {
    const m = marketFor({ season: 1, level: 0, windowIndex: 0, seed: 'x' })
    const youth = m.find((p) => p.youth)
    expect(youth).toBeTruthy()
    expect(youth.age).toBeLessThanOrEqual(18)
    expect(priceOf(youth.rating, true)).toBeLessThan(priceOf(youth.rating))
  })
})
