import { useEffect, useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playCoinInsert } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'
import StadiumBackground from '../ui/StadiumBackground'

const SPLASH_BG = '/assets/menu-bg.jpg'

export default function SplashScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    const handleAny = () => {
      playCoinInsert()
      startMenuMusic()
      goToScreen(SCREEN.MENU)
    }
    window.addEventListener('keydown', handleAny)
    window.addEventListener('pointerdown', handleAny)
    return () => {
      window.removeEventListener('keydown', handleAny)
      window.removeEventListener('pointerdown', handleAny)
    }
  }, [goToScreen])

  return (
    <div style={styles.container}>
      {/* Background — tries real image first, falls back to canvas stadium */}
      {!imgFailed ? (
        <img
          src={SPLASH_BG}
          alt=""
          style={styles.bgImage}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <StadiumBackground />
      )}
      <div style={styles.overlay} />
      <div style={styles.vignette} />

      <div style={styles.content}>
        <h1 style={styles.title}>CAPBALL</h1>
        <div style={styles.underline} />
        <p style={styles.subtitle}>TABLETOP FOOTBALL</p>

        <div style={styles.ball}>&#9917;</div>

        <p style={styles.pressAny}>PRESS ANY BUTTON TO START</p>
      </div>

      <div style={styles.footer}>
        <span style={styles.footerText}>&#169; 2026 CAPBALL</span>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #040610 0%, #0a0e25 30%, #0d1235 60%, #060814 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 40%',
    zIndex: 0,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(2,3,10,0.8) 0%, rgba(2,3,10,0.55) 25%, rgba(2,3,10,0.45) 50%, rgba(2,3,10,0.6) 70%, rgba(2,3,10,0.85) 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.75) 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
    zIndex: 2,
    animation: 'fadeIn 1.2s ease-out',
  },
  title: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: 'clamp(60px, 12vw, 110px)',
    fontWeight: '900',
    color: '#FFD740',
    textShadow: '0 0 50px rgba(255,215,64,0.6), 0 5px 0 #B8860B, 0 10px 35px rgba(0,0,0,0.9)',
    margin: 0,
    letterSpacing: '10px',
    lineHeight: 1,
    animation: 'titleFloat 3s ease-in-out infinite',
  },
  underline: {
    width: '220px',
    height: '3px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
    margin: '10px 0',
  },
  subtitle: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: 'clamp(14px, 2.5vw, 20px)',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '8px',
    textTransform: 'uppercase',
    margin: 0,
    textShadow: '0 2px 10px rgba(0,0,0,0.8)',
  },
  ball: {
    fontSize: '48px',
    margin: '36px 0',
    opacity: 0.7,
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
  },
  pressAny: {
    fontFamily: "var(--font-pixel, 'Press Start 2P', monospace)",
    fontSize: '12px',
    color: 'rgba(255,215,64,0.8)',
    letterSpacing: '3px',
    animation: 'pressStart 2s ease-in-out infinite',
    textShadow: '0 0 15px rgba(255,215,64,0.4), 0 2px 8px rgba(0,0,0,0.8)',
    margin: 0,
  },
  footer: {
    position: 'absolute',
    bottom: '20px',
    textAlign: 'center',
    width: '100%',
    zIndex: 2,
  },
  footerText: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: '2px',
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
  },
}
