import { describe, it, expect } from 'vitest'
import {
  newCareer, nextMatch, recordCareerResult, finishSeason, sanitizeCareer, ME,
  cupTie, cupNext, cupRun, cupPending, recordCupResult, CUP_AFTER, targetFor, targetMet, playedThisSeason,
} from '../game/career'
import { ageGrowth, developSeason, startingSquad, matchupOf, priceOf, marketFor, RETIRE_FROM, powerScale, accuracyWobble, flickWobble, massScale, ovrOf, ovrAt, shiftOvr, potentialRange, makePlayer, migratePlayer } from '../game/squad'
import { seededRng } from '../game/tournament'
import { wobble } from '../game/flick'

const club = { name: 'Lions', primary: '#D32F2F', edge: '#FFFFFF' }
const win = (f) => (f.home === ME ? { home: 2, away: 0 } : { home: 0, away: 2 })
const playLeague = (c, n = Infinity) => {
  for (let i = 0; i < n; i++) { const f = nextMatch(c.league); if (!f) break; c = recordCareerResult(c, f.id, win(f)) }
  return c
}

describe('ratings you can feel', () => {
  it('PWR, SHT/PAS and PHY each do something on the pitch', () => {
    expect(powerScale(90)).toBeGreaterThan(powerScale(50))
    expect(accuracyWobble(50)).toBeGreaterThan(accuracyWobble(80))
    expect(accuracyWobble(95)).toBe(0)
    expect(massScale(90)).toBeGreaterThan(massScale(50))
    // A soft flick uses PAS, a hard one SHT
    const a = { pwr: 70, sht: 90, pas: 50, phy: 70 }
    expect(flickWobble(a, 0)).toBeCloseTo(accuracyWobble(50), 6)
    expect(flickWobble(a, 1)).toBeCloseTo(accuracyWobble(90), 6)
    expect(flickWobble(null, 1)).toBe(0) // ordinary matches: no wobble
  })

  it('OVR is attributes weighted by position, like FIFA', () => {
    const striker = { pwr: 80, sht: 85, pas: 60, phy: 55 }
    expect(ovrOf(striker, 'ATK')).toBeGreaterThan(ovrOf(striker, 'DEF') + 5)
    const p = makePlayer(seededRng('x'), 70, 'ATK', 0, [25, 25])
    expect(Math.abs(p.rating - 70)).toBeLessThanOrEqual(1)
    expect(ovrAt(p, 'atk1')).toBeGreaterThan(ovrAt(p, 'def1'))
    expect(p.pot).toBeGreaterThanOrEqual(p.rating)
    expect(potentialRange(p)).toMatch(/^\d+(–\d+)?$/)
  })

  it('shifting OVR moves the attributes the position needs', () => {
    const p = makePlayer(seededRng('y'), 60, 'DEF', 0, [24, 24])
    const up = shiftOvr(p, 3, seededRng('z'))
    expect(up.rating).toBe(p.rating + 3)
    expect(up.attrs.phy - p.attrs.phy + (up.attrs.pas - p.attrs.pas)).toBeGreaterThan(0)
  })

  it('old saves: one-number ratings become attributes on the new scale', () => {
    const old = { id: 'a1', name: 'Old Boy', rating: 40, age: 24 }
    const m = migratePlayer(old, 'atk1')
    expect(m.attrs).toBeTruthy()
    expect(Math.abs(m.rating - 52)).toBeLessThanOrEqual(1)
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
    const strong = Object.fromEntries(Object.entries(startingSquad(1)).map(([r, p]) => [r, shiftOvr(p, 75 - p.rating, seededRng(r))]))
    const weak = Object.fromEntries(Object.entries(startingSquad(1)).map(([r, p]) => [r, shiftOvr(p, 40 - p.rating, seededRng(r))]))
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
  it('young players grow, players peak late twenties, then fade', () => {
    expect(ageGrowth(18)).toBeGreaterThan(ageGrowth(26))
    expect(ageGrowth(29)).toBe(0)
    expect(ageGrowth(33)).toBeLessThan(0)
  })
  it('growth stops at potential; decline ignores it', () => {
    const sq = startingSquad(3)
    const young = { ...sq.def1, age: 18, pot: sq.def1.rating + 2, apps: 10, ratingSum: 80 }
    const { squad } = developSeason({ ...sq, def1: young }, 'p', 0)
    expect(squad.def1.rating).toBeLessThanOrEqual(young.pot + 2) // a great season can lift the ceiling by up to 2
    const vet = { ...sq.def2, age: 32, pot: sq.def2.rating }
    expect(developSeason({ ...sq, def2: vet }, 'q', 0).squad.def2.rating).toBeLessThan(vet.rating)
  })
  it('everyone gets a year older; veterans retire and a youth player steps in', () => {
    const squad = startingSquad(9)
    squad.atk1 = { ...squad.atk1, age: 37 }
    const { squad: next, retired } = developSeason(squad, 'seed', 0)
    expect(retired.map((r) => r.role)).toContain('atk1')
    expect(next.atk1.youth).toBe(true)
    expect(next.atk1.age).toBeLessThanOrEqual(18)
    expect(next.def1.age).toBe(squad.def1.age + 1)
  })
  it('the market always has a youth prospect, and fees work like real values', () => {
    const m = marketFor({ season: 1, level: 0, windowIndex: 0, seed: 'x' })
    const youth = m.find((p) => p.youth)
    expect(youth).toBeTruthy()
    expect(youth.age).toBeLessThanOrEqual(18)
    // Fees rise steeply with OVR; youth with room to grow carry a premium, veterans a discount
    const at = (ovr, age, pot = ovr) => priceOf({ rating: ovr, age, pot })
    expect(at(80, 26)).toBeGreaterThan(at(70, 26) * 2)
    expect(at(65, 19, 80)).toBeGreaterThan(at(65, 27))
    expect(at(65, 33)).toBeLessThan(at(65, 27))
  })
})
