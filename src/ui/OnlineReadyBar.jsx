import { useTournamentStore } from '../state/tournamentStore'
import { useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { sendReady, getIsHost, disconnect } from '../multiplayer/MultiplayerManager'
import { playConfirm, playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

/**
 * Online footer for the setup screens. Both players ready up; the host then
 * moves the match on and the guest follows via state sync.
 */
export default function OnlineReadyBar({ onBothReady }) {
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const onlineReady = useMatchStore((s) => s.onlineReady)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const opponent = myTeam === 'team1' ? 'team2' : 'team1'
  const iAmReady = !!onlineReady[myTeam]
  const opponentReady = !!onlineReady[opponent]
  const bothReady = iAmReady && opponentReady

  useEffect(() => {
    if (!bothReady || !getIsHost()) return
    const timer = setTimeout(() => {
      useMatchStore.getState().resetOnlineReady()
      sendReady(false)
      onBothReady()
    }, 600)
    return () => clearTimeout(timer)
  }, [bothReady, onBothReady])

  const toggleReady = () => {
    playConfirm()
    useMatchStore.getState().setOnlineReady(myTeam, !iAmReady)
    sendReady(!iAmReady)
  }

  const leave = () => {
    playButtonSelect()
    if (useTournamentStore.getState().playing) { useTournamentStore.getState().backToHub(); return }
    disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={leave} aria-label="Leave">
        <Icon name="exit" size={18} /> <span className="ready-leave-label">Leave</span>
      </button>
      <div className="ready-group">
        <span className="chip ready-chip" aria-live="polite">
          <span className="team-dot" style={{ '--team': opponentReady ? 'var(--good)' : 'var(--text-3)' }} />
          <span className="ready-text"><span className="ready-name">{teamConfig[opponent]?.name || 'Opponent'} · </span>{opponentReady ? 'Ready' : 'Choosing…'}</span>
        </span>
        <button className={`btn btn-lg ${iAmReady ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleReady} aria-pressed={iAmReady}>
          {bothReady ? 'Starting…' : iAmReady ? <><Icon name="check" size={18} /> Ready</> : 'Ready up'}
        </button>
      </div>
    </>
  )
}
