import { useMatchStore, SCREEN } from '../state/MatchStore'
import { FORMATIONS, PITCH, getFormationPositions } from '../data/TeamData'
import { STADIUMS } from '../data/StadiumData'
import { playButtonSelect, playWhistle, playHoverTick } from '../audio/SoundManager'
import { fadeOutMenuMusic } from '../audio/MusicManager'
import { sendFormation } from '../multiplayer/MultiplayerManager'
import SetupShell from '../ui/SetupShell'
import { displayColor } from '../ui/color'

const FORMATION_KEYS = Object.keys(FORMATIONS)

/* Mini pitch showing exactly where the caps start (same data the match uses). */
function PitchPreview({ team, formationKey, color, edge }) {
  const sc = STADIUMS[useMatchStore.getState().stadium] || STADIUMS.arena
  const w = 300
  const h = 200
  const toX = (x) => (x / PITCH.halfW) * (w / 2 - 8) + w / 2
  const toY = (y) => (y / PITCH.halfH) * (h / 2 - 8) + h / 2
  const positions = getFormationPositions(team, formationKey, 'left')
  const gradId = `fp-${team}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12 }} role="img" aria-label={`${FORMATIONS[formationKey].name} formation`}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1">
          <stop offset="0" stopColor={sc.grass1} />
          <stop offset="0.5" stopColor={sc.grass2} />
          <stop offset="1" stopColor={sc.grass1} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${gradId})`} />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={i * (w / 6)} width={w / 12} height={h} fill="rgba(255,255,255,0.03)" />
      ))}
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2">
        <rect x={8} y={8} width={w - 16} height={h - 16} rx={2} />
        <line x1={w / 2} y1={8} x2={w / 2} y2={h - 8} />
        <circle cx={w / 2} cy={h / 2} r={(PITCH.centerCircleR / PITCH.halfW) * (w / 2 - 8)} />
        <rect x={8} y={toY(-PITCH.penAreaH / 2)} width={(PITCH.penAreaW / PITCH.width) * (w - 16)} height={(PITCH.penAreaH / PITCH.height) * (h - 16)} />
        <rect x={w - 8 - (PITCH.penAreaW / PITCH.width) * (w - 16)} y={toY(-PITCH.penAreaH / 2)} width={(PITCH.penAreaW / PITCH.width) * (w - 16)} height={(PITCH.penAreaH / PITCH.height) * (h - 16)} />
      </g>
      {Object.entries(positions).map(([role, p]) => {
        const r = role === 'gk' ? 10 : 8
        const x = toX(p.x)
        return (
          <g key={role}>
            <ellipse cx={x + 1} cy={toY(p.y) + 3} rx={r} ry={r * 0.45} fill="rgba(0,0,0,0.3)" />
            <circle cx={x} cy={toY(p.y)} r={r} fill={color} stroke={edge} strokeWidth="2.5" />
            <circle cx={x - r * 0.25} cy={toY(p.y) - r * 0.3} r={r * 0.35} fill="rgba(255,255,255,0.25)" />
          </g>
        )
      })}
    </svg>
  )
}

function FormationCard({ team, config, formation, onSelect, locked, tag }) {
  const color = displayColor(config.primary)
  return (
    <section className="card team-card" style={{ '--team': color }} aria-label={`${config.name} formation`}>
      <div className="team-card-head">
        <span className="display" style={{ fontSize: 24, flex: 1 }}>{config.name}</span>
        {tag && <span className="lock-note">{tag}</span>}
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PitchPreview team={team} formationKey={formation} color={config.primary} edge={config.edge} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} role="group" aria-label="Formation">
          {FORMATION_KEYS.map((key) => (
            <button
              key={key}
              className="list-option"
              aria-pressed={formation === key}
              disabled={locked}
              onMouseEnter={playHoverTick}
              onClick={() => { playButtonSelect(); onSelect(key) }}
            >
              <span>{FORMATIONS[key].name}</span>
              <small>{FORMATIONS[key].description}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function FormationScreen() {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const formations = useMatchStore((s) => s.formations)
  const setFormation = useMatchStore((s) => s.setFormation)
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const startGame = useMatchStore((s) => s.startGame)
  const gameMode = useMatchStore((s) => s.gameMode)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const isOnline = gameMode === 'online'

  const kickOff = () => {
    playWhistle()
    fadeOutMenuMusic()
    startGame()
  }

  const choose = (team, key) => {
    setFormation(team, key)
    if (isOnline && myTeam === 'team2' && team === 'team2') sendFormation(key)
  }

  const tagFor = (team) => {
    if (isOnline) return team === myTeam ? 'You' : 'Opponent'
    if (gameMode === 'ai') return team === aiTeam ? 'CPU' : 'You'
    return null
  }

  return (
    <SetupShell
      step={2}
      title="Pick formations"
      subtitle="This is where your caps line up at every kick-off."
      onBack={() => goToScreen(SCREEN.STADIUM_SELECT)}
      next={{ label: 'Kick off', icon: 'ball', onClick: kickOff }}
      onBothReady={kickOff}
    >
      <div className="versus">
        <FormationCard team="team1" config={teamConfig.team1} formation={formations.team1} onSelect={(k) => choose('team1', k)} locked={isOnline && myTeam !== 'team1'} tag={tagFor('team1')} />
        <div className="vs-badge" aria-hidden>VS</div>
        <FormationCard team="team2" config={teamConfig.team2} formation={formations.team2} onSelect={(k) => choose('team2', k)} locked={isOnline && myTeam !== 'team2'} tag={tagFor('team2')} />
      </div>
    </SetupShell>
  )
}
