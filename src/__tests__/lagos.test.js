import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { roomCodeFor, isHostFor, opponentOf } from '../lagos/friendMatch'
import { myTeamFor, nextWinTotal, useLagosStore, watchMatches, _resetLagos, _setSdk } from '../lagos/lagosStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { handleLagos, signResult, makeApi, stakedOutcome } from '../../server/lagos.js'

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
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 't_b' }, api)).resolves.toEqual({ ok: true, posted: 't_b' })
    expect(api.postResult).toHaveBeenCalledWith({ id: 'm_1', nonce: 'n1' }, 't_b')
  })
  it('refuses players outside the match and unknown winners', async () => {
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 't_x' }, fakeApi())).rejects.toThrow('bad-winner')
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 'draw' }, fakeApi({ verifySession: async () => ({ status: 200, data: { playerId: 't_z' } }) }))).rejects.toThrow('not-in-match')
    await expect(handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner: 'draw' }, fakeApi({ verifySession: async () => ({ status: 401, data: {} }) }))).rejects.toThrow('bad-session')
  })
  describe('bets (staked matches)', () => {
    const staked = { ...match, stake: 500 }
    const as = (id) => fakeApi({ verifySession: async () => ({ status: 200, data: { playerId: id } }), getMatch: async () => ({ status: 200, data: staked }) })
    const memory = () => { const rows = []; return async (mode, m, player, winner) => { if (!rows.some((r) => r.player === player)) rows.push({ player, winner }); return [...rows] } }
    const send = (api, winner, reports) => handleLagos({ action: 'result', session: 's', matchId: 'm_1', winner }, api, null, null, reports)

    it('believes a player who says they lost, straight away', async () => {
      const api = as('t_a')
      await expect(send(api, 't_b', memory())).resolves.toEqual({ ok: true, posted: 't_b' })
    })
    it('waits for both phones when a player says they won, then pays if they agree', async () => {
      const reports = memory()
      const a = as('t_a'); const b = as('t_b')
      await expect(send(a, 't_a', reports)).resolves.toEqual({ ok: true, waiting: true })
      expect(a.postResult).not.toHaveBeenCalled()
      await expect(send(b, 't_a', reports)).resolves.toEqual({ ok: true, posted: 't_a' })
    })
    it('gives both stakes back when the phones disagree', async () => {
      const reports = memory()
      await send(as('t_a'), 'draw', reports)
      await expect(send(as('t_b'), 't_b', reports)).resolves.toEqual({ ok: true, posted: 'draw' })
    })
    it('a player can’t change their report', async () => {
      const reports = memory()
      await send(as('t_a'), 't_a', reports)
      await expect(send(as('t_a'), 'draw', reports)).resolves.toEqual({ ok: true, waiting: true })
    })
    it('needs the result store', async () => {
      await expect(send(as('t_a'), 't_a', null)).rejects.toThrow('shop-not-configured')
    })
    it('works out the outcome from reports', () => {
      expect(stakedOutcome([], ['a', 'b'])).toBe(null)
      expect(stakedOutcome([{ player: 'a', winner: 'a' }], ['a', 'b'])).toBe(null)
      expect(stakedOutcome([{ player: 'a', winner: 'draw' }], ['a', 'b'])).toBe(null)
      expect(stakedOutcome([{ player: 'a', winner: 'a' }, { player: 'b', winner: 'a' }], ['a', 'b'])).toBe('a')
      expect(stakedOutcome([{ player: 'a', winner: 'a' }, { player: 'b', winner: 'b' }], ['a', 'b'])).toBe('draw')
      expect(stakedOutcome([{ player: 'a', winner: 'a' }, { player: 'b', winner: 'draw' }], ['a', 'b'])).toBe('draw')
    })
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

describe('cap shop server', () => {
  const purchase = { id: 'pu_1', productId: 'cap_danfo', playerId: 't_a', amount: 300, status: 'paid', mode: 'test' }
  const api = (over = {}) => ({
    verifySession: vi.fn(async () => ({ status: 200, data: { playerId: 't_a', mode: 'test' } })),
    getPurchase: vi.fn(async () => ({ status: 200, data: purchase })),
    deliver: vi.fn(async () => ({ status: 200, data: {} })),
    ...over,
  })
  const db = () => vi.fn(async (action, mode, player, product) => (action === 'grant' ? [product] : ['cap_silver']))

  it('records a paid cap, then marks it delivered', async () => {
    const a = api(); const d = db()
    await expect(handleLagos({ action: 'claim', session: 's', purchaseId: 'pu_1' }, a, d)).resolves.toEqual({ ok: true, productId: 'cap_danfo', owned: ['cap_danfo'] })
    expect(d).toHaveBeenCalledWith('grant', 'test', 't_a', 'cap_danfo', 'pu_1')
    expect(a.deliver).toHaveBeenCalledWith('pu_1')
    expect(d.mock.invocationCallOrder[0]).toBeLessThan(a.deliver.mock.invocationCallOrder[0])
  })
  it('refuses someone else’s purchase, unknown products and refunds', async () => {
    await expect(handleLagos({ action: 'claim', session: 's', purchaseId: 'pu_1' }, api({ getPurchase: async () => ({ status: 200, data: { ...purchase, playerId: 't_b' } }) }), db())).rejects.toThrow('bad-purchase')
    await expect(handleLagos({ action: 'claim', session: 's', purchaseId: 'pu_1' }, api({ getPurchase: async () => ({ status: 200, data: { ...purchase, productId: 'free_money' } }) }), db())).rejects.toThrow('bad-purchase')
    await expect(handleLagos({ action: 'claim', session: 's', purchaseId: 'pu_1' }, api({ getPurchase: async () => ({ status: 200, data: { ...purchase, status: 'refunded' } }) }), db())).rejects.toThrow('refunded')
  })
  it('never delivers when it couldn’t record the cap', async () => {
    const a = api()
    await expect(handleLagos({ action: 'claim', session: 's', purchaseId: 'pu_1' }, a, null)).rejects.toThrow('not-configured')
    expect(a.deliver).not.toHaveBeenCalled()
  })
  it('lists what the player owns', async () => {
    await expect(handleLagos({ action: 'owned', session: 's' }, api(), db())).resolves.toEqual({ ok: true, owned: ['cap_silver'] })
  })
})

describe('webhook', () => {
  it('accepts only bodies signed with the webhook secret', async () => {
    const { webhookSigned } = await import('../../server/lagos.js')
    const raw = '{"type":"purchase.paid","data":{"purchaseId":"pu_1"}}'
    const sig = 'sha256=' + createHmac('sha256', 'whsec').update(raw).digest('hex')
    expect(webhookSigned(raw, sig, 'whsec')).toBe(true)
    expect(webhookSigned(raw + ' ', sig, 'whsec')).toBe(false)
    expect(webhookSigned(raw, sig, 'other')).toBe(false)
    expect(webhookSigned(raw, undefined, 'whsec')).toBe(false)
    expect(webhookSigned(raw, sig, '')).toBe(false)
  })
  it('records and delivers a paid purchase it checked itself', async () => {
    const { handleWebhook } = await import('../../server/lagos.js')
    const api = { getPurchase: vi.fn(async () => ({ status: 200, data: { id: 'pu_1', productId: 'band_gold', playerId: 't_a', status: 'paid', mode: 'test' } })), deliver: vi.fn(async () => ({ status: 200 })) }
    const db = vi.fn(async () => ['band_gold'])
    await expect(handleWebhook({ type: 'purchase.paid', data: { purchaseId: 'pu_1' } }, api, db)).resolves.toEqual({ ok: true })
    expect(db).toHaveBeenCalledWith('grant', 'test', 't_a', 'band_gold', 'pu_1')
    expect(api.deliver).toHaveBeenCalledWith('pu_1')
  })
  it('ignores other events and refunded or unknown purchases', async () => {
    const { handleWebhook } = await import('../../server/lagos.js')
    const db = vi.fn()
    await expect(handleWebhook({ type: 'test.ping' }, null, null)).resolves.toMatchObject({ ignored: true })
    const api = { getPurchase: async () => ({ status: 200, data: { id: 'pu_1', productId: 'cap_danfo', playerId: 't_a', status: 'refunded' } }), deliver: vi.fn() }
    await expect(handleWebhook({ type: 'purchase.paid', data: { purchaseId: 'pu_1' } }, api, db)).resolves.toMatchObject({ ignored: true })
    expect(db).not.toHaveBeenCalled()
  })
})

describe('cloud save', () => {
  it('only ever reads and writes the verified player’s own save', async () => {
    const { handleLagos } = await import('../../server/lagos.js')
    const api = { verifySession: vi.fn(async () => ({ status: 200, data: { playerId: 't_ada', mode: 'test' } })) }
    const saves = vi.fn(async (action) => (action === 'get' ? { ok: true, data: { v: 1, items: { 'capball:career:v1': '{}', evil: 'x' } } } : { ok: true }))
    await expect(handleLagos({ action: 'loadSave', session: 's', playerId: 't_bayo' }, api, null, saves)).resolves.toEqual({ ok: true, data: { v: 1, items: { 'capball:career:v1': '{}' } } })
    expect(saves).toHaveBeenLastCalledWith('get', 'test', 't_ada')
    await handleLagos({ action: 'putSave', session: 's', data: { v: 1, items: { 'capball:daily:v1': '{}' } } }, api, null, saves)
    expect(saves).toHaveBeenLastCalledWith('put', 'test', 't_ada', { v: 1, items: { 'capball:daily:v1': '{}' } })
    await expect(handleLagos({ action: 'putSave', session: 's', data: 'junk' }, api, null, saves)).rejects.toThrow('bad-request')
  })
})
