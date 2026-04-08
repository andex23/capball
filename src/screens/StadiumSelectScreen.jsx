import { useMatchStore, SCREEN } from '../state/MatchStore'
import { STADIUMS, STADIUM_KEYS } from '../data/StadiumData'
import { playButtonSelect, playHoverTick } from '../audio/SoundManager'

function syncNav(screen) {
  const gm = useMatchStore.getState().gameMode
  useMatchStore.getState().goToScreen(screen)
  if (gm === 'online') {
    try { require('../multiplayer/MultiplayerManager').sendStateChange({ screen }) } catch (e) {}
  }
}

/* Mini pitch preview showing the surface colors */
function SurfacePreview({ stadium, size = 180 }) {
  const s = stadium
  const w = size
  const h = size * 0.65
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ borderRadius: 8, overflow: 'hidden', display: 'block' }}>
      <defs>
        <linearGradient id={`sp-${s.id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={s.grass1} />
          <stop offset="50%" stopColor={s.grass2} />
          <stop offset="100%" stopColor={s.grass1} />
        </linearGradient>
      </defs>
      {/* Surface */}
      <rect width={w} height={h} fill={`url(#sp-${s.id})`} />
      {/* Mow stripes */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={i * (w / 6)} y={0} width={w / 12} height={h} fill={`rgba(255,255,255,${s.stripeAlpha})`} />
      ))}
      {/* Border */}
      <rect x={3} y={3} width={w - 6} height={h - 6} fill="none" stroke={s.lineColor} strokeWidth={1.5} rx={2} opacity={0.6} />
      {/* Center line */}
      <line x1={w / 2} y1={6} x2={w / 2} y2={h - 6} stroke={s.lineColor} strokeWidth={1} opacity={0.5} />
      {/* Center circle */}
      <circle cx={w / 2} cy={h / 2} r={h * 0.15} fill="none" stroke={s.lineColor} strokeWidth={1} opacity={0.5} />
      {/* Penalty areas */}
      <rect x={3} y={h * 0.3} width={w * 0.12} height={h * 0.4} fill="none" stroke={s.lineColor} strokeWidth={1} rx={1} opacity={0.4} />
      <rect x={w - 3 - w * 0.12} y={h * 0.3} width={w * 0.12} height={h * 0.4} fill="none" stroke={s.lineColor} strokeWidth={1} rx={1} opacity={0.4} />
      {/* Wood frame overlay */}
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={s.trimColor} strokeWidth={3} rx={8} opacity={0.4} />
    </svg>
  )
}

export default function StadiumSelectScreen() {
  const stadium = useMatchStore((s) => s.stadium)
  const setStadium = useMatchStore((s) => s.setStadium)
  const team1Side = useMatchStore((s) => s.team1Side)
  const setTeam1Side = useMatchStore((s) => s.setTeam1Side)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const goToScreen = useMatchStore((s) => s.goToScreen)

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />

      <div style={styles.titleArea}>
        <h2 style={styles.heading}>CHOOSE VENUE</h2>
        <div style={styles.headingLine} />
      </div>

      <div style={styles.grid}>
        {STADIUM_KEYS.map((key) => {
          const s = STADIUMS[key]
          const selected = stadium === key
          return (
            <button
              key={key}
              className="arcade-btn"
              onClick={() => { playButtonSelect(); setStadium(key) }}
              onMouseEnter={() => playHoverTick()}
              style={{
                ...styles.card,
                border: selected ? `2.5px solid #FFD740` : '1.5px solid rgba(255,255,255,0.08)',
                boxShadow: selected
                  ? '0 0 25px rgba(255,215,64,0.15), 0 6px 20px rgba(0,0,0,0.5)'
                  : '0 4px 15px rgba(0,0,0,0.4)',
                background: selected
                  ? `linear-gradient(180deg, rgba(255,215,64,0.06) 0%, rgba(16,20,45,0.95) 100%)`
                  : 'linear-gradient(180deg, rgba(16,20,45,0.95) 0%, rgba(10,13,30,0.98) 100%)',
              }}
            >
              {selected && <div style={styles.selectedBar} />}
              <SurfacePreview stadium={s} />
              <div style={styles.cardInfo}>
                <span style={{
                  ...styles.cardName,
                  color: selected ? '#FFD740' : 'rgba(255,255,255,0.8)',
                }}>{s.name}</span>
                <span style={{
                  ...styles.cardLabel,
                  color: selected ? 'rgba(255,215,64,0.5)' : 'rgba(255,255,255,0.3)',
                }}>{s.label}</span>
              </div>
              {selected && <div style={styles.checkBadge}>&#10003;</div>}
            </button>
          )
        })}
      </div>

      {/* Side selection */}
      <div style={styles.sideSelector}>
        <span style={styles.sideLabel}>CHOOSE SIDE</span>
        <div style={styles.sideBtns}>
          <button
            className="pill-btn"
            onClick={() => { playButtonSelect(); setTeam1Side('left') }}
            onMouseEnter={() => playHoverTick()}
            style={{
              ...styles.sideBtn,
              background: team1Side === 'left' ? 'rgba(255,215,64,0.15)' : 'rgba(0,0,0,0.3)',
              border: team1Side === 'left' ? '2px solid #FFD740' : '1.5px solid rgba(255,255,255,0.1)',
              color: team1Side === 'left' ? '#FFD740' : 'rgba(255,255,255,0.5)',
            }}
          >
            &#8592; {teamConfig.team1.name} LEFT
          </button>
          <button
            className="pill-btn"
            onClick={() => { playButtonSelect(); setTeam1Side('right') }}
            onMouseEnter={() => playHoverTick()}
            style={{
              ...styles.sideBtn,
              background: team1Side === 'right' ? 'rgba(255,215,64,0.15)' : 'rgba(0,0,0,0.3)',
              border: team1Side === 'right' ? '2px solid #FFD740' : '1.5px solid rgba(255,255,255,0.1)',
              color: team1Side === 'right' ? '#FFD740' : 'rgba(255,255,255,0.5)',
            }}
          >
            {teamConfig.team1.name} RIGHT &#8594;
          </button>
        </div>
      </div>

      <div style={styles.navRow}>
        <button
          className="arcade-btn"
          style={styles.backBtn}
          onClick={() => syncNav(SCREEN.TEAM_SELECT)}
          onMouseEnter={() => playHoverTick()}
        >
          BACK
        </button>
        <button
          className="arcade-btn"
          style={styles.nextBtn}
          onClick={() => { playButtonSelect(); syncNav(SCREEN.FORMATION) }}
          onMouseEnter={() => playHoverTick()}
        >
          NEXT
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #080a18 0%, #0d1230 30%, #151d45 60%, #0a0e25 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    color: 'white',
    gap: '12px',
    padding: '14px 24px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
    pointerEvents: 'none',
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
  },
  heading: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: 'clamp(24px, 4vw, 34px)',
    fontWeight: '900',
    color: '#FFD740',
    margin: 0,
    letterSpacing: '5px',
    textShadow: '0 0 20px rgba(255,215,64,0.3), 0 3px 0 #B8860B',
  },
  headingLine: {
    width: '200px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
    marginTop: '5px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    zIndex: 1,
    maxWidth: '900px',
    width: '100%',
    justifyItems: 'center',
  },
  card: {
    position: 'relative',
    borderRadius: '12px',
    padding: '10px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.15s ease',
    outline: 'none',
    overflow: 'hidden',
    textAlign: 'center',
    width: '100%',
  },
  selectedBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 2px',
    textAlign: 'center',
    width: '100%',
  },
  cardName: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1px',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: '9px',
    letterSpacing: '0.5px',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#FFD740',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1a1a2e',
    fontSize: '11px',
    fontWeight: '900',
    boxShadow: '0 2px 6px rgba(255,215,64,0.3)',
  },
  sideSelector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    zIndex: 1,
  },
  sideLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '3px',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
  },
  sideBtns: {
    display: 'flex',
    gap: '10px',
  },
  sideBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1px',
    padding: '8px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.12s ease',
  },
  navRow: {
    display: 'flex',
    gap: '16px',
    zIndex: 1,
  },
  backBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.7)',
    padding: '12px 32px',
    background: 'linear-gradient(180deg, rgba(60,65,90,0.9) 0%, rgba(35,38,55,0.95) 100%)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
    outline: 'none',
  },
  nextBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '12px 52px',
    background: 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)',
    border: '2px solid #1B5E20',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #1B5E20, 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
    outline: 'none',
  },
}
