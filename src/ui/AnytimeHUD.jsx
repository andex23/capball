import { useEffect, useState } from 'react'
import { useAnytimeStore } from '../state/anytimeStore'
import { decisionText } from '../game/replay'
import Modal from './Modal'
import AnytimeScoreboard from './AnytimeScoreboard'
import { useMatchStore } from '../state/MatchStore'

export default function AnytimeHUD({ children }) {
  const { match, busy, pending, watching, error } = useAnytimeStore()
  const [confirm, setConfirm] = useState(false)
  const [menu, setMenu] = useState(false)
  const showMenu = open => { setMenu(open); useMatchStore.setState({ paused: open }) }
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const refresh = () => { if (!document.hidden) useAnytimeStore.getState().refresh() }
    const timer = setInterval(refresh, 7000)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  if (!match) return null
  const { state: s } = match
  const actions = useAnytimeStore.getState()
  const explanation = s.lastTurn?.decision ? decisionText(s.lastTurn.decision) : null
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
    <AnytimeScoreboard match={match} busy={busy} pending={pending} watching={watching} onMenu={() => showMenu(true)} />
    {match.status === 'waiting' && <p className="at-match-note">Invite code <strong>{match.code}</strong></p>}
    {(error || pending) && <p className="at-match-note" data-error="true" role="alert">{error || 'Open the menu to confirm your turn.'}</p>}
    {watching && explanation && <p className="at-match-note"><strong>{explanation.title}</strong> · {explanation.detail}</p>}
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    {menu && <Modal title="Match menu" onClose={() => showMenu(false)} footer={<button className="btn btn-primary btn-block" onClick={() => showMenu(false)}>Back to pitch</button>}>
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="muted">Drag a cap back to aim, then release to shoot.</p>
        {match.dueAt && !s.complete && <p>Turn due {new Date(match.dueAt).toLocaleString()}</p>}
        {!match.dueAt && !s.complete && <p>No turn deadline</p>}
        {s.finishReason && <p>{s.finishReason === 'deadline' ? 'The turn deadline passed. Opponent wins by forfeit.' : 'Match ended by resignation.'}</p>}
        {s.penaltyKick && !s.complete && <p>Penalty: the goalkeeper holds the centre in Play anytime.</p>}
        {explanation && <p><b>{explanation.title}</b> · {explanation.detail}</p>}
        {s.lastTurn?.kind === 'foul' && <p>Foul · opponent’s cap was hit before the ball.</p>}
        <p className="muted">{match.dueAt ? 'The turn deadline continues while this menu is open or you are away.' : 'Your confirmed turns are saved. Leave and return whenever you like.'}</p>
        {match.status === 'waiting' && <button className="btn btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(match.code); setCopied(true) } catch { setCopied(false) } }}>{copied ? 'Copied' : `Copy code: ${match.code}`}</button>}
        {pending && <button className="btn btn-primary" disabled={busy} onClick={() => { showMenu(false); actions.retry() }}>Retry confirmation</button>}
        {watching ? <button className="btn btn-secondary" onClick={() => { actions.skip(); showMenu(false) }}>Skip playback</button> : s.lastTurn && <button className="btn btn-secondary" disabled={busy || !!pending} onClick={() => { showMenu(false); actions.replay() }}>Replay last turn</button>}
        <button className="btn btn-secondary" onClick={() => actions.refresh()} disabled={busy || watching}>Refresh</button>
        <button className="btn btn-primary" onClick={() => actions.leave()}>{pending ? 'Leave · confirm turn later' : s.complete ? 'My matches' : 'Save and leave'}</button>
        {!s.complete && <button className="btn btn-secondary" disabled={busy || !!pending} onClick={() => { showMenu(false); setConfirm(true) }}>Resign</button>}
      </div>
    </Modal>}
    {confirm && <Modal title="Resign this match?" onClose={() => setConfirm(false)} footer={<><button className="btn btn-secondary" onClick={() => setConfirm(false)}>Keep playing</button><button className="btn btn-primary" onClick={() => { setConfirm(false); actions.resign() }}>Resign</button></>}><p>Your opponent wins. To keep your progress instead, use Save and leave.</p></Modal>}
  </div>
}
