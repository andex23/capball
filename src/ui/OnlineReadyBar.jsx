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
    disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={leave}>
        <Icon name="exit" size={18} /> Leave
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="chip" aria-live="polite" style={{ cursor: 'default' }}>
          <span className="team-dot" style={{ '--team': opponentReady ? 'var(--good)' : 'var(--text-3)' }} />
          {teamConfig[opponent]?.name || 'Opponent'} · {opponentReady ? 'Ready' : 'Choosing…'}
        </span>
        <button className={`btn btn-lg ${iAmReady ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleReady} aria-pressed={iAmReady}>
          {bothReady ? 'Starting…' : iAmReady ? <><Icon name="check" size={18} /> Ready</> : 'Ready up'}
        </button>
      </div>
    </>
  )
}
