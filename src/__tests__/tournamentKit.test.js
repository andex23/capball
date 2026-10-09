import { describe, it, expect } from 'vitest'
import { useTournamentStore, initTournamentWatch } from '../state/tournamentStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { allFixtures } from '../game/tournament'

describe('tournament kits', () => {
  it('leaving a fixture any way gives the player their own kit back', () => {
    initTournamentWatch()
    const own = { ...useMatchStore.getState().teamConfig.team1, name: 'Lagos Fizz', primary: '#E53935' }
    useMatchStore.setState({ teamConfig: { ...useMatchStore.getState().teamConfig, team1: own }, screen: SCREEN.TOURNAMENT_HUB })
    const me = { key: 'a', name: 'Lagos Fizz', primary: '#E53935', edge: '#FFFFFF', cpu: false, mine: true, difficulty: 'medium' }
    const cpu = (n, c) => ({ key: n, name: n, primary: c, edge: '#FFFFFF', cpu: true, mine: false, difficulty: 'medium' })
    useTournamentStore.getState().createLocal({ format: 'league', legs: 1, teams: [me, cpu('Green', '#43A047'), cpu('Blue', '#1E88E5'), cpu('Gold', '#FFB300')], matchDuration: 120 })
    const f = allFixtures(useTournamentStore.getState().local).find((x) => x.away === 'T1')
    useTournamentStore.getState().playFixture('local', f)
    expect(useMatchStore.getState().teamConfig.team1.name).not.toBe('Lagos Fizz') // the CPU side is at home
    useMatchStore.getState().goToScreen(SCREEN.PLAYING)
    useMatchStore.getState().quitMatch(SCREEN.MENU) // pause → quit
    expect(useTournamentStore.getState().playing).toBeNull()
    expect(useMatchStore.getState().teamConfig.team1.name).toBe('Lagos Fizz')
    expect(useMatchStore.getState().teamConfig.team1.primary).toBe('#E53935')
  })
})
