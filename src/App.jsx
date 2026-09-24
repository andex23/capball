import { Component, Suspense, lazy, useEffect } from 'react'
import { useMatchStore, SCREEN } from './state/MatchStore'
import { disconnect, isConnected } from './multiplayer/MultiplayerManager'
import { fadeOutMenuMusic } from './audio/MusicManager'
import SplashScreen from './screens/SplashScreen'
import MenuScreen from './screens/MenuScreen'
import TeamSelectScreen from './screens/TeamSelectScreen'
import OnlineScreen from './screens/OnlineScreen'
import StadiumSelectScreen from './screens/StadiumSelectScreen'
import FormationScreen from './screens/FormationScreen'
import MatchEndScreen from './screens/MatchEndScreen'
import HUD from './ui/HUD'
import GameEffects from './ui/GameEffects'
import Modal from './ui/Modal'
import Icon from './ui/Icon'
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
    console.error('CAPBALL crashed:', error, info?.componentStack)
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
  if (gameMode !== 'online' || status.status !== 'disconnected' || screen === SCREEN.ONLINE || screen === SCREEN.MENU) return null

  const leave = () => {
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
  switch (screen) {
    case SCREEN.SPLASH: return <SplashScreen />
    case SCREEN.PLAYING:
      return (
        <>
          <Suspense fallback={<div className="screen" style={{ display: 'grid', placeItems: 'center' }}><span className="eyebrow">Loading pitch…</span></div>}>
            <Scene />
          </Suspense>
          <HUD />
          <GameEffects />
        </>
      )
    case SCREEN.ONLINE: return <OnlineScreen />
    case SCREEN.TEAM_SELECT: return <TeamSelectScreen />
    case SCREEN.STADIUM_SELECT: return <StadiumSelectScreen />
    case SCREEN.FORMATION: return <FormationScreen />
    case SCREEN.MATCH_END: return <MatchEndScreen />
    default: return <MenuScreen />
  }
}

export default function App() {
  const screen = useMatchStore((s) => s.screen)

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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ErrorBoundary>
        <Screen screen={screen} />
        <OnlineReconnect />
        <ConnectionLost />
      </ErrorBoundary>
    </div>
  )
}
