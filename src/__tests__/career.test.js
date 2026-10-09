import { describe, it, expect } from 'vitest'
import { addToCareer, EMPTY_CAREER } from '../state/savedMatch'

const res = (a, b, pens) => ({ score: { team1: a, team2: b }, stats: { team1: { shots: 4 }, team2: { shots: 2 } }, penaltyScore: pens })

describe('career totals', () => {
  it('adds wins, draws, losses and goals from your side', () => {
    let c = addToCareer(EMPTY_CAREER, res(3, 0), 'team1', { team2: { name: 'Tigers' } })
    c = addToCareer(c, res(1, 1), 'team1')
    c = addToCareer(c, res(2, 0), 'team2')
    expect(c).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, cleanSheets: 1, shots: 10 })
    expect(c.bestWin).toEqual({ for: 3, against: 0, vs: 'Tigers' })
  })
  it('a shootout decides a level match', () => {
    expect(addToCareer(EMPTY_CAREER, res(1, 1, { team1: 4, team2: 3 }), 'team1').won).toBe(1)
    expect(addToCareer(EMPTY_CAREER, res(1, 1, { team1: 2, team2: 3 }), 'team1').lost).toBe(1)
  })
  it('pass-and-play counts as played but not as a win or loss', () => {
    const c = addToCareer(EMPTY_CAREER, res(2, 1), null)
    expect(c).toMatchObject({ played: 1, local: 1, won: 0, lost: 0, goalsFor: 0 })
  })
})

describe('weekly numbers for the leaderboard', () => {
  it('counts this week and starts again next week', async () => {
    const { weekKey } = await import('../state/savedMatch')
    expect(weekKey(new Date(2026, 9, 9))).toBe('2026-W41')
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53')
    let c = addToCareer(EMPTY_CAREER, res(2, 0), 'team1', {}, new Date(2026, 9, 9))
    c = addToCareer(c, res(1, 1), 'team1', {}, new Date(2026, 9, 10))
    expect(c.week).toEqual({ key: '2026-W41', played: 2, won: 1, goals: 3 })
    c = addToCareer(c, res(3, 0), 'team1', {}, new Date(2026, 9, 13))
    expect(c.week).toEqual({ key: '2026-W42', played: 1, won: 1, goals: 3 })
  })
})

describe('cap label', () => {
  it('team mode prints the team name unless it is a placeholder; own cap text wins', async () => {
    const { capLabel } = await import('../data/TeamOptions')
    const team = (c) => ({ ...c, capNames: 'team' })
    expect(capLabel(team({ name: 'Lions' }))).toBe('Lions')
    expect(capLabel(team({ name: 'Team 1' }))).toBe('')
    expect(capLabel(team({ name: 'Team 2', capText: 'COLA' }))).toBe('COLA')
    expect(capLabel(team({ name: 'Northside Rovers FC' }))).toHaveLength(12)
    expect(capLabel({ name: 'Lions', capNames: 'none' })).toBe('')
  })

  it('by default each cap prints its own player, from made-up names that stay the same', async () => {
    const { capLabel, playerNames, dummyNames, CAP_ROLES } = await import('../data/TeamOptions')
    const lions = { name: 'Lions' }
    const names = playerNames(lions)
    expect(new Set(Object.values(names)).size).toBe(6)
    expect(playerNames(lions)).toEqual(names)
    expect(capLabel(lions, 'gk')).toBe(names.gk.toUpperCase())
    expect(dummyNames('Tigers')).not.toEqual(dummyNames('Lions'))
    // Own names win and are cleaned up; gaps are filled with made-up ones
    const mine = playerNames({ name: 'Lions', players: { atk1: '  Okon <b>', gk: '' } })
    expect(mine.atk1).toBe('Okon b')
    expect(mine.gk).toBe(names.gk)
    for (const r of CAP_ROLES) expect(mine[r].length).toBeLessThanOrEqual(12)
  })
})
