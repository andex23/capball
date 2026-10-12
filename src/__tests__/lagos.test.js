import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { roomCodeFor, isHostFor, opponentOf } from '../lagos/friendMatch'
import { myTeamFor, nextWinTotal, useLagosStore, watchMatches, _resetLagos, _setSdk } from '../lagos/lagosStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { handleLagos, signResult, makeApi } from '../../server/lagos.js'

describe('friend match room', () => {
  it('gives both phones the same room code for a match, and different codes for different matches', () => {
    expect(roomCodeFor('m_abc')).toBe(roomCodeFor('m_abc'))
    expect(roomCodeFor('m_abc')).not.toBe(roomCodeFor('m_abd'))
    expect(roomCodeFor('m_abc')).toMatch(/^LL[A-Z2-9]{10}$/)
  })
  it('picks exactly one host, whatever order the players arrive in', () => {
    const a = { players: [{ id: 't_b' }, { id: 't_a' }] }
    const b = { players: [{ id: 't_a' }, { id: 't_b' }] }
    expect(isHostFor(a, 't_a')).toBe(true)
    expect(isHostFor(b, 't_a')).toBe(true)
    expect(isHostFor(a, 't_b')).toBe(false)
    expect(isHostFor({ players: [{ id: 't_a' }] }, 't_a')).toBe(false)
    expect(opponentOf(a, 't_a').id).toBe('t_b')
  })
})

describe('win counting', () => {
  it('counts wins only for the player holding this phone', () => {
    expect(myTeamFor({ gameMode: 'ai', aiTeam: 'team2' })).toBe('team1')
    expect(myTeamFor({ gameMode: 'ai', aiTeam: 'team1' })).toBe('team2')
    expect(myTeamFor({ gameMode: 'online', onlineMyTeam: 'team2' })).toBe('team2')
    expect(myTeamFor({ gameMode: 'local' })).toBe(null)
    expect(myTeamFor({ gameMode: 'ai', aiTeam: 'team2', challenge: { id: 1 } })).toBe(null)
  })
  it('keeps counting up from the leaderboard when this phone has lost its count', () => {
    expect(nextWinTotal(0, 12)).toBe(13)
    expect(nextWinTotal(5, 3)).toBe(6)
  })

  let stop
  const sdk = { submitScore: vi.fn(async (n) => ({ best: n, accepted: true })), leaderboard: vi.fn(async () => ({ top: [], me: null })), session: vi.fn(async () => ({ session: 's' })) }
  beforeEach(() => {
    vi.useFakeTimers()
    _resetLagos()
    _setSdk(sdk)
    sdk.submitScore.mockClear()
    useLagosStore.setState({ player: { id: 't_me', name: 'Me' }, wins: 0, best: 0, match: null })
    useMatchStore.setState({ screen: SCREEN.PLAYING, gameMode: 'ai', aiTeam: 'team2', challenge: null, matchKey: 1, matchResult: null })
    stop = watchMatches()
  })
  afterEach(() => { stop(); vi.useRealTimers() })

  const finish = (winner, key = 1) => {
    useMatchStore.setState({ screen: SCREEN.PLAYING, matchKey: key })
    useMatchStore.setState({ screen: SCREEN.MATCH_END, matchResult: { winner, isDraw: !winner } })
  }

  it('adds a win and sends the total to the leaderboard', async () => {
    finish('team1')
    expect(useLagosStore.getState().wins).toBe(1)
    await vi.advanceTimersByTimeAsync(10)
    expect(sdk.submitScore).toHaveBeenCalledWith(1)
  })
  it('ignores losses, draws and two-player matches on one phone', () => {
    finish('team2')
    finish(null, 2)
    useMatchStore.setState({ gameMode: 'local' })
    finish('team1', 3)
    expect(useLagosStore.getState().wins).toBe(0)
  })
  it('waits 20 seconds between scores and sends the latest total', async () => {
    finish('team1', 1)
    await vi.advanceTimersByTimeAsync(10)
    finish('team1', 2)
    finish('team1', 3)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sdk.submitScore).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sdk.submitScore).toHaveBeenLastCalledWith(3)
    expect(sdk.submitScore).toHaveBeenCalledTimes(2)
  })
})

describe('result server', () => {
  const match = { id: 'm_1', status: 'playing', stake: 0, nonce: 'n1', players: [{ playerId: 't_a' }, { playerId: 't_b' }] }
  const fakeApi = (over = {}) => ({
    verifySession: vi.fn(async () => ({ status: 200, data: { playerId: 't_a' } })),
    getMatch: vi.fn(async () => ({ status: 200, data: match })),
    postResult: vi.fn(async () => ({ status: 200, data: {} })),
    ...over,
  })

  it('signs the way Lagos Life documents it', () => {
    const body = JSON.stringify({ winner: 't_a' })
    const expected = 'v1=' + createHmac('sha256', 'sec').update(['POST', '/api/games/v1/matches/m_1/result', '100', 'n1', createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex')
    expect(signResult({ secret: 'sec', path: '/api/games/v1/matches/m_1/result', ts: 100, nonce: 'n1', body })).toBe(expected)
  })
  it('posts a verified player’s result', async () => {
    const api = fakeApi()
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 't_b' }, api)).resolves.toEqual({ ok: true })
    expect(api.postResult).toHaveBeenCalledWith({ id: 'm_1', nonce: 'n1' }, 't_b')
  })
  it('refuses players outside the match, unknown winners and staked matches', async () => {
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 't_x' }, fakeApi())).rejects.toThrow('bad-winner')
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 'draw' }, fakeApi({ verifySession: async () => ({ status: 200, data: { playerId: 't_z' } }) }))).rejects.toThrow('not-in-match')
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 'draw' }, fakeApi({ getMatch: async () => ({ status: 200, data: { ...match, stake: 500 } }) }))).rejects.toThrow('not-playing')
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 'draw' }, fakeApi({ verifySession: async () => ({ status: 401, data: {} }) }))).rejects.toThrow('bad-session')
  })
  it('treats a match the other phone already settled as done', async () => {
    const api = fakeApi({ postResult: async () => ({ status: 409, data: { error: 'already_settled' } }) })
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 'draw' }, api)).resolves.toEqual({ ok: true, settled: true })
  })
  it('does nothing until the keys are set', async () => {
    expect(makeApi({ secret: '', resultsSecret: '' })).toBe(null)
    await expect(handleLagos({ action: 'result' }, null)).rejects.toThrow('not-configured')
  })
  it('sends the secret, timestamp and signature to the right address', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => ({}) }))
    const api = makeApi({ secret: 'vtr_test_x', resultsSecret: 'rs', fetchImpl, now: () => 100_000 })
    await api.postResult({ id: 'm_1', nonce: 'n1' }, 't_a')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://lagoslife.app/api/games/v1/matches/m_1/result')
    expect(init.headers.authorization).toBe('Bearer vtr_test_x')
    expect(init.headers['x-vatar-timestamp']).toBe('100')
    expect(init.headers['x-vatar-signature']).toBe(signResult({ secret: 'rs', path: '/api/games/v1/matches/m_1/result', ts: 100, nonce: 'n1', body: init.body }))
  })
})
