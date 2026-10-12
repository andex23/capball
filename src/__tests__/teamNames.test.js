import { describe, it, expect } from 'vitest'
import { autoTeamNames, isCustomName } from '../game/teamNames'

const cfg = (n1, n2, extra = {}) => ({ team1: { name: n1, ...extra.team1 }, team2: { name: n2, ...extra.team2 } })

describe('team names follow the players', () => {
  it('vs the computer: your username and CPU', () => {
    expect(autoTeamNames({ gameMode: 'ai', aiTeam: 'team2', teamConfig: cfg('Team 1', 'Team 2'), username: 'Eda Ekweme' }))
      .toEqual({ team1: { name: 'Eda Ekweme' }, team2: { name: 'CPU' } })
  })
  it('online: only your own side, with your username (the other phone names theirs)', () => {
    expect(autoTeamNames({ gameMode: 'online', onlineMyTeam: 'team2', teamConfig: cfg('Ada', 'Team 2'), username: 'Tunde' }))
      .toEqual({ team2: { name: 'Tunde' } })
  })
  it('never touches a name the player typed', () => {
    const tc = cfg('Lagos Lions', 'Team 2', { team1: { customName: true } })
    expect(autoTeamNames({ gameMode: 'ai', aiTeam: 'team2', teamConfig: tc, username: 'Eda' })).toEqual({ team2: { name: 'CPU' } })
    // older saves without the flag: a real name counts as typed
    expect(isCustomName({ name: 'Yaba Boys' }, 'Eda')).toBe(true)
    expect(isCustomName({ name: 'Eda' }, 'Eda')).toBe(false)
    expect(isCustomName({ name: 'CPU' }, 'Eda')).toBe(false)
  })
  it('two players on one phone, or no username: back to Team 1 / Team 2', () => {
    expect(autoTeamNames({ gameMode: 'local', teamConfig: cfg('Eda', 'CPU'), username: 'Eda' })).toEqual({ team1: { name: 'Team 1' }, team2: { name: 'Team 2' } })
    expect(autoTeamNames({ gameMode: 'ai', aiTeam: 'team2', teamConfig: cfg('Team 1', 'Team 2'), username: null })).toEqual({ team2: { name: 'CPU' } })
  })
  it('keeps long usernames within the name limit', () => {
    const r = autoTeamNames({ gameMode: 'ai', aiTeam: 'team2', teamConfig: cfg('Team 1', 'Team 2'), username: 'Chukwuemeka Okonkwo-Adeyemi' })
    expect(r.team1.name.length).toBeLessThanOrEqual(16)
  })
})
