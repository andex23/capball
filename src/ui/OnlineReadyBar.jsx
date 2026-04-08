import { useEffect } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { playConfirm, playHoverTick } from '../audio/SoundManager'

/**
 * Online Ready Bar — shown at bottom of setup screens in online mode
 * Both players must press READY before the screen advances
 *
 * Props:
 *   nextScreen — the SCREEN constant to advance to when both ready
 *   onBothReady — optional callback when both players are ready (for custom logic)
 */
export default function OnlineReadyBar({ nextScreen, onBothReady }) {
  const gameMode = useMatchStore((s) => s.gameMode)
  const onlineMyTeam = useMatchStore((s) => s.onlineMyTeam)
  const onlineReady = useMatchStore((s) => s.onlineReady)
  const setOnlineReady = useMatchStore((s) => s.setOnlineReady)
  const resetOnlineReady = useMatchStore((s) => s.resetOnlineReady)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const teamConfig = useMatchStore((s) => s.teamConfig)

  const isOnline = gameMode === 'online'
  const myTeam = onlineMyTeam || 'team1'
  const iAmReady = onlineReady?.[myTeam] || false
  const opponentReady = onlineReady?.[myTeam === 'team1' ? 'team2' : 'team1'] || false
  const bothReady = onlineReady?.team1 && onlineReady?.team2

  // When both ready, advance to next screen
  useEffect(() => {
    if (!isOnline) return
    if (!bothReady) return
    const timer = setTimeout(() => {
      resetOnlineReady()
      if (onBothReady) {
        onBothReady()
      } else if (nextScreen) {
        goToScreen(nextScreen)
        // Host syncs the screen change (guest will receive via full state sync)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [bothReady, nextScreen, isOnline])

  if (!isOnline) return null

  const handleReady = () => {
    playConfirm()
    const newReady = !iAmReady
    setOnlineReady(myTeam, newReady)
    // Send dedicated ready message (not part of full state sync)
    try {
      const { sendReady } = require('../multiplayer/MultiplayerManager')
      sendReady(myTeam, newReady)
    } catch (e) {}
  }

  const myName = teamConfig[myTeam]?.name || myTeam
  const opName = teamConfig[myTeam === 'team1' ? 'team2' : 'team1']?.name || 'Opponent'

  return (
    <div style={styles.bar}>
      {/* Opponent status */}
      <div style={styles.statusChip}>
        <div style={{
          ...styles.dot,
          background: opponentReady ? '#4CAF50' : '#FF5722',
          boxShadow: opponentReady ? '0 0 8px #4CAF50' : '0 0 8px #FF5722',
        }} />
        <span style={styles.statusLabel}>
          {opName}: {opponentReady ? 'READY' : 'NOT READY'}
        </span>
      </div>

      {/* Both ready indicator */}
      {bothReady && (
        <div style={styles.bothReady}>STARTING...</div>
      )}

      {/* My ready button */}
      <button
        className="arcade-btn"
        style={{
          ...styles.readyBtn,
          background: iAmReady
            ? 'linear-gradient(180deg, #4CAF50 0%, #388E3C 40%, #2E7D32 100%)'
            : 'linear-gradient(180deg, #FFA726 0%, #FF9800 40%, #E65100 100%)',
          border: iAmReady ? '2px solid #1B5E20' : '2px solid #E65100',
          boxShadow: iAmReady
            ? '0 3px 0 #1B5E20, 0 0 15px rgba(76,175,80,0.3)'
            : '0 3px 0 #BF360C, 0 4px 10px rgba(0,0,0,0.4)',
        }}
        onClick={handleReady}
        onMouseEnter={playHoverTick}
      >
        {iAmReady ? '✓ READY' : 'READY?'}
      </button>
    </div>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '10px 20px',
    background: 'rgba(8,10,25,0.9)',
    border: '1px solid rgba(255,215,64,0.2)',
    borderRadius: '10px',
    zIndex: 2,
    backdropFilter: 'blur(4px)',
  },
  statusChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '1px',
  },
  bothReady: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    color: '#FFD740',
    letterSpacing: '2px',
    animation: 'pressStart 1s ease-in-out infinite',
  },
  readyBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '10px 28px',
    borderRadius: '8px',
    cursor: 'pointer',
    outline: 'none',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
  },
}
