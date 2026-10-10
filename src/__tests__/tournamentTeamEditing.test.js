import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTournamentStore } from '../state/tournamentStore'
import { createTournament } from '../game/tournament'
import { api } from '../online/supabase'

const initial = useTournamentStore.getState()
afterEach(() => { vi.restoreAllMocks(); useTournamentStore.setState(initial, true) })

function open() {
  const tournament = createTournament({ format: 'league', teams: [
    { name: 'Host', cpu: false }, { name: 'Friend', cpu: false }, { name: 'CPU', cpu: true },
  ] })
  const online = { code: 'ABC123', tournament, snapshot: { seats: [{ teamId: 'T2', mine: true }], closed: false } }
  useTournamentStore.setState({ online })
  return online
}

describe('online tournament team editing', () => {
  it('saves the seat holder’s identity without changing fixtures or protected fields', async () => {
    open()
    const update = vi.spyOn(api, 'updateTeam').mockResolvedValue({ ok: true })
    const refresh = vi.fn().mockResolvedValue(true)
    useTournamentStore.setState({ openOnline: refresh })
    expect(await useTournamentStore.getState().updateOnlineTeam('T2', {
      name: 'Friends FC', primary: '#123456', numbers: { atk1: 9 }, id: 'HACK', cpu: true,
    })).toBe(true)
    expect(update).toHaveBeenCalledWith('ABC123', 'T2', expect.objectContaining({ name: 'Friends FC', primary: '#123456', numbers: { atk1: 9 } }))
    const config = update.mock.calls[0][2]
    expect(config).not.toHaveProperty('id')
    expect(config).not.toHaveProperty('cpu')
    expect(config).not.toHaveProperty('difficulty')
    expect(refresh).toHaveBeenCalledWith('ABC123', { quiet: true })
  })

  it('refuses edits to another seat and preserves the draft on a failed save', async () => {
    open()
    const update = vi.spyOn(api, 'updateTeam').mockRejectedValue(new Error('Offline'))
    expect(await useTournamentStore.getState().updateOnlineTeam('T1', { name: 'Stolen' })).toBe(false)
    expect(update).not.toHaveBeenCalled()
    expect(await useTournamentStore.getState().updateOnlineTeam('T2', { name: 'Friends FC' })).toBe(false)
    expect(useTournamentStore.getState()).toMatchObject({ error: 'Offline', busy: false })
    expect(useTournamentStore.getState().online.tournament.teams[1].name).toBe('Friend')
  })
})
