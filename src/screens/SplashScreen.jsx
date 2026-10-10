import { useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playCoinInsert } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'
import { RetroBackdrop, RetroLogo } from '../ui/Retro'
import { markStarted } from './MenuScreen'

/** Title card: "Press start". Audio can only begin after a tap, which is why this screen exists. */
export default function SplashScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)

  useEffect(() => {
    const start = () => {
      playCoinInsert()
      startMenuMusic()
      markStarted()
      // Invite links go straight in: ?room=CODE to the online lobby,
      // ?tournament=CODE to tournaments (which opens that one)
      const params = new URLSearchParams(window.location.search)
      goToScreen(params.has('room') ? SCREEN.ONLINE : params.has('tournament') ? SCREEN.TOURNAMENT_HOME : SCREEN.MENU)
    }
    window.addEventListener('keydown', start)
    window.addEventListener('pointerdown', start)
    return () => {
      window.removeEventListener('keydown', start)
      window.removeEventListener('pointerdown', start)
    }
  }, [goToScreen])

  return (
    <div className="screen iss" style={{ cursor: 'pointer' }}>
      <RetroBackdrop />
      <div className="iss-layout">
        <RetroLogo />
        <p className="iss-press" role="button">Press start</p>
        <footer className="iss-foot"><span>© 2026 Counterball</span></footer>
      </div>
    </div>
  )
}
