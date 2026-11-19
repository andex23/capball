import { describe, it, expect } from 'vitest'
import {
  validateGuestMessage, sanitizeTeamConfig, sanitizeName, filterSynced, pickSynced, SYNC_KEYS,
  validateJoin, makeSessionToken, SESSION_TOKEN, readyValue, endChoiceOutcome, canChoosePenalties,
} from '../multiplayer/protocol'

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

describe('session token / joining a room', () => {
  const token = 'a'.repeat(32)
  const other = 'b'.repeat(32)

  it('makes 128-bit hex tokens', () => {
    const t = makeSessionToken()
    expect(t).toMatch(SESSION_TOKEN)
    expect(makeSessionToken()).not.toBe(t)
    expect(makeSessionToken((n) => new Uint8Array(n).fill(255))).toBe('f'.repeat(32))
  })

  it('lets the first guest into a fresh lobby without a token', () => {
    const lobby = { token, bound: false, busy: false }
    expect(validateJoin(undefined, lobby)).toEqual({ ok: true, rejoin: false })
    expect(validateJoin({}, lobby)).toEqual({ ok: true, rejoin: false })
    // A leftover token from some other room doesn't matter in a fresh lobby
    expect(validateJoin({ token: other }, lobby)).toEqual({ ok: true, rejoin: false })
  })

  it('turns away a second first-timer while someone is already joining', () => {
    expect(validateJoin({}, { token, bound: false, busy: true })).toEqual({ ok: false, reason: 'room-in-use' })
  })

  it('only lets the original guest back into an in-progress room', () => {
    const inUse = { token, bound: true, busy: false }
    expect(validateJoin({ token }, inUse)).toEqual({ ok: true, rejoin: true })
    // …even if the host still has the stale link open
    expect(validateJoin({ token }, { ...inUse, busy: true })).toEqual({ ok: true, rejoin: true })
    expect(validateJoin({ token: other }, inUse)).toEqual({ ok: false, reason: 'room-in-use' })
    expect(validateJoin({}, inUse)).toEqual({ ok: false, reason: 'room-in-use' })
    expect(validateJoin(null, inUse)).toEqual({ ok: false, reason: 'room-in-use' })
    expect(validateJoin({ token: token.toUpperCase() }, inUse).ok).toBe(false)
    expect(validateJoin({ token: { toString: () => token } }, inUse).ok).toBe(false)
    expect(validateJoin({ token: token + 'x' }, inUse).ok).toBe(false)
  })

  it('rejects everyone if the host has no token (session over)', () => {
    expect(validateJoin({ token }, { token: null, bound: true, busy: false }).ok).toBe(false)
  })
})

describe('bye and rematch choices', () => {
  const draw = { isDraw: true, penaltyScore: null }
  const win = { isDraw: false, winner: 'team1' }
  const end = (matchResult) => ({ screen: 'MATCH_END', matchResult })

  it('accepts a goodbye', () => {
    expect(validateGuestMessage(msg('bye', {}), playing)).toEqual({ type: 'bye' })
    expect(validateGuestMessage({ type: 'bye' }, playing)).toEqual({ type: 'bye' })
  })

  it('does not accept host-only message types from the guest', () => {
    expect(validateGuestMessage(msg('welcome', { token: 'a'.repeat(32) }), playing)).toBeNull()
    expect(validateGuestMessage(msg('rejected', { reason: 'x' }), playing)).toBeNull()
    expect(validateGuestMessage(msg('sync', { state: { score: { team2: 9 } } }), playing)).toBeNull()
  })

  it('validates the guest’s full-time choice', () => {
    expect(validateGuestMessage(msg('ready', { ready: true, choice: 'rematch' }), end(win))).toEqual({ type: 'ready', ready: true, choice: 'rematch' })
    expect(validateGuestMessage(msg('ready', { ready: true, choice: 'penalties' }), end(draw))).toEqual({ type: 'ready', ready: true, choice: 'penalties' })
    // No penalties after a decided match or a finished shootout
    expect(validateGuestMessage(msg('ready', { ready: true, choice: 'penalties' }), end(win))).toBeNull()
    expect(validateGuestMessage(msg('ready', { ready: true, choice: 'penalties' }), end({ isDraw: true, penaltyScore: { team1: 3, team2: 2 } }))).toBeNull()
    expect(validateGuestMessage(msg('ready', { ready: true, choice: 'forfeit' }), end(win))).toBeNull()
    expect(validateGuestMessage(msg('ready', { ready: true }), end(win))).toBeNull()
    // Taking a choice back
    expect(validateGuestMessage(msg('ready', { ready: false, choice: 'rematch' }), end(win))).toEqual({ type: 'ready', ready: false })
    // Choices mean nothing elsewhere
    expect(validateGuestMessage(msg('ready', { ready: true, choice: 'penalties' }), { screen: 'FORMATION' })).toEqual({ type: 'ready', ready: true })
  })

  it('reads the host’s ready value', () => {
    expect(readyValue({ ready: true })).toBe(true)
    expect(readyValue({ ready: true, choice: 'penalties' })).toBe('penalties')
    expect(readyValue({ ready: true, choice: 'nope' })).toBe(true)
    expect(readyValue({ ready: false, choice: 'rematch' })).toBe(false)
    expect(readyValue(null)).toBe(false)
  })

  it('starts only when both players pick the same thing', () => {
    expect(endChoiceOutcome({ team1: 'rematch', team2: 'rematch' }, win)).toBe('rematch')
    expect(endChoiceOutcome({ team1: 'penalties', team2: 'penalties' }, draw)).toBe('penalties')
    expect(endChoiceOutcome({ team1: 'penalties', team2: 'rematch' }, draw)).toBeNull()
    expect(endChoiceOutcome({ team1: 'rematch', team2: false }, win)).toBeNull()
    expect(endChoiceOutcome({ team1: true, team2: true }, win)).toBeNull()
    expect(endChoiceOutcome({ team1: 'penalties', team2: 'penalties' }, win)).toBeNull()
    expect(endChoiceOutcome(undefined, win)).toBeNull()
    expect(canChoosePenalties(draw)).toBe(true)
    expect(canChoosePenalties(null)).toBe(false)
  })
})
