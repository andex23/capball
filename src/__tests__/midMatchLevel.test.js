import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore } from '../state/MatchStore'
import { matchLevel, matchEntry, recordLine } from '../game/records'

describe('changing the computer’s level during a match', () => {
  beforeEach(() => useMatchStore.setState({ matchKey: 7, aiDifficulty: 'hard', aiLevelFloor: null, gameMode: 'ai' }))

  it('takes effect at once', () => {
    useMatchStore.getState().changeAiDifficulty('easy')
    expect(useMatchStore.getState().aiDifficulty).toBe('easy')
  })

  it('counts the match at the easiest level played', () => {
    const { changeAiDifficulty } = useMatchStore.getState()
    changeAiDifficulty('easy')
    changeAiDifficulty('hard')
    const s = useMatchStore.getState()
    expect(s.aiDifficulty).toBe('hard')
    expect(matchLevel(s)).toBe('easy')
    expect(recordLine({}, s)).toMatch(/Easy CPU/)
    const entry = matchEntry({ ...s, screen: 'MATCH_END', aiTeam: 'team2', matchResult: { score: { team1: 1, team2: 0 } } }, k => `m${k}`)
    expect(entry.bucket).toBe('cpu:easy')
  })

  it('going harder keeps the level it started on', () => {
    useMatchStore.setState({ aiDifficulty: 'medium' })
    useMatchStore.getState().changeAiDifficulty('hard')
    expect(matchLevel(useMatchStore.getState())).toBe('medium')
  })

  it('is forgotten by the next match', () => {
    useMatchStore.getState().changeAiDifficulty('easy')
    useMatchStore.setState({ matchKey: 8, aiDifficulty: 'hard' })
    expect(matchLevel(useMatchStore.getState())).toBe('hard')
  })

  it('ignores a level that doesn’t exist', () => {
    useMatchStore.getState().changeAiDifficulty('impossible')
    expect(useMatchStore.getState().aiDifficulty).toBe('hard')
  })
})
