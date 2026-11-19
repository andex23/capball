import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playCoinInsert } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'
import { RetroBackdrop, RetroLogo } from '../ui/Retro'
import { markStarted } from './MenuScreen'

export default function SplashScreen() {
  const params = new URLSearchParams(window.location.search)
  const invite = window.location.hash.startsWith('#lan=') ? SCREEN.LAN
    : params.has('room') ? SCREEN.ONLINE : params.has('tournament') ? SCREEN.TOURNAMENT_HOME : null

  function open(screen) {
    playCoinInsert()
    startMenuMusic()
    markStarted()
    const match = useMatchStore.getState()
    if (screen === SCREEN.TEAM_SELECT) match.setGameMode('ai')
    match.goToScreen(screen)
  }

  return (
    <div className="screen iss">
      <RetroBackdrop />
      <div className="iss-layout">
        <RetroLogo />
        <div className="quick-start-actions">
          <button className="btn btn-gold btn-lg" autoFocus onClick={() => open(invite || SCREEN.TEAM_SELECT)}>
            {invite === SCREEN.LAN ? 'Join LAN match' : invite === SCREEN.ONLINE ? 'Join room' : invite ? 'Open tournament' : 'Play now'}
          </button>
          {!invite && <button className="btn btn-secondary" onClick={() => open(SCREEN.MENU)}>Main menu</button>}
        </div>
        <footer className="iss-foot"><span>© 2026 Counterball</span></footer>
      </div>
    </div>
  )
}
