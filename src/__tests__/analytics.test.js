import { describe, it, expect, vi } from 'vitest'
import { createTracker, watchMatchAnalytics } from '../analytics'
import { SCREEN } from '../state/MatchStore'

const browser = () => ({
  location: { hostname: 'counterball.vercel.app' }, navigator: {},
  crypto: { randomUUID: () => crypto.randomUUID() },
  document: { referrer: 'https://jaded.online/play?invite=private' },
  localStorage: new MapStorage(), sessionStorage: new MapStorage(),
})
class MapStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) }
  setItem(key, value) { this.values.set(key, value) }
}

describe('CAPBALL analytics', () => {
  it('uses its own site key, persistent identity and referrer origin without query data', () => {
    const request = vi.fn().mockResolvedValue({ status: 204 }), env = browser()
    const track = createTracker({ browser: env, request })
    track('page_view', '/')
    track('match_start', '/play/computer', { mode: 'computer' })
    const payloads = request.mock.calls.map(([, options]) => JSON.parse(options.body))
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
    expect(track).toHaveBeenCalledWith('match_pause', '/play/computer', { mode: 'computer' })
    expect(track).toHaveBeenCalledWith('match_complete', '/match/result', { mode: 'computer', score: { team1: 2, team2: 1 } })
    stop(); expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
