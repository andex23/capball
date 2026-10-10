import LanScreen from './screens/LanScreen'
import AnytimeScreen from './screens/AnytimeScreen'
import AnytimeHUD from './ui/AnytimeHUD'
import { Component, Suspense, lazy, useEffect } from 'react'
import { toggleFullscreen, typing } from './ui/fullscreen'
import { useMatchStore, SCREEN } from './state/MatchStore'
import { useTournamentStore } from './state/tournamentStore'
import TournamentHomeScreen from './screens/TournamentHomeScreen'
import TournamentSetupScreen from './screens/TournamentSetupScreen'
import TournamentHubScreen from './screens/TournamentHubScreen'
import CareerScreen from './screens/CareerScreen'
import AchievementToast from './ui/AchievementToast'
import UnlockToast from './ui/UnlockToast'
import { disconnect, isConnected } from './multiplayer/MultiplayerManager'
import { fadeOutMenuMusic } from './audio/MusicManager'
import SplashScreen from './screens/SplashScreen'
import MenuScreen, { markStarted } from './screens/MenuScreen'
import TeamSelectScreen from './screens/TeamSelectScreen'
import OnlineScreen from './screens/OnlineScreen'
import StadiumSelectScreen from './screens/StadiumSelectScreen'
import FormationScreen from './screens/FormationScreen'
import MatchEndScreen from './screens/MatchEndScreen'
import HUD from './ui/HUD'
import GameEffects from './ui/GameEffects'
import Tutorial from './ui/Tutorial'
import Modal from './ui/Modal'
import Icon from './ui/Icon'
import PwaUpdateToast from './pwa/PwaUpdateToast'
import OnlineReconnect from './ui/OnlineReconnect'

// three.js is most of the download — only fetch it once a match is coming up
const loadScene = () => import('./scene/Scene')
const Scene = lazy(loadScene)

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('COUNTERBALL crashed:', error, info?.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
        <div className="card card-pad" style={{ maxWidth: 440, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="display" style={{ fontSize: 40 }}>Something went wrong</h1>
          <p className="muted">The game hit an unexpected error. Reloading usually fixes it.</p>
          <code style={{ fontSize: 12, color: 'var(--text-3)', wordBreak: 'break-word' }}>{this.state.error.message}</code>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}

/** Shown on every screen when an online opponent drops. */
function ConnectionLost() {
  const status = useMatchStore((s) => s.onlineStatus)
  const gameMode = useMatchStore((s) => s.gameMode)
  const screen = useMatchStore((s) => s.screen)
  if (gameMode !== 'online' || status.status !== 'disconnected' || screen === SCREEN.ONLINE || screen === SCREEN.LAN || screen === SCREEN.MENU || screen === SCREEN.TOURNAMENT_HUB) return null

  const leave = () => {
    if (useTournamentStore.getState().playing) { useTournamentStore.getState().backToHub(); return }
    disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
    useMatchStore.getState().setGameMode('local')
  }
  return (
    <Modal title="Connection lost" footer={<button className="btn btn-primary btn-block" onClick={leave}><Icon name="exit" size={18} /> Back to menu</button>}>
      <p className="muted">{status.msg || 'The other player disconnected.'}</p>
    </Modal>
  )
}

function Screen({ screen }) {
  const anytime = useMatchStore(s => s.gameMode === 'anytime')
  switch (screen) {
    case SCREEN.SPLASH: return <SplashScreen />
    case SCREEN.PLAYING:
      if (anytime) return <AnytimeHUD><Suspense fallback={<p className="muted">Loading pitch…</p>}><Scene /></Suspense></AnytimeHUD>
      return (
        <>
          <Suspense fallback={<div className="screen" style={{ display: 'grid', placeItems: 'center' }}><span className="eyebrow">Loading pitch…</span></div>}>
            <Scene />
          </Suspense>
          <HUD /><Tutorial /><GameEffects />
        </>
      )
    case SCREEN.LAN: return <LanScreen />
    case SCREEN.ANYTIME: return <AnytimeScreen />
    case SCREEN.ONLINE: return <OnlineScreen />
    case SCREEN.TEAM_SELECT: return <TeamSelectScreen />
    case SCREEN.STADIUM_SELECT: return <StadiumSelectScreen />
    case SCREEN.FORMATION: return <FormationScreen />
    case SCREEN.MATCH_END: return <MatchEndScreen />
    case SCREEN.TOURNAMENT_HOME: return <TournamentHomeScreen />
    case SCREEN.TOURNAMENT_SETUP: return <TournamentSetupScreen />
    case SCREEN.TOURNAMENT_HUB: return <TournamentHubScreen />
    case SCREEN.CAREER: return <CareerScreen />
    default: return <MenuScreen />
  }
}

export default function App() {
  const screen = useMatchStore((s) => s.screen)

  useEffect(() => {
    const openLanInvite = () => {
      const state = useMatchStore.getState()
      // A camera link opens joining directly; never replace an active match.
      if (!window.location.hash.startsWith('#lan=') || ![SCREEN.SPLASH, SCREEN.MENU].includes(state.screen)) return
      markStarted()
      state.goToScreen(SCREEN.LAN)
    }
    openLanInvite()
    window.addEventListener('hashchange', openLanInvite)
    return () => window.removeEventListener('hashchange', openLanInvite)
  }, [])

  useEffect(() => {
    // Start fetching the 3D engine while players are still in setup
    if (screen === SCREEN.TEAM_SELECT || screen === SCREEN.MATCH_END) loadScene()
    // Menu music off during play (also covers the online guest, who never presses Kick off)
    if (screen === SCREEN.PLAYING) fadeOutMenuMusic()
    // Back at the main menu means any online session is over
    if (screen === SCREEN.MENU && (isConnected() || useMatchStore.getState().gameMode === 'online')) {
      disconnect()
      useMatchStore.getState().setGameMode('local')
    }
  }, [screen])

  // F toggles full screen anywhere in the game (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e)) toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ErrorBoundary>
        <Screen screen={screen} />
        <OnlineReconnect />
        <ConnectionLost />
        <PwaUpdateToast />
        <UnlockToast />
        <AchievementToast />
      </ErrorBoundary>
    </div>
  )
}
