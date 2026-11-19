import { describe, it, expect } from 'vitest'
import { useTournamentStore, initTournamentWatch } from '../state/tournamentStore'
import { useCareerStore } from '../state/careerStore'
import { newCareer, careerNext, recordCareerResult, recordCupResult, ME } from '../game/career'
import { useMatchStore, DEFAULT_TEAM_CONFIG, SCREEN } from '../state/MatchStore'
import { allFixtures } from '../game/tournament'

describe('tournament kits', () => {
  it('leaving a fixture any way gives the player their own kit back', () => {
    initTournamentWatch()
    const own = { ...useMatchStore.getState().teamConfig.team1, name: 'Lagos Fizz', primary: '#E53935' }
    useMatchStore.setState({ teamConfig: { ...useMatchStore.getState().teamConfig, team1: own }, screen: SCREEN.TOURNAMENT_HUB })
    const me = { key: 'a', name: 'Lagos Fizz', primary: '#E53935', edge: '#FFFFFF', cpu: false, mine: true, difficulty: 'medium' }
    const cpu = (n, c) => ({ key: n, name: n, primary: c, edge: '#FFFFFF', cpu: true, mine: false, difficulty: 'medium' })
    useTournamentStore.getState().createLocal({ format: 'league', legs: 1, teams: [cpu('Green', '#43A047'), cpu('Blue', '#1E88E5'), cpu('Gold', '#FFB300'), me], matchDuration: 120 })
    const f = allFixtures(useTournamentStore.getState().local).find((x) => x.away === 'T4')
    useTournamentStore.getState().playFixture('local', f)
    expect(useMatchStore.getState().teamConfig.team1.name).not.toBe('Lagos Fizz') // the CPU side is at home
    useMatchStore.getState().goToScreen(SCREEN.PLAYING)
    useMatchStore.getState().quitMatch(SCREEN.MENU) // pause → quit
    expect(useTournamentStore.getState().playing).toBeNull()
    expect(useMatchStore.getState().teamConfig.team1.name).toBe('Lagos Fizz')
    expect(useMatchStore.getState().teamConfig.team1.primary).toBe('#E53935')
  })

  it('an away career fixture uses the squad’s cap art, bands, numbers and player prints', () => {
    let career = newCareer({ name: 'Rail End', art: 'stout', bands: { atk1: 'red' }, numbers: { atk1: 0 } }, { now: 45 })
    let due = careerNext(career)
    while (due.fixture.away !== ME) {
      const record = due.kind === 'cup' ? recordCupResult : recordCareerResult
      career = record(career, due.fixture.id, { home: 1, away: 0 })
      due = careerNext(career)
    }
    useCareerStore.setState({ career })
    useTournamentStore.getState().playFixture(due.kind === 'cup' ? 'careerCup' : 'career', due.fixture)
    const kit = useMatchStore.getState().teamConfig.team2
    expect(kit.art).toBe('stout')
    expect(kit.bands.atk1).toBe('red')
    expect(kit.numbers).toEqual({ ...DEFAULT_TEAM_CONFIG.team1.numbers, atk1: 0 })
    expect(kit.players.atk1).toBe(career.squad.atk1.name.split(' ').at(-1).slice(0, 12))
  })
})
