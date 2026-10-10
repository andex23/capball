import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useTournamentStore, initTournamentWatch, resultFromMatch } from '../state/tournamentStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useCareerStore } from '../state/careerStore'
import { createTournament, readyFixtures, allFixtures } from '../game/tournament'
import { newCareer, nextMatch } from '../game/career'
import { api } from '../online/supabase'

const initial = useTournamentStore.getState()
const matchInitial = useMatchStore.getState()
const careerInitial = useCareerStore.getState()
initTournamentWatch()
beforeEach(() => {
  useTournamentStore.setState(initial, true)
  useMatchStore.setState({ ...matchInitial, screen: SCREEN.TOURNAMENT_HUB }, true)
  useCareerStore.setState(careerInitial, true)
})
afterEach(() => { vi.restoreAllMocks() })
function competition(format = 'league') {
  const t = createTournament({ format, legs: 2, matchDuration: 120, teams: [
    { name: 'Host', cpu: false }, { name: 'Friend', cpu: false }, { name: 'Third', cpu: false }, { name: 'Fourth', cpu: false },
  ] })
  useTournamentStore.setState({ local: t })
  return t
}
describe('LAN competitions', () => {
  it.each(['league', 'knockout'])('opens a %s fixture over LAN without changing its identity', format => {
    const t = competition(format), f = readyFixtures(t)[0]
    expect(useTournamentStore.getState().playLanFixture('local', f)).toBe(true)
    expect(useMatchStore.getState()).toMatchObject({ screen: SCREEN.LAN, matchDuration: 120, goalTarget: 0, matchResult: null })
    expect(useTournamentStore.getState().playing).toMatchObject({ kind: 'local', lan: true, fixture: { id: f.id }, knockout: format === 'knockout' })
    expect(useTournamentStore.getState().lanSnapshot().tournament.id).toBe(t.id)
  })
  it('maps an away host’s score and penalties back to home/away correctly', async () => {
    const t = competition(), f = readyFixtures(t)[0]
    const away = t.teams.find(x => x.id === f.away)
    useTournamentStore.getState().playLanFixture('local', f, f.away)
    expect(useMatchStore.getState().teamConfig.team1.name).toBe(away.name)
    await useTournamentStore.getState().recordPlayed({ score: { team1: 3, team2: 1 } })
    expect(allFixtures(useTournamentStore.getState().local).find(x => x.id === f.id).result).toMatchObject({ home: 1, away: 3 })
    expect(resultFromMatch({ score: { team1: 1, team2: 1 }, penaltyScore: { team1: 4, team2: 2 } }, true, true)).toEqual({ home: 1, away: 1, pens: { home: 2, away: 4 } })
  })
  it('saves each player’s team edits to the right fixture team', () => {
    const t = competition(), f = readyFixtures(t)[0]
    useTournamentStore.getState().playLanFixture('local', f, f.away)
    useMatchStore.getState().setTeamConfig('team1', { name: 'Away custom' })
    useMatchStore.getState().setTeamConfig('team2', { name: 'Home custom' })
    useMatchStore.getState().goToScreen(SCREEN.TEAM_SELECT)
    useMatchStore.getState().goToScreen(SCREEN.STADIUM_SELECT)
    const updated = useTournamentStore.getState().local
    expect(updated.teams.find(x => x.id === f.away).name).toBe('Away custom')
    expect(updated.teams.find(x => x.id === f.home).name).toBe('Home custom')
    expect(updated.fixtures).toEqual(t.fixtures)
  })
  it('waits for cup penalties and records the fixture only once', async () => {
    const t = competition('knockout'), f = readyFixtures(t)[0]
    useTournamentStore.getState().playLanFixture('local', f)
    await useTournamentStore.getState().recordPlayed({ score: { team1: 1, team2: 1 } })
    expect(useTournamentStore.getState().playing.recorded).toBe(false)
    const finish = { score: { team1: 1, team2: 1 }, penaltyScore: { team1: 3, team2: 2 } }
    await useTournamentStore.getState().recordPlayed(finish)
    const after = useTournamentStore.getState().local
    await useTournamentStore.getState().recordPlayed(finish)
    expect(useTournamentStore.getState().local).toBe(after)
    expect(allFixtures(after).find(x => x.id === f.id).winner).toBe(f.home)
  })
  it('keeps guest competition data separate and never reports it online', async () => {
    const own = competition(), remote = competition('knockout')
    useTournamentStore.setState({ local: own })
    const report = vi.spyOn(api, 'report')
    useTournamentStore.getState().receiveLanSnapshot({ kind: 'local', tournament: remote, fixture: readyFixtures(remote)[0] })
    expect(useTournamentStore.getState().local).toBe(own)
    expect(useTournamentStore.getState().playing.kind).toBe('lanGuest')
    await useTournamentStore.getState().recordPlayed({ score: { team1: 4, team2: 0 } })
    expect(report).not.toHaveBeenCalled()
    expect(useTournamentStore.getState().lanGuestTournament.id).toBe(remote.id)
  })
  it('rejects invalid or finished fixtures, including a forged pairing', () => {
    const t = competition(), f = readyFixtures(t)[0]
    expect(useTournamentStore.getState().playLanFixture('local', { ...f, id: 'missing' })).toBe(false)
    expect(useTournamentStore.getState().playLanFixture('local', f, 'missing')).toBe(false)
    useTournamentStore.getState().receiveLanSnapshot({ kind: 'local', tournament: t, fixture: { ...f, away: f.home } })
    expect(useTournamentStore.getState().playing).toBeNull()
  })
  it('keeps the host on their career club for both home and away fixtures', () => {
    const career = newCareer({ name: 'My club' })
    useCareerStore.setState({ career })
    // Advance fixture results in a clone so nextMatch selects the away leg.
    for (const away of [false, true]) {
      const league = structuredClone(career.league)
      const target = allFixtures(league).find(f => (away ? f.away : f.home) === 'T1')
      for (const f of allFixtures(league)) {
        if (f.id === target.id) break
        if (f.home === 'T1' || f.away === 'T1') f.result = { home: 1, away: 0 }
      }
      useCareerStore.setState({ career: { ...career, league } })
      useTournamentStore.setState({ playing: null, stash: null })
      expect(nextMatch(league).id).toBe(target.id)
      expect(useTournamentStore.getState().playLanFixture('career', target)).toBe(true)
      expect(useMatchStore.getState().teamConfig.team1.name).toBe(career.club.name)
      expect(useTournamentStore.getState().playing.reversed).toBe(away)
    }
  })
})
