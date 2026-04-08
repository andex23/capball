import { useMatchStore } from '../state/MatchStore'
import { FORMATIONS, PITCH } from '../data/TeamData'
import { STADIUMS } from '../data/StadiumData'
import { playConfirm, playWhistle } from '../audio/SoundManager'
import OnlineReadyBar from '../ui/OnlineReadyBar'
import { fadeOutMenuMusic } from '../audio/MusicManager'

const FORMATION_KEYS = Object.keys(FORMATIONS)

/* ========================================
   PITCH PREVIEW — clean, polished SVG
   ======================================== */
function PitchPreview({ formationKey, teamColor, edgeColor, dir, w = 200, h = 130 }) {
  const stadiumId = useMatchStore.getState().stadium || 'arena'
  const sc = STADIUMS[stadiumId] || STADIUMS.arena
  const positions = getPositionsForPreview(formationKey, dir, w, h)

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ borderRadius: 10, overflow: 'hidden', display: 'block' }}>
      <defs>
        <linearGradient id={`pg-${dir}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={sc.grass1} />
          <stop offset="50%" stopColor={sc.grass2} />
          <stop offset="100%" stopColor={sc.grass1} />
        </linearGradient>
        <radialGradient id={`cg-${dir}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={teamColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={teamColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Pitch */}
      <rect width={w} height={h} fill={`url(#pg-${dir})`} />

      {/* Mow stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={i * (w / 7)} y={0} width={w / 14} height={h} fill="rgba(255,255,255,0.025)" />
      ))}

      {/* Border */}
      <rect x={3} y={3} width={w - 6} height={h - 6} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} rx={2} />

      {/* Center line */}
      <line x1={w / 2} y1={6} x2={w / 2} y2={h - 6} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
      <circle cx={w / 2} cy={h / 2} r={h * 0.12} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
      <circle cx={w / 2} cy={h / 2} r={2} fill="rgba(255,255,255,0.3)" />

      {/* Goal areas */}
      <rect x={3} y={h / 2 - h * 0.18} width={w * 0.08} height={h * 0.36} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} rx={1} />
      <rect x={w - 3 - w * 0.08} y={h / 2 - h * 0.18} width={w * 0.08} height={h * 0.36} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} rx={1} />

      {/* Goal mouths */}
      <rect x={0} y={h / 2 - h * 0.09} width={3} height={h * 0.18} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
      <rect x={w - 3} y={h / 2 - h * 0.09} width={3} height={h * 0.18} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />

      {/* Caps */}
      {Object.entries(positions).map(([key, pos]) => {
        const isGk = key === 'gk'
        const r = isGk ? 8 : 6.5
        return (
          <g key={key}>
            <circle cx={pos.svgX} cy={pos.svgY} r={r * 2.2} fill={`url(#cg-${dir})`} />
            <ellipse cx={pos.svgX + 0.5} cy={pos.svgY + 1.5} rx={r} ry={r * 0.35} fill="rgba(0,0,0,0.25)" />
            <circle cx={pos.svgX} cy={pos.svgY} r={r + 1.2} fill={edgeColor} opacity={0.65} />
            <circle cx={pos.svgX} cy={pos.svgY} r={r} fill={teamColor} />
            <circle cx={pos.svgX - r * 0.2} cy={pos.svgY - r * 0.25} r={r * 0.35} fill="rgba(255,255,255,0.18)" />
          </g>
        )
      })}
    </svg>
  )
}

function getPositionsForPreview(formationKey, dir, svgW, svgH) {
  const hw = PITCH.halfW
  const hh = PITCH.halfH

  const formationMap = {
    default: {
      gk: { x: dir * hw * 0.9, y: 0 },
      def1: { x: dir * hw * 0.4, y: -hh * 0.35 },
      def2: { x: dir * hw * 0.4, y: hh * 0.35 },
      atk1: { x: dir * hw * 0.1, y: -hh * 0.3 },
      atk2: { x: dir * hw * 0.1, y: hh * 0.3 },
    },
    diamond: {
      gk: { x: dir * hw * 0.9, y: 0 },
      def1: { x: dir * hw * 0.55, y: 0 },
      def2: { x: dir * hw * 0.3, y: -hh * 0.35 },
      atk1: { x: dir * hw * 0.3, y: hh * 0.35 },
      atk2: { x: dir * hw * 0.05, y: 0 },
    },
    line: {
      gk: { x: dir * hw * 0.9, y: 0 },
      def1: { x: dir * hw * 0.5, y: 0 },
      def2: { x: dir * hw * 0.15, y: -hh * 0.4 },
      atk1: { x: dir * hw * 0.15, y: 0 },
      atk2: { x: dir * hw * 0.15, y: hh * 0.4 },
    },
    parkTheBus: {
      gk: { x: dir * hw * 0.9, y: 0 },
      def1: { x: dir * hw * 0.5, y: -hh * 0.35 },
      def2: { x: dir * hw * 0.5, y: 0 },
      atk1: { x: dir * hw * 0.5, y: hh * 0.35 },
      atk2: { x: dir * hw * 0.1, y: 0 },
    },
  }

  const positions = formationMap[formationKey] || formationMap.default
  const result = {}
  for (const [key, pos] of Object.entries(positions)) {
    result[key] = {
      svgX: (pos.x / hw) * (svgW / 2) + svgW / 2,
      svgY: (pos.y / hh) * (svgH / 2) + svgH / 2,
    }
  }
  return result
}

/* ========================================
   FORMATION PICKER — single panel per team
   Large pitch preview + clean vertical list
   ======================================== */
function FormationPicker({ teamKey, teamConfig, formation, onSelect }) {
  const dir = teamKey === 'team1' ? -1 : 1

  return (
    <div style={{
      ...styles.panel,
      borderColor: `${teamConfig.primary}44`,
      boxShadow: `0 8px 35px rgba(0,0,0,0.5), 0 0 25px ${teamConfig.primary}10, inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      {/* Team header */}
      <div style={{
        ...styles.teamHeader,
        background: `linear-gradient(135deg, ${teamConfig.primary} 0%, ${darkenHex(teamConfig.primary, 0.35)} 100%)`,
        boxShadow: `0 3px 12px ${teamConfig.primary}33`,
      }}>
        <span style={styles.teamName}>{teamConfig.name}</span>
      </div>

      {/* Large pitch preview */}
      <div style={styles.pitchArea}>
        <PitchPreview
          formationKey={formation}
          teamColor={teamConfig.primary}
          edgeColor={teamConfig.edge}
          dir={dir}
          w={210}
          h={130}
        />
      </div>

      {/* Formation list */}
      <div style={styles.formationList}>
        {FORMATION_KEYS.map((key) => {
          const f = FORMATIONS[key]
          const selected = formation === key
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                ...styles.formationBtn,
                background: selected
                  ? `linear-gradient(135deg, ${teamConfig.primary}20 0%, ${teamConfig.primary}0A 100%)`
                  : 'rgba(0,0,0,0.15)',
                border: selected ? `2px solid ${teamConfig.primary}` : '1.5px solid rgba(255,255,255,0.06)',
                boxShadow: selected ? `0 0 12px ${teamConfig.primary}20, inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
              }}
            >
              {/* Selected indicator */}
              {selected && (
                <div style={{
                  width: '4px',
                  height: '100%',
                  background: teamConfig.primary,
                  borderRadius: '2px',
                  position: 'absolute',
                  left: '0',
                  top: '0',
                }} />
              )}
              <span style={{
                ...styles.formationName,
                color: selected ? '#FFD740' : 'rgba(255,255,255,0.7)',
              }}>
                {f.name}
              </span>
              <span style={{
                ...styles.formationDesc,
                color: selected ? 'rgba(255,215,64,0.45)' : 'rgba(255,255,255,0.25)',
              }}>
                {f.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ========================================
   MAIN SCREEN
   ======================================== */
export default function FormationScreen() {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const formations = useMatchStore((s) => s.formations)
  const setFormation = useMatchStore((s) => s.setFormation)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const startGame = useMatchStore((s) => s.startGame)
  const gameMode = useMatchStore((s) => s.gameMode)
  const isOnline = gameMode === 'online'

  const handleKickOff = () => {
    playConfirm(); playWhistle(); fadeOutMenuMusic(); startGame()
  }

  return (
    <div style={styles.container}>
      <div style={styles.bgPattern} />
      <div style={styles.vignette} />

      {/* Title */}
      <div style={styles.titleArea}>
        <h2 style={styles.heading}>CHOOSE FORMATION</h2>
        <div style={styles.headingLine} />
      </div>

      {/* Two panels + VS */}
      <div style={styles.mainContent}>
        <FormationPicker
          teamKey="team1"
          teamConfig={teamConfig.team1}
          formation={formations.team1}
          onSelect={(f) => setFormation('team1', f)}
        />

        <div style={styles.vsDivider}>
          <div style={styles.vsLineTop} />
          <div style={styles.vsCircle}>
            <span style={styles.vsText}>VS</span>
          </div>
          <div style={styles.vsLineBottom} />
        </div>

        <FormationPicker
          teamKey="team2"
          teamConfig={teamConfig.team2}
          formation={formations.team2}
          onSelect={(f) => setFormation('team2', f)}
        />
      </div>

      {/* Action bar */}
      {isOnline ? (
        <OnlineReadyBar nextScreen={null} onBothReady={handleKickOff} />
      ) : (
        <div style={styles.actionBar}>
          <button
            style={styles.backBtn}
            onClick={() => goToScreen('TEAM_SELECT')}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            BACK
          </button>

          <button
            style={styles.startBtn}
            onClick={handleKickOff}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = '0 2px 0 #5a1a00, 0 3px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 5px 0 #5a1a00, 0 8px 25px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 30px rgba(255,140,0,0.15)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 5px 0 #5a1a00, 0 8px 25px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 30px rgba(255,140,0,0.15)' }}
          >
            KICK OFF
          </button>
        </div>
      )}
    </div>
  )
}

function darkenHex(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/* ========================================
   STYLES
   ======================================== */
const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #060814 0%, #0c1028 25%, #111840 55%, #0a0e22 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "var(--font-hud, 'Russo One', 'Arial Black', sans-serif)",
    color: 'white',
    gap: '8px',
    padding: '10px 20px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(rgba(255,215,64,0.012) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    pointerEvents: 'none',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)',
    pointerEvents: 'none',
  },

  /* Title */
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  heading: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: 'clamp(26px, 4.5vw, 38px)',
    fontWeight: '900',
    color: '#FFD740',
    margin: 0,
    letterSpacing: '6px',
    textShadow: '0 0 25px rgba(255,215,64,0.35), 0 3px 0 #B8860B, 0 6px 20px rgba(0,0,0,0.6)',
  },
  headingLine: {
    width: '240px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
    marginTop: '6px',
  },

  /* Main content */
  mainContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0px',
    position: 'relative',
    zIndex: 1,
  },

  /* VS divider */
  vsDivider: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 14px',
    minHeight: '100%',
  },
  vsLineTop: {
    width: '2px',
    height: '60px',
    background: 'linear-gradient(180deg, transparent, rgba(255,215,64,0.2))',
  },
  vsLineBottom: {
    width: '2px',
    height: '60px',
    background: 'linear-gradient(180deg, rgba(255,215,64,0.2), transparent)',
  },
  vsCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(20,25,55,0.95) 0%, rgba(10,14,35,0.98) 100%)',
    border: '2px solid rgba(255,215,64,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(255,215,64,0.08), 0 4px 12px rgba(0,0,0,0.4)',
    margin: '8px 0',
  },
  vsText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px',
    fontWeight: '700',
    color: 'rgba(255,215,64,0.65)',
    letterSpacing: '1px',
  },

  /* Panel */
  panel: {
    background: 'linear-gradient(180deg, rgba(14,18,42,0.95) 0%, rgba(8,11,28,0.98) 100%)',
    border: '1.5px solid',
    borderRadius: '14px',
    width: 'clamp(320px, 38vw, 480px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  teamHeader: {
    padding: '9px 18px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '2.5px',
    textShadow: '0 2px 4px rgba(0,0,0,0.4)',
  },

  /* Pitch area */
  pitchArea: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px 14px 4px',
    background: 'radial-gradient(ellipse at center, rgba(46,139,53,0.05) 0%, transparent 70%)',
  },

  /* Formation list */
  formationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '6px 12px 10px',
  },
  formationBtn: {
    position: 'relative',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    padding: '8px 14px 8px 18px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.12s ease',
    outline: 'none',
    overflow: 'hidden',
  },
  formationName: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.8px',
  },
  formationDesc: {
    fontSize: '10px',
    letterSpacing: '0.5px',
  },

  /* Action bar */
  actionBar: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  backBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.65)',
    padding: '12px 32px',
    background: 'linear-gradient(180deg, rgba(55,60,85,0.9) 0%, rgba(30,33,50,0.95) 100%)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 3px 0 rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
    transition: 'transform 0.08s ease',
    outline: 'none',
  },
  startBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: 'clamp(17px, 2.5vw, 21px)',
    fontWeight: '900',
    letterSpacing: '3px',
    color: 'white',
    padding: '14px 52px',
    background: 'linear-gradient(180deg, #FF8F00 0%, #F57C00 30%, #E65100 70%, #BF360C 100%)',
    border: '2px solid #BF360C',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 5px 0 #5a1a00, 0 8px 25px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 30px rgba(255,140,0,0.15)',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    outline: 'none',
  },
}
