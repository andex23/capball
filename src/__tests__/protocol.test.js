import { describe, it, expect } from 'vitest'
import { validateGuestMessage, sanitizeTeamConfig, sanitizeName, filterSynced, pickSynced, SYNC_KEYS } from '../multiplayer/protocol'

const playing = { screen: 'PLAYING', phase: 'SELECT', activeTeam: 'team2', paused: false, freeKickCapId: null }
const msg = (type, data) => ({ type, data })

describe('sanitizeTeamConfig', () => {
  it('keeps valid fields', () => {
    expect(sanitizeTeamConfig({ name: '  Blue  Stars ', primary: '#123abc', edge: '#FFFFFF', badge: 'star', pattern: 'ring', finish: 'gloss' }))
      .toEqual({ name: 'Blue Stars', primary: '#123abc', edge: '#FFFFFF', badge: 'star', pattern: 'ring', finish: 'gloss' })
  })

  it('drops injected or malformed fields', () => {
    expect(sanitizeTeamConfig({
      primary: 'red; background:url(x)',
      edge: '#fff',
      badge: '<script>',
      pattern: 'nope',
      finish: 42,
      evil: true,
      numbers: { gk: 1, def1: 100, atk1: 3.5, hacker: 7 },
    })).toEqual({ numbers: { gk: 1 } })
    expect(sanitizeTeamConfig(null)).toEqual({})
    expect(sanitizeTeamConfig('x')).toEqual({})
  })

  it('caps name length and strips control characters', () => {
    expect(sanitizeName('A'.repeat(50))).toHaveLength(16)
    expect(sanitizeName('Hi\u0000\u0007there')).toBe('Hithere')
    expect(sanitizeName('   ')).toBeNull()
    expect(sanitizeName(5)).toBeNull()
  })
})

describe('validateGuestMessage', () => {
  it('rejects junk', () => {
    expect(validateGuestMessage(null, playing)).toBeNull()
    expect(validateGuestMessage({ type: 'stateChange', data: { score: { team2: 99 } } }, playing)).toBeNull()
    expect(validateGuestMessage({ type: 7 }, playing)).toBeNull()
    expect(validateGuestMessage([], playing)).toBeNull()
  })

  it('only lets the guest edit its team on the team screen', () => {
    const m = msg('teamConfig', { config: { name: 'Guests' } })
    expect(validateGuestMessage(m, { screen: 'TEAM_SELECT' })).toEqual({ type: 'teamConfig', config: { name: 'Guests' } })
    expect(validateGuestMessage(m, playing)).toBeNull()
    expect(validateGuestMessage(msg('teamConfig', { config: { bogus: 1 } }), { screen: 'TEAM_SELECT' })).toBeNull()
  })

  it('only accepts known formations on the formation screen', () => {
    expect(validateGuestMessage(msg('formation', { key: 'diamond' }), { screen: 'FORMATION' })).toEqual({ type: 'formation', key: 'diamond' })
    expect(validateGuestMessage(msg('formation', { key: 'toString' }), { screen: 'FORMATION' })).toBeNull()
    expect(validateGuestMessage(msg('formation', { key: 'diamond' }), playing)).toBeNull()
  })

  it('coerces ready and pause to booleans', () => {
    expect(validateGuestMessage(msg('ready', { ready: 'yes' }), playing)).toEqual({ type: 'ready', ready: false })
    expect(validateGuestMessage(msg('ready', { ready: true }), playing)).toEqual({ type: 'ready', ready: true })
    expect(validateGuestMessage(msg('pause', { paused: true }), playing)).toEqual({ type: 'pause', paused: true })
    expect(validateGuestMessage(msg('pause', { paused: true }), { screen: 'MENU' })).toBeNull()
  })

  it('only lets the guest select its own caps on its own turn', () => {
    expect(validateGuestMessage(msg('select', { capId: 'team2_atk1' }), playing)).toEqual({ type: 'select', capId: 'team2_atk1' })
    expect(validateGuestMessage(msg('select', { capId: 'team1_atk1' }), playing)).toBeNull()
    expect(validateGuestMessage(msg('select', { capId: 'team2_atk1' }), { ...playing, activeTeam: 'team1' })).toBeNull()
    expect(validateGuestMessage(msg('select', { capId: 'team2_ref' }), playing)).toBeNull()
    expect(validateGuestMessage(msg('select', { capId: 'team2_def1' }), { ...playing, freeKickCapId: 'team2_atk1' })).toBeNull()
    expect(validateGuestMessage(msg('select', { capId: 'team2_atk1' }), { ...playing, paused: true })).toBeNull()
    expect(validateGuestMessage(msg('select', { capId: { length: 1 } }), playing)).toBeNull()
  })

  it('only forwards well-formed flicks of guest caps', () => {
    expect(validateGuestMessage(msg('flick', { capId: 'team2_def1', velocity: { x: 1, y: -2 } }), playing))
      .toEqual({ type: 'flick', capId: 'team2_def1', velocity: { x: 1, y: -2 } })
    expect(validateGuestMessage(msg('flick', { capId: 'team1_def1', velocity: { x: 1, y: 0 } }), playing)).toBeNull()
    expect(validateGuestMessage(msg('flick', { capId: 'team2_def1', velocity: { x: NaN, y: 0 } }), playing)).toBeNull()
    expect(validateGuestMessage(msg('flick', { capId: 'team2_def1', velocity: { x: Infinity, y: 0 } }), playing)).toBeNull()
    expect(validateGuestMessage(msg('flick', { capId: 'team2_def1', velocity: '1,1' }), playing)).toBeNull()
  })
})

describe('state sync filtering', () => {
  it('guest only applies whitelisted keys', () => {
    const out = filterSynced({ score: { team1: 1, team2: 0 }, onlineMyTeam: 'team1', gameMode: 'local', startGame: 'x' })
    expect(out).toEqual({ score: { team1: 1, team2: 0 } })
    expect(filterSynced(null)).toEqual({})
  })

  it('host snapshot never includes local-only keys', () => {
    const snap = pickSynced({ onlineMyTeam: 'team1', onlineReady: {}, gameMode: 'online', score: 1 })
    expect(Object.keys(snap).sort()).toEqual([...SYNC_KEYS].sort())
    expect(SYNC_KEYS).not.toContain('onlineMyTeam')
    expect(SYNC_KEYS).not.toContain('onlineReady')
    expect(SYNC_KEYS).not.toContain('gameMode')
  })
})
