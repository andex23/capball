import { describe, it, expect, beforeEach } from 'vitest'
import { useAccountStore, PROGRESS_KEYS } from '../state/accountStore'
import { useSavedStore, recordHistory } from '../state/savedMatch'
import { useMatchStore } from '../state/MatchStore'
import { playDaily } from '../state/dailyStore'
import { currentProgress } from '../state/unlocks'

const result = { score: { team1: 3, team2: 0 }, stats: { team1: { shots: 4 }, team2: { shots: 1 } } }

describe('stats and rewards need an account', () => {
  beforeEach(() => {
    useSavedStore.setState({ history: [], career: { ...useSavedStore.getState().career, played: 0, won: 0 } })
    useMatchStore.setState({ gameMode: 'ai', aiTeam: 'team2' })
  })

  it('a guest match is not counted', () => {
    useAccountStore.setState({ username: null })
    recordHistory(result, 'ai')
    expect(useSavedStore.getState().history).toHaveLength(0)
    expect(useSavedStore.getState().career.played).toBe(0)
  })

  it('a signed-in match is counted', () => {
    useAccountStore.setState({ username: 'dru' })
    recordHistory(result, 'ai')
    expect(useSavedStore.getState().history).toHaveLength(1)
    expect(useSavedStore.getState().career.won).toBe(1)
    useAccountStore.setState({ username: null })
  })

  it('guests have no rewards progress and cannot start the daily challenge', () => {
    useAccountStore.setState({ username: null })
    expect(Object.values(currentProgress()).every((v) => v === 0)).toBe(true)
    expect(playDaily()).toBe(false)
  })

  it('signing out clears career, stats, streak and unlocks from the phone', () => {
    for (const k of ['capball:history:v1', 'capball:career:v1', 'capball:career-mode:v1', 'capball:daily:v1', 'capball:unlocks-seen:v1']) expect(PROGRESS_KEYS).toContain(k)
  })
})
