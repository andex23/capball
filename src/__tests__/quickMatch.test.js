import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMatchStore, clearMatchTimers } from '../state/MatchStore'
import { personalTeams, quickClubKit, quickOpponent, QUICK_CLUBS } from '../game/quickMatch'
import { pickPrefs } from '../utils/storage'

const initial = useMatchStore.getInitialState()
const match = () => useMatchStore.getState()
beforeEach(() => useMatchStore.setState(initial, true))
afterEach(clearMatchTimers)

describe('quick match', () => {
  it('keeps a named personal kit and gives an unnamed team its club name', () => {
    match().setTeamConfig('team1', { name: 'Rail End', customName: true, art: 'stout' })
    const own = personalTeams(match(), '')
    expect(own.team1).toMatchObject({ name: 'Rail End', art: 'stout' })
    expect(own.team2.name).toBe('Blue Stars')
  })

  it('draws a different opponent even when the human changes their club', () => {
    for (const own of QUICK_CLUBS) {
      for (const draw of [0, 0.35, 0.99999]) {
        const cpu = quickOpponent(own, draw)
        expect(cpu.name).not.toBe(own.name)
        expect(cpu.primary).not.toBe(own.primary)
      }
    }
  })

  it.each(['team1', 'team2'])('protects the computer in slot %s, including a career away fixture', (cpu) => {
    const mine = cpu === 'team1' ? 'team2' : 'team1'
    useMatchStore.setState({ gameMode: 'ai', aiTeam: cpu })
    match().setFormation(mine, 'attack')
    match().setFormation(cpu, 'diamond')
    expect(match().formations).toEqual({ [mine]: 'attack', [cpu]: 'default' })
  })

  it.each(['team1', 'team2'])('lets an online player in slot %s change only their own formation', (mine) => {
    useMatchStore.setState({ gameMode: 'online', onlineMyTeam: mine })
    const opponent = mine === 'team1' ? 'team2' : 'team1'
    match().setFormation(mine, 'line')
    match().setFormation(opponent, 'attack')
    expect(match().formations).toEqual({ [mine]: 'line', [opponent]: 'default' })
  })

  it('uses the picked clubs in play, keeps personal setups on disk and restores both after quitting', () => {
    match().setFormation('team2', 'attack') // the other person used this in a local game
    match().setGameMode('ai')
    const prefs = pickPrefs(match())
    const kits = { team1: quickClubKit(QUICK_CLUBS[0], 'team1'), team2: quickClubKit(QUICK_CLUBS[1], 'team2') }
    match().startQuickMatch(kits)
    expect(match().teamConfig).toEqual(kits)
    expect(match().formations.team2).toBe('default')
    expect(pickPrefs(match())).toEqual(prefs)
    match().quitMatch()
    expect(match().teamConfig).toEqual(prefs.teamConfig)
    expect(match().formations).toEqual(prefs.formations)
  })
})
