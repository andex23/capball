import { describe, it, expect } from 'vitest'
import { newCareer, nextMatch, recordCareerResult, seasonOver, finishSeason, outcomeFor, myPosition, sanitizeCareer, DIVISIONS, ME } from '../game/career'

const club = { name: 'Lions', primary: '#D32F2F', edge: '#FFFFFF' }

function playSeason(career, score) {
  let c = career
  for (let m = nextMatch(c.league); m; m = nextMatch(c.league)) {
    const mine = m.home === ME ? 'home' : 'away'
    const result = mine === 'home' ? { home: score[0], away: score[1] } : { home: score[1], away: score[0] }
    c = recordCareerResult(c, m.id, result)
  }
  return c
}

describe('career mode', () => {
  it('starts in the Street League with seven computer clubs', () => {
    const c = newCareer(club)
    expect(c.level).toBe(0)
    expect(c.league.teams).toHaveLength(8)
    expect(c.league.teams.filter((t) => t.cpu)).toHaveLength(7)
    expect(nextMatch(c.league)).toBeTruthy()
  })
  it('winning every game finishes top and goes up', () => {
    const c = playSeason(newCareer(club), [5, 0])
    expect(seasonOver(c.league)).toBe(true)
    expect(myPosition(c.league)).toBe(1)
    const next = finishSeason(c)
    expect(next).toMatchObject({ level: 1, season: 2, promotions: 1 })
    expect(next.past[0]).toMatchObject({ position: 1, outcome: 'promoted', division: DIVISIONS[0].name })
  })
  it('promotion, relegation and the title by position', () => {
    expect(DIVISIONS[0].name).toBe('Street League')
    expect(outcomeFor(0, 2)).toBe('promoted')
    expect(outcomeFor(0, 8)).toBe('stayed') // can't go below the bottom division
    expect(outcomeFor(2, 6)).toBe('stayed')
    expect(outcomeFor(2, 7)).toBe('relegated') // the bottom two go down
    expect(outcomeFor(2, 8)).toBe('relegated')
    expect(outcomeFor(4, 1)).toBe('champions')
    expect(outcomeFor(4, 2)).toBe('stayed')
  })
  it('survives a save and load', () => {
    const c = playSeason(newCareer(club), [1, 0])
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c)))).toEqual(c)
    expect(sanitizeCareer({ v: 99 })).toBeNull()
  })
  it('a career saved before the Street League moves up a division number and keeps playing', () => {
    // A v1 save in the Sunday League (then level 0), half-way through a six-club season
    const c = playSeason(newCareer(club), [1, 0])
    const old = JSON.parse(JSON.stringify({ ...c, v: 1, level: 0, past: [{ season: 1, level: 0, division: 'Sunday League', position: 2 }] }))
    old.world.clubs = old.world.clubs.filter((x) => x.level === 0).map((x) => ({ ...x, level: 0 }))
    const up = sanitizeCareer(old)
    expect(up.v).toBe(2)
    expect(up.level).toBe(1)
    expect(DIVISIONS[up.level].name).toBe('Sunday League')
    expect(up.past[0].level).toBe(1)
    // Clubs that didn't exist in the old world are built; the ones that did keep their players
    expect(up.world.clubs).toHaveLength(35)
    const kept = old.world.clubs[0]
    expect(up.world.clubs.find((x) => x.name === kept.name).players.map((p) => p.id)).toEqual(kept.players.map((p) => p.id))
    // Next season is a full eight-club league
    expect(finishSeason(up).league.teams).toHaveLength(8)
  })
})

describe('career matchdays', () => {
  it('the other clubs play the same matchday as you, not the whole season at once', () => {
    let c = newCareer(club)
    const m = nextMatch(c.league)
    c = recordCareerResult(c, m.id, { home: 1, away: 0 })
    const played = c.league.fixtures.filter((f) => f.result)
    expect(played.every((f) => f.round <= m.round)).toBe(true)
    expect(played.length).toBeLessThan(c.league.fixtures.length)
  })
})
