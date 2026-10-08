import { useMatchStore, SCREEN, MATCH_DURATIONS, SHOT_CLOCKS } from '../state/MatchStore'
import { STADIUMS, STADIUM_KEYS } from '../data/StadiumData'
import { playButtonSelect, playHoverTick } from '../audio/SoundManager'
import SetupShell from '../ui/SetupShell'
import Icon from '../ui/Icon'
import { formatClock } from '../game/rules'

/* Mini pitch preview showing the surface colors */
function SurfacePreview({ stadium, size = 180 }) {
  const s = stadium
  const w = size
  const h = size * 0.65
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ borderRadius: 10, overflow: 'hidden', display: 'block', width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={`sp-${s.id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={s.grass1} />
          <stop offset="50%" stopColor={s.grass2} />
          <stop offset="100%" stopColor={s.grass1} />
        </linearGradient>
      </defs>
      {/* The table under the board, then the board's surface */}
      <rect width={w} height={h} fill={s.tableColor || '#5a3e28'} />
      <g transform={`translate(${w * 0.08} ${h * 0.1}) scale(0.84 0.8)`}>
      <rect width={w} height={h} fill={s.woodColor} rx={4} />
      <rect x={4} y={4} width={w - 8} height={h - 8} fill={`url(#sp-${s.id})`} />
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
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={s.trimColor} strokeWidth={3} rx={4} opacity={0.6} />
      </g>
    </svg>
  )
}

export default function StadiumSelectScreen() {
  const stadium = useMatchStore((s) => s.stadium)
  const setStadium = useMatchStore((s) => s.setStadium)
  const chosenTeam1Side = useMatchStore((s) => s.chosenTeam1Side)
  const setTeam1Side = useMatchStore((s) => s.setTeam1Side)
  const matchDuration = useMatchStore((s) => s.matchDuration)
  const setMatchDuration = useMatchStore((s) => s.setMatchDuration)
  const shotClock = useMatchStore((s) => s.shotClock)
  const setShotClock = useMatchStore((s) => s.setShotClock)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const isGuest = useMatchStore((s) => s.gameMode === 'online' && s.onlineMyTeam === 'team2')

  const pick = (fn) => () => { playButtonSelect(); fn() }

  return (
    <SetupShell
      step={1}
      title="Choose the table"
      subtitle={isGuest ? 'The host picks the venue, match length and shot clock.' : 'Pick where you play, the ends, and how long.'}
      onBack={() => goToScreen(SCREEN.TEAM_SELECT)}
      next={{ label: 'Formations', onClick: () => goToScreen(SCREEN.FORMATION) }}
      onBothReady={() => goToScreen(SCREEN.FORMATION)}
    >
      <div className="venue-grid">
        {STADIUM_KEYS.map((key) => {
          const st = STADIUMS[key]
          const selected = stadium === key
          return (
            <button
              key={key}
              className="option-card"
              aria-pressed={selected}
              disabled={isGuest}
              onMouseEnter={playHoverTick}
              onClick={pick(() => setStadium(key))}
            >
              <SurfacePreview stadium={st} size={240} />
              <div>
                <div className="venue-name">{st.name}</div>
                <div className="muted venue-label">{st.label}</div>
              </div>
              {selected && <span className="check"><Icon name="check" size={14} strokeWidth={3} /></span>}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 16 }}>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>First-half ends</div>
          <div className="segmented stretch" role="group" aria-label="Which end the home team defends">
            {['left', 'right'].map((side) => (
              <button key={side} aria-pressed={chosenTeam1Side === side} disabled={isGuest} onClick={pick(() => setTeam1Side(side))}>
                {teamConfig.team1.name} {side === 'left' ? 'on the left' : 'on the right'}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Teams swap ends at half time.</p>
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Match length</div>
          <div className="segmented stretch" role="group" aria-label="Match length">
            {MATCH_DURATIONS.map((d) => (
              <button key={d} aria-pressed={matchDuration === d} disabled={isGuest} onClick={pick(() => setMatchDuration(d))}>
                {formatClock(d)}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Two halves of {formatClock(matchDuration / 2)}. The clock stops between turns.</p>
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Shot clock</div>
          <div className="segmented stretch" role="group" aria-label="Shot clock">
            {SHOT_CLOCKS.map((secs) => (
              <button key={secs} aria-pressed={shotClock === secs} disabled={isGuest} onClick={pick(() => setShotClock(secs))}>
                {secs ? `${secs}s` : 'Off'}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {shotClock ? `${shotClock} seconds to flick, or the turn passes over.` : 'Take as long as you like on each turn.'}
          </p>
        </div>
      </div>
    </SetupShell>
  )
}
