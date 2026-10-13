import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../multiplayer/MultiplayerManager', async (orig) => ({ ...(await orig()), createRoom: vi.fn().mockResolvedValue('ROOM42') }))

const { useTournamentStore } = await import('../state/tournamentStore')
const { useMatchStore } = await import('../state/MatchStore')
const { createTournament } = await import('../game/tournament')
const { api } = await import('../online/supabase')

const initial = useTournamentStore.getState()
afterEach(() => { vi.restoreAllMocks(); useTournamentStore.setState(initial, true) })

const league = (friendName) => createTournament({ format: 'league', now: 1, rng: () => 0.5, teams: [
  { name: 'Host', cpu: false }, { name: friendName, primary: '#123456', cpu: false }, { name: 'CPU', cpu: true },
] })

describe('hosting a live online fixture', () => {
  it('plays with the opponent’s latest kit, not the copy the hub loaded earlier', async () => {
    const stale = league('Old Name')
    useTournamentStore.setState({ online: { code: 'ABC123', tournament: stale, snapshot: { seats: [], closed: false } } })
    const fresh = league('Friends FC')
    const refresh = vi.fn(async () => { useTournamentStore.setState({ online: { code: 'ABC123', tournament: fresh, snapshot: { seats: [], closed: false } } }); return fresh })
    useTournamentStore.setState({ openOnline: refresh })
    vi.spyOn(api, 'setRoom').mockResolvedValue({ ok: true })
    const fixture = stale.fixtures.find((f) => [f.home, f.away].includes('T1') && [f.home, f.away].includes('T2'))
    await useTournamentStore.getState().hostLiveFixture(fixture)
    expect(refresh).toHaveBeenCalledWith('ABC123', { quiet: true })
    const names = Object.values(useMatchStore.getState().teamConfig).map((t) => t.name)
    expect(names).toContain('Friends FC')
    expect(names).not.toContain('Old Name')
    expect(api.setRoom).toHaveBeenCalledWith('ABC123', fixture.id, fixture.home, 'ROOM42')
  })

  it('still hosts with the copy it has when the refresh fails', async () => {
    const t = league('Offline Friend')
    useTournamentStore.setState({ online: { code: 'ABC123', tournament: t, snapshot: { seats: [], closed: false } }, openOnline: vi.fn().mockRejectedValue(new Error('offline')) })
    vi.spyOn(api, 'setRoom').mockResolvedValue({ ok: true })
    const fixture = t.fixtures.find((f) => [f.home, f.away].includes('T1') && [f.home, f.away].includes('T2'))
    await useTournamentStore.getState().hostLiveFixture(fixture)
    expect(Object.values(useMatchStore.getState().teamConfig).map((x) => x.name)).toContain('Offline Friend')
    expect(useTournamentStore.getState().busy).toBe(false)
  })
})
