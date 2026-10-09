import { useMatchStore, SCREEN } from './state/MatchStore'

const TRACKER_URL = 'https://yerwptchfksahaiiezki.supabase.co/functions/v1/site-track'
// Public installation key for CAPBALL, separate from JADED's collection tracker.
const SITE_KEY = '9fd56acb-b44d-46ca-89df-7db36f4f9393'
const PATHS = {
  [SCREEN.SPLASH]: '/', [SCREEN.MENU]: '/', [SCREEN.ONLINE]: '/online',
  [SCREEN.TEAM_SELECT]: '/setup/teams', [SCREEN.STADIUM_SELECT]: '/setup/venue',
  [SCREEN.FORMATION]: '/setup/formation', [SCREEN.MATCH_END]: '/match/result',
  [SCREEN.TOURNAMENT_HOME]: '/tournaments', [SCREEN.TOURNAMENT_SETUP]: '/tournaments/setup',
  [SCREEN.TOURNAMENT_HUB]: '/tournaments/fixtures', [SCREEN.CAREER]: '/career',
}
const modeName = mode => ({ ai: 'computer', local: 'local', online: 'online' }[mode] ?? 'local')

export function createTracker({ browser = globalThis.window, request = globalThis.fetch } = {}) {
  let identity
  return (event, path, metadata = {}) => {
    try {
      if (!browser || browser.navigator?.doNotTrack === '1' || browser.navigator?.globalPrivacyControl) return
      if (!['capball.vercel.app', 'capball-drus-projects-68c924fa.vercel.app'].includes(browser.location.hostname)) return
      if (!identity) {
        const id = (storage, key) => {
          const fresh = browser.crypto.randomUUID()
          try {
            const value = storage?.getItem(key) || fresh
            storage?.setItem(key, value)
            return value
          } catch { return fresh }
        }
        let local, session
        try { local = browser.localStorage } catch { /* Private browsing can deny storage. */ }
        try { session = browser.sessionStorage } catch { /* Use an in-memory identity instead. */ }
        identity = { visitorId: id(local, 'dru_analytics_visitor'), sessionId: id(session, 'dru_analytics_session') }
      }
      let referrer = ''
      try { referrer = new URL(browser.document.referrer).origin } catch { /* Direct visit. */ }
      Promise.resolve(request(TRACKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ siteKey: SITE_KEY, event, path, ...identity, referrer,
          metadata: { gameId: 'capball', gameTitle: 'CAPBALL', ...metadata } }),
      })).catch(() => {})
    } catch { /* Tracking must never interrupt a match, including offline play. */ }
  }
}

export function watchMatchAnalytics(store, track) {
  let previous = store.getState(), lastPath
  const observe = state => {
    const mode = modeName(state.gameMode)
    const path = state.screen === SCREEN.PLAYING ? `/play/${mode}` : PATHS[state.screen] ?? '/'
    if (path !== lastPath) {
      track('page_view', path, { screen: state.screen, mode })
      lastPath = path
    }
    if (state.screen === SCREEN.PLAYING && (previous.screen !== SCREEN.PLAYING || state.matchKey !== previous.matchKey)) {
      track('match_start', path, { mode, difficulty: state.aiDifficulty, interaction: 'game_launch' })
    }
    if (state.screen === SCREEN.MATCH_END && previous.screen !== SCREEN.MATCH_END) {
      track('match_complete', path, { mode, score: { team1: state.score.team1, team2: state.score.team2 } })
    }
    if (state.screen === SCREEN.PLAYING && state.paused !== previous.paused) {
      track(state.paused ? 'match_pause' : 'match_resume', path, { mode })
    }
    previous = state
  }
  observe(previous)
  return store.subscribe(observe)
}

export const initAnalytics = () => watchMatchAnalytics(useMatchStore, createTracker())
