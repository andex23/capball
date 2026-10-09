import { describe, it, expect } from 'vitest'
import { scorerLines } from '../game/shareCard'
import { addRivalResult } from '../state/savedMatch'

const teamConfig = {
  team1: { name: 'Lagos Fizz', numbers: { atk1: 9 }, players: { atk1: 'Okafor', mid: 'Eze' } },
  team2: { name: 'Royal Crowns', players: { def1: 'Rossi' } },
}

describe('share card and rivals', () => {
  it('lists scorers by side, with braces and own goals', () => {
    const lines = scorerLines(teamConfig, [
      { team: 'team1', cap: 'team1_atk1' }, { team: 'team1', cap: 'team1_atk1' }, { team: 'team1', cap: 'team1_mid' },
      { team: 'team1', cap: 'team2_def1', own: true }, { team: 'team2', cap: 'team2_def1', shootout: true },
    ])
    expect(lines.team1).toEqual(['Okafor 2', 'Eze', 'Rossi (og)'])
    expect(lines.team2).toEqual([])
  })

  it('keeps a running head-to-head per opponent', () => {
    let r = {}
    r = addRivalResult(r, 'Royal Crowns', { gf: 2, ga: 1, won: true, lost: false, primary: '#4A148C', at: '2026-10-01' })
    r = addRivalResult(r, 'Royal Crowns', { gf: 0, ga: 0, won: false, lost: false, at: '2026-10-02' })
    r = addRivalResult(r, 'Royal Crowns', { gf: 0, ga: 3, won: false, lost: true, online: true, at: '2026-10-03' })
    expect(r['Royal Crowns']).toMatchObject({ w: 1, d: 1, l: 1, gf: 2, ga: 4, online: true, primary: '#4A148C' })
  })
})
