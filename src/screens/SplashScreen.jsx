import { useEffect, useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playCoinInsert } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'
import StadiumBackground from '../ui/StadiumBackground'

export default function SplashScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    // Audio can only start after a user gesture, which is why this screen exists
    const start = () => {
      playCoinInsert()
      startMenuMusic()
      // Invite links (?room=CODE) go straight to the online lobby
      const invited = new URLSearchParams(window.location.search).has('room')
      goToScreen(invited ? SCREEN.ONLINE : SCREEN.MENU)
    }
    window.addEventListener('keydown', start)
    window.addEventListener('pointerdown', start)
    return () => {
      window.removeEventListener('keydown', start)
      window.removeEventListener('pointerdown', start)
    }
  }, [goToScreen])

  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
      {imgFailed ? <StadiumBackground /> : <img className="screen-photo" src="/assets/menu-bg.jpg" alt="" onError={() => setImgFailed(true)} />}
      <div className="screen-shade" style={{ background: 'radial-gradient(ellipse at center, rgba(6,9,19,0.35) 0%, rgba(6,9,19,0.88) 75%)' }} />
      <div className="screen-content" style={{ textAlign: 'center', padding: 'var(--gutter)' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>Tabletop football</div>
        <h1 className="display" style={{ fontSize: 'clamp(72px, 16vw, 168px)', textShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>
          Cap<span style={{ color: 'var(--accent)' }}>ball</span>
        </h1>
        <p style={{ marginTop: 28, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 13, animation: 'blink 1.8s ease-in-out infinite' }}>
          Tap anywhere to start
        </p>
      </div>
    </div>
  )
}
