import { useMatchStore, SCREEN, isAuthority } from '../state/MatchStore'
import { stopAllBodies } from '../physics/PhysicsWorld'
import { disconnect } from '../multiplayer/MultiplayerManager'
import { playConfirm, playButtonSelect, playWhistle } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import CapPreview from '../ui/CapPreview'
import { displayColor } from '../ui/color'

const STAT_ROWS = [
  { key: 'goals', label: 'Goals' },
  { key: 'shots', label: 'Shots' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'turns', label: 'Turns' },
]

function StatRow({ label, a, b, colorA, colorB }) {
  const total = a + b || 1
  return (
    <div>
      <div className="label-row tabular" style={{ fontWeight: 700, marginBottom: 4 }}>
        <span>{a}</span><span className="eyebrow">{label}</span><span>{b}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, height: 6 }}>
        <div style={{ flex: a / total || 0.0001, background: colorA, borderRadius: 3, opacity: a >= b ? 1 : 0.45 }} />
        <div style={{ flex: b / total || 0.0001, background: colorB, borderRadius: 3, opacity: b >= a ? 1 : 0.45 }} />
      </div>
    </div>
  )
}

export default function MatchEndScreen() {
  const matchResult = useMatchStore((s) => s.matchResult)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const gameMode = useMatchStore((s) => s.gameMode)
  const authority = useMatchStore((s) => isAuthority(s))

  if (!matchResult) return null
  const { winner, score, team1Name, team2Name, penaltyScore, isDraw, stats } = matchResult
  const c1 = displayColor(teamConfig.team1.primary)
  const c2 = displayColor(teamConfig.team2.primary)
  const winnerName = winner === 'team1' ? team1Name : team2Name
  const online = gameMode === 'online'

  const rematch = () => { playConfirm(); playWhistle(); stopAllBodies(); useMatchStore.getState().startGame() }
  const penalties = () => { playConfirm(); playWhistle(); stopAllBodies(); useMatchStore.getState().startPenaltyShootout() }
  const menu = () => {
    playButtonSelect()
    stopAllBodies()
    if (online) disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
  }

  let headline = isDraw ? 'It’s a draw' : `${winnerName} win`
  if (gameMode === 'ai' && !isDraw) headline = winner === useMatchStore.getState().aiTeam ? 'CPU wins' : 'You win!'
  if (online && !isDraw) headline = winner === useMatchStore.getState().onlineMyTeam ? 'You win!' : `${winnerName} win`

  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
      <div className="card" style={{ width: 'min(560px, 100%)', animation: 'pop-in 0.3s ease' }}>
        <div className="card-pad" style={{ textAlign: 'center', paddingBottom: 8 }}>
          <div className="eyebrow">{penaltyScore ? 'After penalties' : 'Full time'}</div>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 8vw, 60px)', color: isDraw ? 'var(--text)' : 'var(--accent)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {!isDraw && <Icon name="trophy" size={36} />}{headline}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, padding: '8px 20px 16px' }}>
          <div style={{ textAlign: 'center', opacity: winner === 'team2' ? 0.6 : 1 }}>
            <CapPreview config={teamConfig.team1} size={72} />
            <div className="display" style={{ fontSize: 22, marginTop: 6 }}>{team1Name}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="display tabular" style={{ fontSize: 72 }}>{score.team1}<span style={{ color: 'var(--text-3)', margin: '0 8px' }}>–</span>{score.team2}</div>
            {penaltyScore && <div className="chip" style={{ cursor: 'default' }}>Pens {penaltyScore.team1}–{penaltyScore.team2}</div>}
          </div>
          <div style={{ textAlign: 'center', opacity: winner === 'team1' ? 0.6 : 1 }}>
            <CapPreview config={teamConfig.team2} size={72} />
            <div className="display" style={{ fontSize: 22, marginTop: 6 }}>{team2Name}</div>
          </div>
        </div>

        {stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
            {STAT_ROWS.map((r) => (
              <StatRow key={r.key} label={r.label} a={stats.team1[r.key]} b={stats.team2[r.key]} colorA={c1} colorB={c2} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20, borderTop: '1px solid var(--line)' }}>
          {authority ? (
            <>
              {isDraw && !penaltyScore && (
                <button className="btn btn-primary btn-lg btn-block" onClick={penalties}><Icon name="ball" size={18} /> Penalty shootout</button>
              )}
              <button className={`btn btn-lg btn-block ${isDraw && !penaltyScore ? 'btn-secondary' : 'btn-primary'}`} onClick={rematch}>
                <Icon name="restart" size={18} /> Rematch
              </button>
            </>
          ) : (
            <p className="muted" style={{ textAlign: 'center' }}>Waiting for the host to start a rematch{isDraw && !penaltyScore ? ' or penalties' : ''}…</p>
          )}
          <button className="btn btn-ghost btn-block" onClick={menu}><Icon name="exit" size={18} /> {online ? 'Leave' : 'Main menu'}</button>
        </div>
      </div>
    </div>
  )
}
