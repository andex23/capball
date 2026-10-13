import { describe, it, expect } from 'vitest'
import { kitsApart, similarColours } from '../game/kitClash'
import { DEFAULT_TEAM_CONFIG } from '../state/MatchStore'

const red = { ...DEFAULT_TEAM_CONFIG.team1 }

describe('two sides that look the same', () => {
  it('two default kits: the away side changes colours and name', () => {
    const { team1, team2 } = kitsApart({ team1: red, team2: { ...red } })
    expect(team1).toEqual(red)
    expect(similarColours(team1.primary, team2.primary)).toBe(false)
    expect(team2.name).toBe('Team 2')
  })
  it('the same printed design: the away side drops it', () => {
    const t = kitsApart({ team1: { ...red, name: 'Lions', art: 'cola' }, team2: { ...red, name: 'Tigers', art: 'cola' } })
    expect(t.team2.art).toBe('')
    expect(t.team2.name).toBe('Tigers')
  })
  it('a blue home side gets a different away kit, never blue', () => {
    const t = kitsApart({ team1: { ...red, primary: '#1565C0', name: 'Blues' }, team2: { ...red, primary: '#1565C0', name: 'Rovers' } })
    expect(similarColours(t.team2.primary, '#1565C0')).toBe(false)
  })
  it('same name, different colours: only the name changes', () => {
    const t = kitsApart({ team1: { ...red, name: 'United' }, team2: { ...red, primary: '#1565C0', name: 'united' } })
    expect(t.team2.primary).toBe('#1565C0')
    expect(t.team2.name).toBe('united Away')
  })
  it('kits that already differ are left alone', () => {
    const teams = { team1: red, team2: { ...DEFAULT_TEAM_CONFIG.team2 } }
    expect(kitsApart(teams)).toBe(teams)
  })
})
