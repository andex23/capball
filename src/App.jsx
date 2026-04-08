import { Component } from 'react'
import { useMatchStore, SCREEN } from './state/MatchStore'
import SplashScreen from './screens/SplashScreen'
import MenuScreen from './screens/MenuScreen'
import TeamSelectScreen from './screens/TeamSelectScreen'
import OnlineScreen from './screens/OnlineScreen'
import StadiumSelectScreen from './screens/StadiumSelectScreen'
import FormationScreen from './screens/FormationScreen'
import RulesScreen from './screens/RulesScreen'
import MatchEndScreen from './screens/MatchEndScreen'
import Scene from './scene/Scene'
import HUD from './ui/HUD'
import GameEffects from './ui/GameEffects'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: 'white', padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>Error:</h2>
          <p>{this.state.error.message}</p>
          <pre>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const screen = useMatchStore((s) => s.screen)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ErrorBoundary>
        {screen === SCREEN.SPLASH ? (
          <SplashScreen />
        ) : screen === SCREEN.PLAYING ? (
          <>
            <Scene />
            <HUD />
            <GameEffects />
          </>
        ) : screen === SCREEN.ONLINE ? (
          <OnlineScreen />
        ) : screen === SCREEN.TEAM_SELECT ? (
          <TeamSelectScreen />
        ) : screen === SCREEN.STADIUM_SELECT ? (
          <StadiumSelectScreen />
        ) : screen === SCREEN.FORMATION ? (
          <FormationScreen />
        ) : screen === SCREEN.RULES ? (
          <RulesScreen />
        ) : screen === SCREEN.MATCH_END ? (
          <MatchEndScreen />
        ) : (
          <MenuScreen />
        )}
      </ErrorBoundary>
    </div>
  )
}
