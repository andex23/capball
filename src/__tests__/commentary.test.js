import { describe, it, expect } from 'vitest'
import { goalLine, line, playerOf } from '../game/commentary'

const teamConfig = {
  team1: { name: 'Lagos Fizz', numbers: { atk1: 9 }, players: { atk1: 'Okafor' } },
  team2: { name: 'Royal Crowns', numbers: { gk: 1 }, players: { gk: 'Rossi' } },
}
const g = (o) => goalLine({ teamConfig, scorerTeam: 'team1', cap: 'team1_atk1', score: { team1: 1, team2: 0 }, goalLog: [{ cap: 'team1_atk1' }], seed: 's', ...o })

describe('commentary', () => {
  it('names the player with their number', () => {
    expect(playerOf(teamConfig, 'team1_atk1').label).toBe('#9 Okafor')
    expect(g().line).toContain('#9 Okafor')
  })

  it('reads the situation', () => {
    expect(g().kind).toBe('opener')
    expect(g({ score: { team1: 1, team2: 1 }, goalLog: [{ cap: 'team2_gk' }, { cap: 'team1_atk1' }] }).kind).toBe('equaliser')
    expect(g({ score: { team1: 2, team2: 1 }, goalLog: [{ cap: 'x' }, { cap: 'y' }, { cap: 'team1_atk1' }] }).kind).toBe('ahead')
    expect(g({ score: { team1: 3, team2: 0 }, goalLog: [{ cap: 'x' }, { cap: 'y' }, { cap: 'team1_atk1' }] }).kind).toBe('extend')
    expect(g({ score: { team1: 1, team2: 3 }, goalLog: [{ cap: 'team1_atk1' }] }).kind).toBe('pullBack')
    expect(g({ score: { team1: 2, team2: 0 }, goalLog: [{ cap: 'team1_atk1' }, { cap: 'team1_atk1' }] }).kind).toBe('brace')
    expect(g({ score: { team1: 3, team2: 0 }, goalLog: Array(3).fill({ cap: 'team1_atk1' }) }).kind).toBe('hattrick')
    expect(g({ score: { team1: 2, team2: 1 }, goalLog: [{ cap: 'a' }, { cap: 'b' }, { cap: 'team1_atk1' }], late: true }).kind).toBe('late')
    expect(g({ own: true, cap: 'team2_gk' }).kind).toBe('own')
    expect(g({ shootout: true }).kind).toBe('penalty')
  })

  it('the same moment always reads the same line; other moments vary', () => {
    expect(g().line).toBe(g().line)
    const lines = new Set(Array.from({ length: 30 }, (_, i) => g({ seed: `m${i}` }).line))
    expect(lines.size).toBeGreaterThan(1)
  })

  it('fills team names into the other moments', () => {
    expect(line('corner', { teamConfig, team: 'team2', seed: 'a' })).toContain('Royal Crowns')
    expect(line('fullTimeWin', { teamConfig, team: 'team1', winner: 'team1', score: { team1: 3, team2: 1 }, seed: 'a' })).toMatch(/Lagos Fizz|3–1/)
  })
})
