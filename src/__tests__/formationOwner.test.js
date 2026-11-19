import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore, canPickFormation } from '../state/MatchStore'

const initial = useMatchStore.getState()
beforeEach(() => useMatchStore.setState(initial, true))

describe('each side picks only its own formation', () => {
  it('against the computer you set yours, never the computer’s', () => {
    useMatchStore.setState({ gameMode: 'ai', aiTeam: 'team2' })
    useMatchStore.getState().setFormation('team1', 'diamond')
    useMatchStore.getState().setFormation('team2', 'diamond')
    expect(useMatchStore.getState().formations).toEqual({ team1: 'diamond', team2: 'default' })
  })
  it('online, a player sets only their own side', () => {
    const s = { gameMode: 'online', onlineMyTeam: 'team1' }
    expect(canPickFormation(s, 'team1')).toBe(true)
    expect(canPickFormation(s, 'team2')).toBe(false)
    expect(canPickFormation(s, 'team2', 'team2')).toBe(true) // the guest's own pick, arriving on the host
  })
  it('unknown formations are ignored', () => {
    useMatchStore.setState({ gameMode: 'local' })
    useMatchStore.getState().setFormation('team1', 'toString')
    expect(useMatchStore.getState().formations.team1).toBe('default')
  })
})
