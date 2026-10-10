import { useState } from 'react'
import MatchResultSplash from '../ui/MatchResultSplash'
import { useTournamentStore } from '../state/tournamentStore'
import GoalClips from '../ui/GoalClips'
import { HeadToHead, ShareResult } from '../ui/ShareResult'
import { PlayerRatings } from '../ui/SquadPanel'
import { useCareerStore } from '../state/careerStore'
import { useMatchStore, SCREEN, isAuthority } from '../state/MatchStore'
import { stopAllBodies } from '../physics/PhysicsWorld'
import { disconnect } from '../multiplayer/MultiplayerManager'
import { playConfirm, playButtonSelect, playWhistle } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import CapPreview from '../ui/CapPreview'
import OnlineEndChoice from '../ui/OnlineEndChoice'
import { displayColor } from '../ui/color'
import { useRecordsStore } from '../state/persistence'
import { recordLine, BEST_LABELS } from '../game/records'

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

/** "Your record vs Hard CPU: 4W 1D 2L", plus any new bests from this match. */
function RecordNote() {
  const records = useRecordsStore((s) => s.records)
  const lastUpdate = useRecordsStore((s) => s.lastUpdate)
  const matchKey = useMatchStore((s) => s.matchKey)
  const gameMode = useMatchStore((s) => s.gameMode)
  const aiDifficulty = useMatchStore((s) => s.aiDifficulty)
  const line = recordLine(records, { gameMode, aiDifficulty })
  const bests = lastUpdate?.matchKey === matchKey ? lastUpdate.newBests : []
  if (!line) return null
  return (
    <div className="records-note">
      <span className="muted tabular">{line}</span>
      {bests.map((b) => <span key={b} className="records-best">{BEST_LABELS[b]}</span>)}
    </div>
  )
}

export default function MatchEndScreen() {
  const [dismissedResult, setDismissedResult] = useState(null)
  const matchResult = useMatchStore((s) => s.matchResult)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const gameMode = useMatchStore((s) => s.gameMode)
  const authority = useMatchStore((s) => isAuthority(s))
  const tournament = useTournamentStore((s) => s.playing)
  const careerNow = useCareerStore((s) => s.career)
  const tournamentError = useTournamentStore((s) => s.error)

  if (!matchResult) return null
  const { winner, score, team1Name, team2Name, penaltyScore, isDraw, stats } = matchResult
  const c1 = displayColor(teamConfig.team1.primary)
  const c2 = displayColor(teamConfig.team2.primary)
  const winnerName = winner === 'team1' ? team1Name : team2Name
  const online = gameMode === 'online'

  const backToTournament = () => { playConfirm(); stopAllBodies(); useTournamentStore.getState().backToHub() }
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

  if (dismissedResult !== matchResult) return <MatchResultSplash
    teams={teamConfig} score={score} winner={winner} penaltyScore={penaltyScore}
    onContinue={() => { playConfirm(); setDismissedResult(matchResult) }} />

  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
      <div className="card" style={{ width: 'min(560px, 100%)', animation: 'pop-in 0.3s ease' }}>
        <div className="card-pad" style={{ textAlign: 'center', paddingBottom: 8 }}>
          <div className="eyebrow">{penaltyScore ? 'After penalties' : 'Full time'}</div>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 8vw, 60px)', color: isDraw ? 'var(--text)' : 'var(--accent)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {!isDraw && <Icon name="trophy" size={36} />}{headline}
          </h1>
        </div>

        <div className="end-teams">
          <div style={{ textAlign: 'center', opacity: winner === 'team2' ? 0.6 : 1 }}>
            <CapPreview config={teamConfig.team1} size={72} />
            <div className="display end-team-name">{team1Name}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="display tabular end-score">{score.team1}<span>–</span>{score.team2}</div>
            {penaltyScore && <div className="chip" style={{ cursor: 'default' }}>Pens {penaltyScore.team1}–{penaltyScore.team2}</div>}
          </div>
          <div style={{ textAlign: 'center', opacity: winner === 'team1' ? 0.6 : 1 }}>
            <CapPreview config={teamConfig.team2} size={72} />
            <div className="display end-team-name">{team2Name}</div>
          </div>
        </div>

        <RecordNote />
        <HeadToHead />
        <ShareResult />

        {stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
            {STAT_ROWS.map((r) => (
              <StatRow key={r.key} label={r.label} a={stats.team1[r.key]} b={stats.team2[r.key]} colorA={c1} colorB={c2} />
            ))}
          </div>
        )}

        {tournament?.kind === 'career' && <div style={{ padding: '0 20px 12px' }}><PlayerRatings career={careerNow} title="Player ratings" fixtureId={tournament.fixture?.id} /></div>}
        <GoalClips />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20, borderTop: '1px solid var(--line)' }}>
          {tournament ? (
            <>
              {tournamentError && (
                <div role="alert" className="offline-note">
                  <span>{tournamentError}</span>
                  <button className="btn btn-secondary" style={{ minHeight: 34, fontSize: 15 }} onClick={() => useTournamentStore.getState().retryRecord()}>Try again</button>
                </div>
              )}
              {tournament.knockout && isDraw && !penaltyScore ? (
                authority
                  ? <button className="btn btn-orange btn-lg btn-block" onClick={penalties}><Icon name="ball" size={18} /> Penalty shootout</button>
                  : <p className="muted" style={{ textAlign: 'center' }}>Level — the cup tie goes to penalties…</p>
              ) : (
                <button className="btn btn-primary btn-lg btn-block" onClick={backToTournament}>
                  <Icon name="trophy" size={18} /> {tournament.kind === 'lanGuest' ? 'View competition results' : tournament.kind === 'career' ? 'Back to your career' : `Back to the ${tournament.knockout ? 'cup' : 'league'}`}
                </button>
              )}
            </>
          ) : online ? (
            <OnlineEndChoice onRematch={rematch} onPenalties={penalties} />
          ) : authority ? (
            <>
              {isDraw && !penaltyScore && (
                <button className="btn btn-orange btn-lg btn-block" onClick={penalties}><Icon name="ball" size={18} /> Penalty shootout</button>
              )}
              <button className={`btn btn-lg btn-block ${isDraw && !penaltyScore ? 'btn-blue' : 'btn-primary'}`} onClick={rematch}>
                <Icon name="restart" size={18} /> Rematch
              </button>
            </>
          ) : (
            <p className="muted" style={{ textAlign: 'center' }}>Waiting for the host to start a rematch{isDraw && !penaltyScore ? ' or penalties' : ''}…</p>
          )}
          {!tournament && <button className="btn btn-secondary btn-block" onClick={menu}><Icon name="exit" size={18} /> {online ? 'Leave' : 'Main menu'}</button>}
        </div>
      </div>
    </div>
  )
}
