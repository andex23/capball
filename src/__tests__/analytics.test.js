import { describe, it, expect, vi } from 'vitest'
import { createTracker, watchMatchAnalytics } from '../analytics'
import { SCREEN } from '../state/MatchStore'

const browser = () => ({
  location: { hostname: 'capball.vercel.app' }, navigator: {},
  crypto: { randomUUID: () => crypto.randomUUID() },
  document: { referrer: 'https://jaded.online/play?invite=private' },
  localStorage: new MapStorage(), sessionStorage: new MapStorage(),
})
class MapStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) }
  setItem(key, value) { this.values.set(key, value) }
}

describe('Counterball analytics', () => {
  it.each(['counterball.vercel.app', 'capball.vercel.app'])('preserves the existing game identity on %s', hostname => {
    const env = browser(), request = vi.fn().mockResolvedValue({ status: 204 })
    env.location.hostname = hostname
    createTracker({ browser: env, request })('page_view', '/')
    expect(JSON.parse(request.mock.calls[0][1].body).metadata).toMatchObject({ gameId: 'capball', gameTitle: 'COUNTERBALL' })
  })
  it('uses its own site key, persistent identity and referrer origin without query data', () => {
    const request = vi.fn().mockResolvedValue({ status: 204 }), env = browser()
    const track = createTracker({ browser: env, request })
    track('page_view', '/')
    track('match_start', '/play/computer', { mode: 'computer' })
    const payloads = request.mock.calls.map(([, options]) => JSON.parse(options.body))
    expect(request.mock.calls[0][0]).toContain('/functions/v1/site-track')
    expect(request.mock.calls[1][0]).toBe('https://dru-analytics-omega.vercel.app/api/track')
    expect(payloads[0].siteKey).toBe('9fd56acb-b44d-46ca-89df-7db36f4f9393')
    expect(payloads[0].visitorId).toBe(payloads[1].visitorId)
    expect(payloads[0].sessionId).toBe(payloads[1].sessionId)
    expect(payloads[0].referrer).toBe('https://jaded.online')
    expect(payloads[1].metadata).toMatchObject({ gameId: 'capball', mode: 'computer' })
  })
  it('survives denied storage, network failures and missing browser globals', async () => {
    const env = browser(), request = vi.fn().mockRejectedValue(new Error('offline'))
    Object.defineProperty(env, 'localStorage', { get() { throw new Error('denied') } })
    Object.defineProperty(env, 'sessionStorage', { get() { throw new Error('denied') } })
    const track = createTracker({ browser: env, request })
    expect(() => track('page_view', '/')).not.toThrow()
    expect(() => createTracker({ browser: undefined, request })('page_view', '/')).not.toThrow()
    await Promise.resolve()
  })
  it('does not track development, previews or privacy opt-outs', () => {
    const env = browser(), request = vi.fn(), track = createTracker({ browser: env, request })
    env.navigator.doNotTrack = '1'; track('page_view', '/')
    env.navigator.doNotTrack = '0'; env.navigator.globalPrivacyControl = true; track('page_view', '/')
    env.navigator.globalPrivacyControl = false; env.location.hostname = 'localhost'; track('page_view', '/')
    expect(request).not.toHaveBeenCalled()
  })
  it('measures completed active duration without paused time', () => {
    let now = 1000, state = { screen: SCREEN.MENU, gameMode: 'ai', matchKey: 0, paused: false, score: { team1: 0, team2: 0 } }, listener
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    const track = vi.fn()
    watchMatchAnalytics({ getState: () => state, subscribe: fn => { listener = fn; return () => {} } }, track)
    const set = update => { state = { ...state, ...update }; listener(state) }
    try {
      set({ screen: SCREEN.PLAYING, matchKey: 1 })
      now = 11000; set({ paused: true })
      now = 21000; set({ paused: false })
      now = 31000; set({ screen: SCREEN.MATCH_END })
      expect(track.mock.calls.find(([event]) => event === 'match_complete')[2].duration_seconds).toBe(20)
    } finally { clock.mockRestore() }
  })
  it('tracks virtual screens, each new match, pause and results without duplicate menu views', () => {
    let state = { screen: SCREEN.SPLASH, gameMode: 'ai', aiDifficulty: 'hard', matchKey: 0, paused: false, score: { team1: 0, team2: 0 } }, listener
    const unsubscribe = vi.fn(), track = vi.fn()
    const store = { getState: () => state, subscribe: callback => { listener = callback; return unsubscribe } }
    const stop = watchMatchAnalytics(store, track)
    const set = update => { state = { ...state, ...update }; listener(state) }
    set({ screen: SCREEN.MENU }); set({ screen: SCREEN.CAREER }); set({ screen: SCREEN.TEAM_SELECT })
    set({ screen: SCREEN.PLAYING, matchKey: 1 }); set({ paused: true }); set({ paused: false })
    set({ matchKey: 2 }); set({ screen: SCREEN.MATCH_END, score: { team1: 2, team2: 1 } })
    expect(track.mock.calls.filter(([event, path]) => event === 'page_view' && path === '/')).toHaveLength(1)
    expect(track.mock.calls.filter(([event]) => event === 'match_start')).toHaveLength(2)
    expect(track).toHaveBeenCalledWith('match_pause', '/play/computer', expect.objectContaining({ mode: 'computer', playId: expect.any(String) }))
    expect(track).toHaveBeenCalledWith('match_complete', '/match/result', expect.objectContaining({ mode: 'computer', score: { team1: 2, team2: 1 }, playId: expect.any(String), duration_seconds: expect.any(Number) }))
    const starts = track.mock.calls.filter(([event])=>event==='match_start')
    expect(starts[0][2].playId).not.toBe(starts[1][2].playId)
    expect(track.mock.calls.find(([event])=>event==='match_complete')[2].playId).toBe(starts[1][2].playId)
    stop(); expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
