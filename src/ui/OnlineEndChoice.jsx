import { useEffect, useRef } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { sendReady, getIsHost } from '../multiplayer/MultiplayerManager'
import { endChoiceOutcome, canChoosePenalties } from '../multiplayer/protocol'
import { playConfirm, playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

const WANTS = { rematch: 'wants a rematch', penalties: 'wants penalties' }

/**
 * Full-time buttons for an online match. Each player picks Rematch (or
 * Penalty shootout after a draw) using the ready channel; once both pick the
 * same thing, the host starts it and the guest follows via sync.
 */
export default function OnlineEndChoice({ onRematch, onPenalties }) {
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const onlineReady = useMatchStore((s) => s.onlineReady)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const matchResult = useMatchStore((s) => s.matchResult)
  const opponent = myTeam === 'team1' ? 'team2' : 'team1'
  const mine = onlineReady[myTeam]
  const theirs = onlineReady[opponent]
  const penaltiesOffered = canChoosePenalties(matchResult)
  const outcome = endChoiceOutcome(onlineReady, matchResult)
  const opponentName = teamConfig[opponent]?.name || 'Opponent'
  // Latest callbacks, so a re-render doesn't restart the start timer
  const start = useRef({ onRematch, onPenalties })
  useEffect(() => { start.current = { onRematch, onPenalties } })

  useEffect(() => {
    if (!outcome || !getIsHost()) return
    const timer = setTimeout(() => {
      useMatchStore.getState().resetOnlineReady()
      sendReady(false)
      if (outcome === 'penalties') start.current.onPenalties()
      else start.current.onRematch()
    }, 600)
    return () => clearTimeout(timer)
  }, [outcome])

  const choose = (choice) => {
    const next = mine === choice ? false : choice
    if (next) playConfirm()
    else playButtonSelect()
    useMatchStore.getState().setOnlineReady(myTeam, next)
    sendReady(!!next, next || undefined)
  }

  const label = (choice, text) => {
    if (outcome === choice) return 'Starting…'
    if (mine === choice) return <><Icon name="check" size={18} /> {text} · waiting</>
    if (theirs === choice) return <>Accept {choice === 'penalties' ? 'penalties' : 'rematch'}</>
    return text
  }

  return (
    <>
      <span className="chip end-choice-status" aria-live="polite">
        <span className="team-dot" style={{ '--team': theirs ? 'var(--good)' : 'var(--text-3)' }} />
        {opponentName} · {WANTS[theirs] || 'deciding…'}
      </span>
      {penaltiesOffered && (
        <button
          className={`btn btn-lg btn-block ${mine === 'penalties' ? 'btn-secondary' : 'btn-orange'}`}
          onClick={() => choose('penalties')}
          aria-pressed={mine === 'penalties'}
          disabled={!!outcome}
        >
          <Icon name="ball" size={18} /> {label('penalties', 'Penalty shootout')}
        </button>
      )}
      <button
        className={`btn btn-lg btn-block ${mine === 'rematch' ? 'btn-secondary' : penaltiesOffered ? 'btn-blue' : 'btn-primary'}`}
        onClick={() => choose('rematch')}
        aria-pressed={mine === 'rematch'}
        disabled={!!outcome}
      >
        <Icon name="restart" size={18} /> {label('rematch', 'Rematch')}
      </button>
    </>
  )
}
