import { useEffect, useState } from 'react'
import { useAnytimeStore } from '../state/anytimeStore'
import { decisionText } from '../game/replay'
import Modal from './Modal'
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
  const { state: s, config: c } = match
  const actions = useAnytimeStore.getState()
  const explanation = s.lastTurn?.decision ? decisionText(s.lastTurn.decision) : null
  const status = busy ? 'Confirming turn…' : pending ? 'Turn needs confirmation — retry below' : watching ? 'Saved · watching last turn' : s.complete ? (s.winner ? `${c.teams[s.winner].name} wins` : 'Match drawn') : match.status === 'waiting' ? 'Waiting for your friend to join' : s.activeTeam === match.myTeam ? 'Your turn · drag a cap to shoot' : 'Saved · waiting for your opponent'
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: 'max(6px, env(safe-area-inset-top)) 8px 0', flexShrink: 0, display: 'grid', justifyItems: 'center', gap: 6 }}>
      <div className="card card-pad" style={{ position: 'relative', padding: '10px 16px', textAlign: 'center', maxWidth: 580 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
        <b style={{ overflowWrap: 'anywhere' }}>{c.teams.team1.name} {s.score.team1} – {s.score.team2} {c.teams.team2.name}</b>
        <button className="btn btn-secondary" style={{ minHeight: 34, padding: '6px 10px' }} onClick={() => showMenu(true)}>Menu</button>
        </div>
        <p className="muted">Turns: {s.turns.team1}/{c.turnsPerPlayer} · {s.turns.team2}/{c.turnsPerPlayer}</p>
        {s.shootout && <p>Penalties: {s.penaltyScores.team1} – {s.penaltyScores.team2}</p>}
        <p role="status">{status}</p>
        {s.finishReason && <p>{s.finishReason === 'deadline' ? 'Turn deadline passed · opponent wins by forfeit' : 'Match ended by resignation'}</p>}
        {match.dueAt && !s.complete && <small>Turn due {new Date(match.dueAt).toLocaleString()} · leaving does not stop the deadline</small>}
        {!match.dueAt && !s.complete && <small>No turn deadline</small>}
        {match.status === 'waiting' && <p>Invite code: {match.code}</p>}
        {(error || pending) && <p role="alert" className="t-warn">{error || 'Turn needs confirmation. Open Menu to retry.'}</p>}
        {s.penaltyKick && !s.complete && <p className="muted">Penalty · goalkeeper holds the centre in Play anytime</p>}
        {explanation && <p>{explanation.title}: {explanation.detail}</p>}
        {s.lastTurn?.kind === 'foul' && <p>Foul · opponent’s cap was hit before the ball</p>}
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    {menu && <Modal title="Match menu" onClose={() => showMenu(false)} footer={<button className="btn btn-primary btn-block" onClick={() => showMenu(false)}>Back to pitch</button>}>
      <div style={{ display: 'grid', gap: 10 }}>
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
