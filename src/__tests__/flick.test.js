import { describe, it, expect } from 'vitest'
import { flickError, controllableTeams } from '../game/flick'

const ok = { paused: false, phase: 'SELECT', activeTeam: 'team1', freeKickCapId: null }
const v = { x: 2, y: 1 }

describe('flickError', () => {
  it('allows the active team to flick its own cap', () => {
    expect(flickError(ok, { capId: 'team1_atk1', velocity: v })).toBeNull()
    expect(flickError({ ...ok, phase: 'AIM' }, { capId: 'team1_gk', velocity: v })).toBeNull()
  })

  it('refuses out-of-turn, paused and mid-resolve flicks', () => {
    expect(flickError(ok, { capId: 'team2_atk1', velocity: v })).toBe('not-your-cap')
    expect(flickError({ ...ok, paused: true }, { capId: 'team1_atk1', velocity: v })).toBe('paused')
    expect(flickError({ ...ok, phase: 'RESOLVE' }, { capId: 'team1_atk1', velocity: v })).toBe('wrong-phase')
    expect(flickError({ ...ok, phase: 'KICKOFF' }, { capId: 'team1_atk1', velocity: v })).toBe('wrong-phase')
    expect(flickError(ok, { capId: 'team1_atk1', velocity: v, byTeam: 'team2' })).toBe('not-your-turn')
  })

  it('only the designated taker can take a set piece', () => {
    const fk = { ...ok, freeKickCapId: 'team1_atk1' }
    expect(flickError(fk, { capId: 'team1_def1', velocity: v })).toBe('set-piece-taker-only')
    expect(flickError(fk, { capId: 'team1_atk1', velocity: v })).toBeNull()
  })

  it('rejects bad velocities', () => {
    expect(flickError(ok, { capId: 'team1_atk1', velocity: { x: NaN, y: 0 } })).toBe('bad-velocity')
    expect(flickError(ok, { capId: 'team1_atk1', velocity: { x: 0, y: 0 } })).toBe('bad-velocity')
    expect(flickError(ok, { capId: 'team1_atk1', velocity: null })).toBe('bad-velocity')
    expect(flickError(ok, { capId: 'ball', velocity: v })).toBe('not-your-cap')
  })
})

describe('controllableTeams', () => {
  it('local players control both teams', () => {
    expect(controllableTeams({ gameMode: 'local' })).toEqual(['team1', 'team2'])
  })
  it('never the CPU team', () => {
    expect(controllableTeams({ gameMode: 'ai', aiTeam: 'team2' })).toEqual(['team1'])
  })
  it('online: only your own team', () => {
    expect(controllableTeams({ gameMode: 'online', onlineMyTeam: 'team2' })).toEqual(['team2'])
    expect(controllableTeams({ gameMode: 'online', onlineMyTeam: null })).toEqual([])
  })
})
