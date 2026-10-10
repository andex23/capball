import { useEffect, useState } from 'react'
import { useAnytimeStore } from '../state/anytimeStore'
import { useAccountStore } from '../state/accountStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import AccountPanel from '../ui/AccountPanel'
import { KitEditor } from './TournamentSetupScreen'

export default function AnytimeScreen() {
  const token = useAccountStore(s => s.token)
  const { matches, loading, busy, error } = useAnytimeStore()
  const [code, setCode] = useState('')
  const [turns, setTurns] = useState(20)
  const [team, setTeam] = useState(() => ({ ...useMatchStore.getState().teamConfig.team1 }))
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (token) useAnytimeStore.getState().list() }, [token])
  const open = (action, data) => useAnytimeStore.getState().open(action, data)
  return <div className="screen" style={{ overflowY: 'auto', padding: 'var(--gutter)' }}>
    <div className="card card-pad" style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div className="eyebrow">Online · saved turns</div>
      <h1 className="display">Play anytime</h1>
      <p className="muted">Take a turn, leave, and return whenever you’re ready. Every confirmed shot is saved to your account. Your friend can play while you’re away.</p>
      {!token ? <AccountPanel formOnly /> : <>
        <div className="label-row"><b>{team.name}</b><button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit my team</button></div>
        <label className="eyebrow" htmlFor="anytime-turns">Turns per player</label>
        <select id="anytime-turns" className="field" value={turns} onChange={e => setTurns(Number(e.target.value))}>
          {[10, 20, 30].map(n => <option key={n} value={n}>{n} turns each</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy} onClick={() => open('create', { config: { turnsPerPlayer: turns, teams: { team1: team } } })}>{busy ? 'Opening…' : 'Create saved match'}</button>
        <p className="muted">No turn deadline for casual matches. Both players must join before play starts.</p>
        <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); open('join', { code, team }) }}>
          <input className="field" aria-label="Saved match code" placeholder="10-character code" value={code} maxLength={10} autoCapitalize="characters" autoComplete="off" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} style={{ minWidth: 0, flex: 1 }} />
          <button className="btn btn-blue" disabled={busy || code.length !== 10}>Join</button>
        </form>
        <div className="label-row"><h2 className="display">My matches</h2><button className="btn btn-secondary" disabled={loading} onClick={() => useAnytimeStore.getState().list()}>{loading ? 'Loading…' : 'Refresh'}</button></div>
        {!loading && !matches.length && <p className="muted">Your saved matches will appear here.</p>}
        {matches.map(m => <button key={m.code} className="btn btn-secondary" disabled={busy} style={{ display: 'grid', textAlign: 'left', gap: 6 }} onClick={() => open('get', { code: m.code })}>
          <span>{m.config.teams.team1.name} {m.state.score.team1} – {m.state.score.team2} {m.config.teams.team2.name}</span>
          <small>{m.status === 'complete' ? 'Finished · view match' : m.status === 'waiting' ? 'Waiting for friend to join' : m.myTeam === m.state.activeTeam ? 'Your turn' : 'Waiting for opponent'} · {m.code}</small>
          {m.dueAt && <small>Turn due {new Date(m.dueAt).toLocaleString()}</small>}
        </button>)}
      </>}
      {error && <p role="alert" className="t-warn">{error}</p>}
      <button className="btn btn-secondary" disabled={busy} onClick={() => useMatchStore.getState().goToScreen(SCREEN.ONLINE)}>Back to online</button>
    </div>
    {editing && <KitEditor team={team} withName onUpdate={patch => setTeam({ ...team, ...patch })} onClose={() => setEditing(false)} />}
  </div>
}
