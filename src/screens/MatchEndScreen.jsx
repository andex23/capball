import { useMatchStore, SCREEN } from '../state/MatchStore'
import { stopAllBodies, resetToFormation, setupPenalty } from '../physics/PhysicsWorld'

export default function MatchEndScreen() {
  const matchResult = useMatchStore((s) => s.matchResult)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const reset = useMatchStore((s) => s.reset)
  const startPenaltyShootout = useMatchStore((s) => s.startPenaltyShootout)
  const stats = useMatchStore((s) => s.stats)

  if (!matchResult) return null
  const { winner, score, team1Name, team2Name, penaltyScore, isDraw } = matchResult

  const handleRematch = () => {
    stopAllBodies()
    resetToFormation()
    reset()
    goToScreen(SCREEN.PLAYING)
  }

  const handleMenu = () => {
    stopAllBodies()
    goToScreen(SCREEN.MENU)
  }

  const handlePenalties = () => {
    stopAllBodies()
    startPenaltyShootout()
    // Setup first penalty
    setTimeout(() => setupPenalty('team1'), 500)
  }

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />

      <div style={styles.card}>
        <h1 style={styles.title}>FULL TIME</h1>
        <div style={styles.titleLine} />

        <div style={styles.resultArea}>
          <div style={styles.teamScore}>
            <span style={styles.teamLabel}>{team1Name}</span>
            <span style={styles.scoreNum}>{score.team1}</span>
          </div>
          <span style={styles.dash}>&mdash;</span>
          <div style={styles.teamScore}>
            <span style={styles.scoreNum}>{score.team2}</span>
            <span style={styles.teamLabel}>{team2Name}</span>
          </div>
        </div>

        {/* Penalty scores if applicable */}
        {penaltyScore && (
          <div style={{ textAlign: 'center', margin: '4px 0' }}>
            <span style={{ fontFamily: "var(--font-hud, 'Russo One', sans-serif)", fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>
              PENALTIES: {penaltyScore.team1} — {penaltyScore.team2}
            </span>
          </div>
        )}

        <div style={styles.verdict}>
          {isDraw ? (
            <span style={styles.drawText}>DRAW</span>
          ) : (
            <span style={styles.winnerText}>
              {winner === 'team1' ? team1Name : team2Name} WINS!
            </span>
          )}
        </div>

        {/* Match statistics */}
        {stats && (
          <div style={{ display: 'flex', gap: '30px', margin: '8px 0', fontFamily: "var(--font-hud, 'Russo One', sans-serif)" }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', marginBottom: '4px' }}>STATS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '2px 16px', fontSize: '11px' }}>
                <span style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'right' }}>{stats.team1.turns}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>TURNS</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{stats.team2.turns}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'right' }}>{stats.team1.fouls}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>FOULS</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{stats.team2.fouls}</span>
              </div>
            </div>
          </div>
        )}

        <div style={styles.buttons}>
          {isDraw && !penaltyScore && (
            <button style={styles.penaltyBtn} onClick={handlePenalties}>
              PENALTY SHOOTOUT
            </button>
          )}
          <button style={styles.rematchBtn} onClick={handleRematch}>
            REMATCH
          </button>
          <button style={styles.menuBtn} onClick={handleMenu}>
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #060814 0%, #0c1028 30%, #111840 60%, #0a0e22 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'linear-gradient(180deg, rgba(16,20,45,0.95) 0%, rgba(10,13,30,0.98) 100%)',
    border: '2px solid rgba(255,215,64,0.4)',
    borderRadius: '18px',
    padding: '32px 48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,64,0.06)',
    position: 'relative',
    zIndex: 1,
    animation: 'fadeIn 0.6s ease-out',
    minWidth: '440px',
  },
  title: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '36px',
    fontWeight: '900',
    color: '#FFD740',
    margin: 0,
    letterSpacing: '6px',
    textShadow: '0 0 20px rgba(255,215,64,0.4), 0 3px 0 #B8860B',
  },
  titleLine: {
    width: '180px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
  },
  resultArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    margin: '8px 0',
  },
  teamScore: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  teamLabel: {
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  scoreNum: {
    fontFamily: "var(--font-score, 'Orbitron', monospace)",
    fontSize: '52px',
    fontWeight: '900',
    color: '#FFD740',
    textShadow: '0 0 15px rgba(255,215,64,0.4)',
  },
  dash: {
    fontSize: '24px',
    color: 'rgba(255,255,255,0.3)',
  },
  verdict: {
    margin: '4px 0 8px',
  },
  drawText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '22px',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '4px',
  },
  winnerText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '22px',
    color: '#FFD740',
    letterSpacing: '3px',
    textShadow: '0 0 10px rgba(255,215,64,0.3)',
  },
  buttons: {
    display: 'flex',
    gap: '14px',
    marginTop: '8px',
  },
  penaltyBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '14px 36px',
    background: 'linear-gradient(180deg, #FF8F00 0%, #F57C00 40%, #E65100 100%)',
    border: '2px solid #BF360C',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #5a1a00, 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
    outline: 'none',
  },
  rematchBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '14px 40px',
    background: 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)',
    border: '2px solid #1B5E20',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #1B5E20, 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
    outline: 'none',
  },
  menuBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.7)',
    padding: '14px 32px',
    background: 'linear-gradient(180deg, rgba(55,60,85,0.9) 0%, rgba(30,33,50,0.95) 100%)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
    outline: 'none',
  },
}
