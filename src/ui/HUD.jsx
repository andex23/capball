import { useMatchStore, PHASE, SCREEN } from '../state/MatchStore'
import { resetToFormation, resetToKickoff, stopAllBodies, setupFreeKick, setupPenalty } from '../physics/PhysicsWorld'
import { setCameraPreset } from '../scene/Scene'
import { playButtonSelect, playConfirm, playWhistle, playFreeKick, playPenalty, playHoverTick } from '../audio/SoundManager'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function HUD() {
  const score = useMatchStore((s) => s.score)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const phase = useMatchStore((s) => s.phase)
  const dragPower = useMatchStore((s) => s.dragPower)
  const reset = useMatchStore((s) => s.reset)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const timeRemaining = useMatchStore((s) => s.timeRemaining)
  const half = useMatchStore((s) => s.half)
  const paused = useMatchStore((s) => s.paused)
  const penaltyShootout = useMatchStore((s) => s.penaltyShootout)
  const penaltyScores = useMatchStore((s) => s.penaltyScores)
  const penaltyRound = useMatchStore((s) => s.penaltyRound)
  const togglePause = useMatchStore((s) => s.togglePause)
  const foulData = useMatchStore((s) => s.foulData)
  const startFreeKickAim = useMatchStore((s) => s.startFreeKickAim)
  const startPenaltyAim = useMatchStore((s) => s.startPenaltyAim)

  const team1 = teamConfig.team1
  const team2 = teamConfig.team2

  const handleRestart = () => {
    playButtonSelect()
    playWhistle()
    stopAllBodies()
    resetToFormation()
    reset()
  }

  // Handle set piece positioning — places all caps correctly
  const handleTakeSetPiece = () => {
    if (phase === PHASE.FREE_KICK_SETUP && foulData) {
      playFreeKick()
      setupFreeKick(foulData.foulSpot, foulData.fouledTeam)
      startFreeKickAim()
    } else if (phase === PHASE.PENALTY_SETUP && foulData) {
      playPenalty()
      setupPenalty(foulData.fouledTeam)
      startPenaltyAim()
    }
  }

  const phaseMessage = getPhaseText(phase, activeTeam)
  const isGoal = phase === PHASE.GOAL
  const isFoul = phase === PHASE.FOUL
  const isSetPieceSetup = phase === PHASE.FREE_KICK_SETUP || phase === PHASE.PENALTY_SETUP

  return (
    <div style={styles.container}>

      {/* ═══════════════════════════════════════════
          SCOREBOARD — top-center broadcast bar
          ═══════════════════════════════════════════ */}
      <div style={styles.scoreboardArea}>
        <div style={styles.scoreboard}>
          {/* Left team */}
          <div style={{
            ...styles.teamSide,
            ...styles.teamSideLeft,
            background: `linear-gradient(135deg, ${team1.primary} 0%, ${darken(team1.primary, 0.35)} 100%)`,
            ...(activeTeam === 'team1' ? styles.activeSide : styles.inactiveSide),
          }}>
            <div style={styles.teamInfo}>
              <span style={styles.teamName}>{team1.name}</span>
            </div>
            <div style={styles.scoreBox}>
              <span style={{
                ...styles.scoreNum,
                animation: isGoal ? 'scorePop 0.5s ease-out' : 'none',
              }}>{score.team1}</span>
            </div>
          </div>

          {/* Center — Timer/Penalty info */}
          <div style={styles.centerBadge}>
            {penaltyShootout ? (
              <>
                <div style={{ fontSize: '8px', color: '#FFD740', letterSpacing: '2px', fontFamily: "var(--font-hud, 'Russo One', sans-serif)" }}>
                  PENALTIES
                </div>
                <div style={styles.timerDisplay}>{penaltyScores.team1} — {penaltyScores.team2}</div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', fontFamily: "var(--font-hud, 'Russo One', sans-serif)" }}>
                  ROUND {penaltyRound + 1}/3
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontFamily: "var(--font-hud, 'Russo One', sans-serif)" }}>
                  {half === 1 ? '1ST HALF' : '2ND HALF'}
                </div>
                <div style={styles.timerDisplay}>{formatTime(timeRemaining)}</div>
              </>
            )}
          </div>

          {/* Right team */}
          <div style={{
            ...styles.teamSide,
            ...styles.teamSideRight,
            background: `linear-gradient(135deg, ${darken(team2.primary, 0.35)} 0%, ${team2.primary} 100%)`,
            ...(activeTeam === 'team2' ? styles.activeSide : styles.inactiveSide),
          }}>
            <div style={styles.scoreBox}>
              <span style={{
                ...styles.scoreNum,
                animation: isGoal ? 'scorePop 0.5s ease-out' : 'none',
              }}>{score.team2}</span>
            </div>
            <div style={styles.teamInfo}>
              <span style={styles.teamName}>{team2.name}</span>
            </div>
          </div>
        </div>

        {/* Status ticker */}
        <div style={styles.statusBar}>
          <div style={{
            ...styles.statusAccent,
            background: activeTeam === 'team1' ? team1.primary : team2.primary,
            boxShadow: `0 0 10px ${activeTeam === 'team1' ? team1.primary : team2.primary}66`,
          }} />
          <span style={styles.statusMsg}>{phaseMessage}</span>
          <div style={{
            ...styles.statusAccent,
            background: activeTeam === 'team1' ? team1.primary : team2.primary,
            boxShadow: `0 0 10px ${activeTeam === 'team1' ? team1.primary : team2.primary}66`,
          }} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BOTTOM BAR — game controls
          ═══════════════════════════════════════════ */}
      <div style={styles.bottomBar}>
        <div style={styles.leftControls}>
          <GameButton
            label={paused ? '▶ PLAY' : '❚❚ PAUSE'}
            bg={paused
              ? 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)'
              : 'linear-gradient(180deg, #78909C 0%, #546E7A 40%, #37474F 100%)'}
            shadow={paused ? '#1B5E20' : '#263238'}
            border={paused ? '#2E7D32' : '#37474F'}
            onClick={togglePause}
          />
          <GameButton
            label="NEW MATCH"
            bg="linear-gradient(180deg, #EF5350 0%, #E53935 40%, #B71C1C 100%)"
            shadow="#7f0000"
            border="#B71C1C"
            onClick={() => { stopAllBodies(); goToScreen(SCREEN.MENU) }}
          />
          <GameButton
            label="RESTART"
            bg="linear-gradient(180deg, #FFA726 0%, #FF9800 40%, #E65100 100%)"
            shadow="#8a3400"
            border="#E65100"
            onClick={handleRestart}
          />
        </div>

        <div style={styles.cameraControls}>
          <CamBtn label="TOP" icon="&#8681;" onClick={() => setCameraPreset('topDown')} />
          <CamBtn label="GOAL" icon="&#9878;" onClick={() => setCameraPreset('behindGoal')} />
          <CamBtn label="SIDE" icon="&#9776;" onClick={() => setCameraPreset('sideline')} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          PAUSE OVERLAY
          ═══════════════════════════════════════════ */}
      {paused && (
        <div style={styles.pauseOverlay}>
          <div style={styles.pauseText}>PAUSED</div>
          <div style={styles.pauseSub}>Press PLAY to continue</div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          POWER GAUGE — right edge
          ═══════════════════════════════════════════ */}
      {phase === PHASE.AIM && dragPower > 0 && (
        <div style={styles.powerWrap}>
          <div style={styles.powerLabel}>POWER</div>
          <div style={styles.powerTrack}>
            <div style={{
              ...styles.powerFill,
              height: `${dragPower * 100}%`,
              background: dragPower < 0.4
                ? 'linear-gradient(to top, #4CAF50, #8BC34A)'
                : dragPower < 0.7
                ? 'linear-gradient(to top, #FFC107, #FF9800)'
                : 'linear-gradient(to top, #FF5722, #F44336)',
            }} />
            {[25, 50, 75].map(p => (
              <div key={p} style={{ position: 'absolute', bottom: `${p}%`, left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
          <span style={styles.powerPct}>{Math.round(dragPower * 100)}%</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          KICK OFF OVERLAY
          ═══════════════════════════════════════════ */}
      {phase === PHASE.KICKOFF && (
        <div style={styles.kickoffOverlay}>
          <div style={styles.kickoffText}>{penaltyShootout ? 'PENALTIES' : 'KICK OFF'}</div>
          <div style={styles.kickoffSub}>
            {penaltyShootout
              ? `${teamConfig[activeTeam]?.name} TO SHOOT`
              : `\u26BD ${teamConfig[activeTeam]?.name}`}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          GOAL OVERLAY
          ═══════════════════════════════════════════ */}
      {isGoal && (
        <div style={styles.goalOverlay}>
          <div style={styles.goalFlash} />
          <div style={styles.goalText}>GOAL!</div>
          <div style={styles.goalSub}>
            {score.team1 > score.team2 ? team1.name : team2.name} SCORES
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          FOUL OVERLAY
          ═══════════════════════════════════════════ */}
      {isFoul && (
        <div style={styles.foulOverlay}>
          <div style={styles.foulText}>FOUL!</div>
          <div style={styles.foulSub}>
            {foulData?.inPenaltyBox ? 'PENALTY KICK' : 'FREE KICK'}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SET PIECE SETUP
          ═══════════════════════════════════════════ */}
      {isSetPieceSetup && (
        <div style={styles.setPieceOverlay}>
          <div style={styles.setPieceText}>
            {phase === PHASE.PENALTY_SETUP ? 'PENALTY KICK' : 'FREE KICK'}
          </div>
          <div style={styles.setPieceSub}>
            {teamConfig[activeTeam]?.name} — Select the kicker to take your shot
          </div>
          <button className="arcade-btn" style={styles.setPieceBtn} onClick={handleTakeSetPiece} onMouseEnter={() => playHoverTick()}>
            PLACE BALL
          </button>
        </div>
      )}

      {/* Control hint */}
      <div style={styles.hint}>
        Right-drag: rotate &bull; Scroll: zoom
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   GAME BUTTON — chunky arcade press-depth
   ═══════════════════════════════════════════ */
function GameButton({ label, bg, shadow, border, onClick }) {
  return (
    <button
      className="arcade-btn"
      onClick={() => { playButtonSelect(); onClick() }}
      onMouseEnter={() => playHoverTick()}
      style={{
        ...styles.gameBtn,
        background: bg,
        borderColor: border,
        boxShadow: `0 4px 0 ${shadow}, 0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}
    >
      {label}
    </button>
  )
}

/* Camera button */
function CamBtn({ label, icon, onClick }) {
  return (
    <button
      className="cam-btn"
      onClick={() => { playButtonSelect(); onClick() }}
      onMouseEnter={() => playHoverTick()}
      style={styles.camBtn}
    >
      <span style={styles.camIcon}>{icon}</span>
      <span style={styles.camLabel}>{label}</span>
    </button>
  )
}

function getPhaseText(phase, activeTeam) {
  const teamConfig = useMatchStore.getState().teamConfig
  const teamName = (teamConfig[activeTeam]?.name || activeTeam).toUpperCase()
  switch (phase) {
    case PHASE.SELECT: return `${teamName} TURN  \u2014  SELECT A CAP`
    case PHASE.AIM: return `${teamName}  \u2014  AIM YOUR SHOT`
    case PHASE.FLICK: return 'FLICKING...'
    case PHASE.RESOLVE: return 'RESOLVING...'
    case PHASE.GOAL: return '\u26BD GOAL!'
    case PHASE.KICKOFF: return 'KICK-OFF'
    case PHASE.FOUL: return '\u26A0 FOUL!'
    case PHASE.FREE_KICK_SETUP: return `${teamName}  \u2014  FREE KICK`
    case PHASE.FREE_KICK_AIM: return `${teamName}  \u2014  TAKE FREE KICK`
    case PHASE.PENALTY_SETUP: return `${teamName}  \u2014  PENALTY KICK`
    case PHASE.PENALTY_AIM: return `${teamName}  \u2014  TAKE PENALTY`
    case PHASE.MATCH_OVER: return 'FULL TIME'
    default: return ''
  }
}

function darken(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount))
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount))
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const styles = {
  container: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none',
    fontFamily: "var(--font-hud, 'Russo One', 'Arial Black', sans-serif)",
    userSelect: 'none',
  },

  /* ── SCOREBOARD ── */
  scoreboardArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '8px',
    animation: 'slideDown 0.4s ease-out',
  },
  scoreboard: {
    display: 'flex',
    alignItems: 'stretch',
    background: 'linear-gradient(180deg, rgba(12,15,35,0.96) 0%, rgba(6,8,20,0.98) 100%)',
    border: '2px solid rgba(255,215,64,0.45)',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 6px 30px rgba(0,0,0,0.7), 0 0 40px rgba(255,215,64,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
    minWidth: '480px',
  },
  teamSide: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px',
    minWidth: '160px',
    transition: 'all 0.3s ease',
    gap: '14px',
  },
  teamSideLeft: {
    borderRadius: '12px 0 0 12px',
    justifyContent: 'flex-start',
  },
  teamSideRight: {
    borderRadius: '0 12px 12px 0',
    justifyContent: 'flex-end',
  },
  activeSide: {
    animation: 'activeTeamPulse 2s ease-in-out infinite',
    filter: 'brightness(1.15)',
  },
  inactiveSide: {
    filter: 'brightness(0.55)',
    opacity: 0.7,
  },
  teamInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  teamName: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '2.5px',
    color: 'rgba(255,255,255,0.95)',
    textShadow: '0 2px 4px rgba(0,0,0,0.6)',
    whiteSpace: 'nowrap',
  },
  scoreBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '52px',
  },
  scoreNum: {
    fontFamily: "var(--font-score, 'Orbitron', monospace)",
    fontSize: '44px',
    fontWeight: '900',
    color: '#FFD740',
    lineHeight: 1,
    textShadow: '0 0 15px rgba(255,215,64,0.5), 0 3px 6px rgba(0,0,0,0.6)',
  },
  centerBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 16px',
    background: 'rgba(0,0,0,0.5)',
    minWidth: '56px',
    borderLeft: '1px solid rgba(255,215,64,0.15)',
    borderRight: '1px solid rgba(255,215,64,0.15)',
  },
  timerDisplay: {
    fontFamily: "var(--font-score, 'Orbitron', monospace)",
    fontSize: '20px',
    fontWeight: '700',
    color: '#FFD740',
    letterSpacing: '2px',
    textShadow: '0 0 10px rgba(255,215,64,0.4)',
  },
  centerIcon: {
    fontSize: '18px',
    marginTop: '2px',
    opacity: 0.5,
  },

  /* ── STATUS BAR ── */
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    background: 'linear-gradient(180deg, rgba(12,15,35,0.96) 0%, rgba(18,22,48,0.94) 100%)',
    border: '1.5px solid rgba(255,215,64,0.25)',
    borderTop: 'none',
    borderRadius: '0 0 10px 10px',
    padding: '7px 28px',
    minWidth: '440px',
  },
  statusAccent: {
    width: '24px',
    height: '3px',
    borderRadius: '2px',
    animation: 'statusBlink 1.5s ease-in-out infinite',
  },
  statusMsg: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '12px',
    fontWeight: '700',
    color: '#FFD740',
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    textShadow: '0 0 10px rgba(255,215,64,0.3)',
  },

  /* ── BOTTOM BAR ── */
  bottomBar: {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '14px',
    animation: 'fadeIn 0.5s ease-out',
  },
  leftControls: {
    display: 'flex',
    gap: '8px',
    pointerEvents: 'auto',
  },
  gameBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '12px 26px',
    border: '2px solid',
    borderRadius: '10px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    textShadow: '0 2px 3px rgba(0,0,0,0.5)',
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    pointerEvents: 'auto',
    outline: 'none',
  },

  /* ── CAMERA CONTROLS ── */
  cameraControls: {
    display: 'flex',
    gap: '3px',
    background: 'rgba(8,10,25,0.9)',
    borderRadius: '10px',
    padding: '4px',
    border: '1.5px solid rgba(255,255,255,0.1)',
    pointerEvents: 'auto',
    boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
  },
  camBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 12px',
    background: 'linear-gradient(180deg, rgba(55,60,85,0.9) 0%, rgba(30,33,50,0.95) 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    transition: 'transform 0.08s ease',
    boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    outline: 'none',
    pointerEvents: 'auto',
  },
  camIcon: {
    fontSize: '16px',
    lineHeight: 1,
  },
  camLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '8px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  /* ── POWER GAUGE ── */
  powerWrap: {
    position: 'absolute',
    right: '18px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(8,10,25,0.92)',
    borderRadius: '12px',
    padding: '12px 10px',
    border: '1.5px solid rgba(255,215,64,0.3)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.6), 0 0 15px rgba(255,215,64,0.05)',
  },
  powerLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '8px',
    letterSpacing: '2.5px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  powerTrack: {
    width: '22px',
    height: '160px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: '11px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    border: '2px solid rgba(255,255,255,0.18)',
    position: 'relative',
  },
  powerFill: {
    width: '100%',
    borderRadius: '9px',
    transition: 'height 0.05s linear',
  },
  powerPct: {
    fontFamily: "var(--font-score, 'Orbitron', monospace)",
    fontSize: '12px',
    fontWeight: '700',
    color: '#FFD740',
    textShadow: '0 0 8px rgba(255,215,64,0.3)',
  },

  /* ── KICK OFF OVERLAY ── */
  kickoffOverlay: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    zIndex: 10,
    animation: 'goalPulse 0.5s ease-out',
    pointerEvents: 'none',
  },
  kickoffText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '64px',
    fontWeight: '900',
    color: '#FFD740',
    letterSpacing: '8px',
    textShadow: '0 0 40px rgba(255,215,64,0.5), 0 4px 0 #B8860B, 0 8px 30px rgba(0,0,0,0.7)',
  },
  kickoffSub: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '18px',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '4px',
    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
  },

  /* ── GOAL OVERLAY ── */
  goalOverlay: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'goalPulse 0.5s ease-out',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    zIndex: 10,
  },
  goalFlash: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,215,64,0.15) 0%, transparent 70%)',
    animation: 'goalGlow 1s ease-in-out infinite',
    pointerEvents: 'none',
  },
  goalText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '80px',
    fontWeight: '900',
    color: '#FFD740',
    animation: 'goalGlow 1s ease-in-out infinite',
    letterSpacing: '8px',
    WebkitTextStroke: '2px rgba(180,120,0,0.5)',
    textShadow: '0 0 40px rgba(255,215,64,0.5), 0 4px 0 #B8860B, 0 8px 30px rgba(0,0,0,0.7)',
    position: 'relative',
    zIndex: 1,
  },
  goalSub: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '18px',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '4px',
    textTransform: 'uppercase',
    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
    position: 'relative',
    zIndex: 1,
  },

  /* Pause overlay */
  pauseOverlay: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    zIndex: 10,
    pointerEvents: 'none',
  },
  pauseText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '60px',
    fontWeight: '900',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '8px',
    textShadow: '0 4px 20px rgba(0,0,0,0.7)',
  },
  pauseSub: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '2px',
  },

  /* Foul overlay */
  foulOverlay: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    animation: 'goalPulse 0.4s ease-out',
    zIndex: 10,
  },
  foulText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '56px',
    fontWeight: '900',
    color: '#FF5722',
    letterSpacing: '6px',
    textShadow: '0 0 30px rgba(255,87,34,0.5), 0 3px 0 #BF360C, 0 6px 20px rgba(0,0,0,0.7)',
  },
  foulSub: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '16px',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    textShadow: '0 2px 8px rgba(0,0,0,0.6)',
  },

  /* Set piece setup overlay */
  setPieceOverlay: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(8,10,25,0.9)',
    border: '2px solid rgba(255,215,64,0.3)',
    borderRadius: '14px',
    padding: '20px 32px',
    boxShadow: '0 6px 30px rgba(0,0,0,0.6)',
    zIndex: 10,
    pointerEvents: 'auto',
  },
  setPieceText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '22px',
    fontWeight: '900',
    color: '#FFD740',
    letterSpacing: '3px',
    textShadow: '0 0 12px rgba(255,215,64,0.3)',
  },
  setPieceSub: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '1.5px',
    textAlign: 'center',
  },
  setPieceBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '10px 28px',
    background: 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)',
    border: '2px solid #1B5E20',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 3px 0 #1B5E20, 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    outline: 'none',
    marginTop: '4px',
  },

  /* Hint */
  hint: {
    position: 'absolute',
    bottom: '3px',
    right: '10px',
    fontSize: '9px',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: '0.5px',
  },
}
