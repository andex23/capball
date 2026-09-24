import { describe, it, expect } from 'vitest'
import {
  buildIceServers, parseIceServersJson, turnServerFromEnv, normalizeIceServer, hasRelay,
  isIceFailure, connectErrorMessage, DEFAULT_ICE_SERVERS, ICE_FAILED_MSG,
} from '../multiplayer/iceServers'

const TURN = { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }

describe('ICE server configuration', () => {
  it('uses the public STUN defaults when nothing is configured', () => {
    expect(buildIceServers({})).toEqual(DEFAULT_ICE_SERVERS)
    expect(buildIceServers()).toEqual(DEFAULT_ICE_SERVERS)
    expect(hasRelay(buildIceServers({}))).toBe(false)
  })

  it('parses VITE_ICE_SERVERS and merges it after the defaults', () => {
    const env = { VITE_ICE_SERVERS: JSON.stringify([TURN, { urls: ['stun:stun.example.com:3478'] }]) }
    expect(buildIceServers(env)).toEqual([...DEFAULT_ICE_SERVERS, TURN, { urls: 'stun:stun.example.com:3478' }])
    expect(hasRelay(buildIceServers(env))).toBe(true)
  })

  it('ignores bad JSON instead of crashing', () => {
    expect(parseIceServersJson('[{urls: nope')).toEqual([])
    expect(parseIceServersJson('')).toEqual([])
    expect(parseIceServersJson(undefined)).toEqual([])
    expect(parseIceServersJson('42')).toEqual([])
    expect(parseIceServersJson('null')).toEqual([])
    expect(buildIceServers({ VITE_ICE_SERVERS: '{not json' })).toEqual(DEFAULT_ICE_SERVERS)
  })

  it('accepts a single object and drops malformed entries', () => {
    expect(parseIceServersJson(JSON.stringify(TURN))).toEqual([TURN])
    expect(parseIceServersJson(JSON.stringify([
      null, 'stun:x', { urls: 'http://evil.example.com' }, { urls: 42 }, { urls: [] }, TURN,
    ]))).toEqual([TURN])
  })

  it('drops TURN urls without credentials (RTCPeerConnection would throw)', () => {
    expect(normalizeIceServer({ urls: 'turn:t.example.com' })).toBeNull()
    expect(normalizeIceServer({ urls: 'turn:t.example.com', username: 'u' })).toBeNull()
    expect(normalizeIceServer({ urls: ['stun:s.example.com', 'turns:t.example.com:5349'] })).toEqual({ urls: 'stun:s.example.com' })
    // Credentials only travel with relay urls
    expect(normalizeIceServer({ urls: 'stun:s.example.com', username: 'u', credential: 'p' })).toEqual({ urls: 'stun:s.example.com' })
  })

  it('builds a TURN server from VITE_TURN_URL / _USERNAME / _CREDENTIAL', () => {
    const env = {
      VITE_TURN_URL: 'turn:t.example.com:3478, turns:t.example.com:5349?transport=tcp',
      VITE_TURN_USERNAME: 'user',
      VITE_TURN_CREDENTIAL: 'secret',
    }
    const turn = { urls: ['turn:t.example.com:3478', 'turns:t.example.com:5349?transport=tcp'], username: 'user', credential: 'secret' }
    expect(turnServerFromEnv(env)).toEqual([turn])
    expect(buildIceServers(env)).toEqual([...DEFAULT_ICE_SERVERS, turn])
    expect(turnServerFromEnv({ VITE_TURN_URL: 'turn:t.example.com' })).toEqual([])
    expect(turnServerFromEnv({})).toEqual([])
  })

  it('removes duplicates', () => {
    const env = { VITE_ICE_SERVERS: JSON.stringify([TURN, TURN, DEFAULT_ICE_SERVERS[0]]), VITE_TURN_URL: TURN.urls, VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'p' }
    expect(buildIceServers(env)).toEqual([...DEFAULT_ICE_SERVERS, TURN])
  })

  it('only falls back to the library relay when none is configured', () => {
    const fallback = [{ urls: 'turn:lib.example.com', username: 'lib', credential: 'lib' }]
    expect(buildIceServers({}, { fallback })).toEqual([...DEFAULT_ICE_SERVERS, ...fallback])
    expect(buildIceServers({ VITE_ICE_SERVERS: JSON.stringify([TURN]) }, { fallback })).toEqual([...DEFAULT_ICE_SERVERS, TURN])
  })
})

describe('connection error messages', () => {
  it('recognises ICE failures', () => {
    for (const type of ['negotiation-failed', 'webrtc', 'ice-failed', 'connect-timeout']) expect(isIceFailure({ type })).toBe(true)
    expect(isIceFailure({ type: 'peer-unavailable' })).toBe(false)
    expect(isIceFailure(null)).toBe(false)
  })

  it('explains a strict network, mentioning the relay when there is one', () => {
    expect(connectErrorMessage({ type: 'negotiation-failed' })).toBe(ICE_FAILED_MSG)
    expect(ICE_FAILED_MSG).toMatch(/Couldn’t connect directly — one of you may be on a strict network/)
    expect(connectErrorMessage({ type: 'ice-failed' }, { relay: true })).toMatch(/relay/)
  })

  it('has specific messages for the common cases', () => {
    expect(connectErrorMessage({ type: 'peer-unavailable' })).toMatch(/Room not found/)
    expect(connectErrorMessage({ type: 'room-in-use' })).toMatch(/already has two players/)
    expect(connectErrorMessage({ type: 'network' })).toMatch(/matchmaking server/)
    expect(connectErrorMessage({ type: 'connection-closed' })).toMatch(/Try again/)
    expect(connectErrorMessage({ type: 'mystery' })).toBe('Connection error (mystery).')
    expect(connectErrorMessage(undefined)).toBe('Connection error (unknown).')
  })
})
