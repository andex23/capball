import { useEffect, useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { disconnect } from '../multiplayer/MultiplayerManager'
import { RECONNECT, formatCountdown } from '../multiplayer/reconnect'
import { playButtonSelect } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'

/** Re-render every `ms` while `active`, returning the current time. */
function useNow(active, ms = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}

/**
 * Shown on every screen while a dropped online link is being recovered:
 * the host waits (match paused) with a countdown, the guest retries.
 * When the grace period runs out, ConnectionLost (App.jsx) takes over.
 */
export default function OnlineReconnect() {
  const reconnect = useMatchStore((s) => s.onlineReconnect)
  const gameMode = useMatchStore((s) => s.gameMode)
  const screen = useMatchStore((s) => s.screen)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const matchPaused = useMatchStore((s) => s.screen === SCREEN.PLAYING && s.paused)
  const phase = gameMode === 'online' && screen !== SCREEN.MENU ? reconnect?.phase : null
  const now = useNow(phase === 'lost')

  if (phase !== 'lost' && phase !== 'restored') return null

  const isHost = myTeam === 'team1'
  const opponent = teamConfig[isHost ? 'team2' : 'team1']?.name || (isHost ? 'Your opponent' : 'The host')

  if (phase === 'restored') {
    return (
      <div className="reconnect-toast" role="status">
        <Icon name="check" size={18} />
        {isHost ? `${opponent} is back` : 'Reconnected'}
        {matchPaused && ' — resuming…'}
      </div>
    )
  }

  const remaining = Math.max(0, reconnect.deadline - now)
  const progress = Math.min(1, remaining / RECONNECT.graceMs)

  const leave = () => {
    playButtonSelect()
    disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
    useMatchStore.getState().setGameMode('local')
  }

  return (
    <Modal
      title={isHost ? 'Connection lost' : 'Reconnecting…'}
      footer={<button className="btn btn-red btn-block" onClick={leave}><Icon name="exit" size={18} /> Leave</button>}
    >
      <div className="reconnect-status" aria-live="polite">
        <span className="reconnect-spinner" aria-hidden />
        <span>
          {isHost ? `Waiting for ${opponent} to reconnect…` : `Reconnecting to ${opponent}…`}
          {' '}<span className="tabular">({formatCountdown(remaining)})</span>
        </span>
      </div>
      <div className="reconnect-meter" role="progressbar" aria-label="Time left to reconnect" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <p className="muted">
        {isHost
          ? `${screen === SCREEN.PLAYING ? 'The match is paused. ' : ''}If they aren’t back within a minute, the match ends.`
          : `${reconnect.attempts ? `Attempt ${reconnect.attempts}. ` : ''}${screen === SCREEN.PLAYING ? 'The match is paused while we get you back in.' : 'Hang on while we get you back in.'}`}
      </p>
    </Modal>
  )
}
