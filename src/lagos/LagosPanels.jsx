import { useEffect, useState } from 'react'
import { useLagosStore } from './lagosStore'
import { playButtonSelect } from '../audio/SoundManager'
import SavedGames from '../ui/SavedGames'
import RecordsPanel from '../ui/RecordsPanel'
import Icon from '../ui/Icon'

/** Stands in for the Counterball sign-in: the player is whoever is signed in to Lagos Life. */
export function LagosAccount({ formOnly = false }) {
  const { status, error, player } = useLagosStore()
  if (status !== 'ready') {
    return (
      <div className="account">
        <p className={status === 'error' ? 't-warn' : 'muted'} role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error' ? error : 'Connecting to Lagos Life…'}
        </p>
        {status === 'error' && (
          <button className="btn btn-primary" onClick={() => { playButtonSelect(); useLagosStore.getState().boot() }}>Try again</button>
        )}
      </div>
    )
  }
  return (
    <div className="account">
      <div className="account-who">
        {player.avatar
          ? <img className="account-avatar lagos-avatar" src={player.avatar} alt="" width="40" height="40" />
          : <span className="account-avatar" aria-hidden>{(player.name || 'P').slice(0, 1).toUpperCase()}</span>}
        <div>
          <b>{player.name}</b>
          <small className="muted">Playing through Lagos Life</small>
        </div>
      </div>
      {!formOnly && (
        <>
          <p className="muted account-note">Your games, career and records are saved on this phone.</p>
          <SavedGames />
        </>
      )}
    </div>
  )
}

/** The Lagos Life leaderboard: total wins. */
export function LagosBoard() {
  const { board, boardError, wins, best, player } = useLagosStore()
  const [tab, setTab] = useState('board')
  useEffect(() => { if (tab === 'board') useLagosStore.getState().loadBoard() }, [tab])
  const top = Array.isArray(board?.top) ? board.top : []
  const me = board?.me
  const scoreOf = (r) => r?.score ?? r?.best ?? 0
  return (
    <div className="rankings">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'board'} onClick={() => { playButtonSelect(); setTab('board') }}>Lagos Life</button>
        <button role="tab" aria-selected={tab === 'mine'} onClick={() => { playButtonSelect(); setTab('mine') }}>My records</button>
      </div>
      {tab === 'mine' ? <RecordsPanel /> : (
        <>
          <p className="muted t-note">Total wins against the computer and in friend matches. You have <b>{Math.max(wins, best)}</b>.</p>
          {boardError && <p className="t-warn" role="alert">{boardError}</p>}
          {!board && !boardError ? <p className="muted">Loading…</p> : top.length === 0
            ? <p className="muted saved-empty">Nobody on the board yet. Win a match to be first.</p>
            : (
              <ol className="rankings-list">
                {top.map((r, i) => (
                  <li key={`${r.rank ?? i + 1}-${r.name}`} data-me={player && r.name === player.name && scoreOf(r) === scoreOf(me) ? 'true' : undefined}>
                    <span className="rankings-rank">{r.rank ?? i + 1}</span>
                    <span className="rankings-name">{r.name}</span>
                    <span className="rankings-num"><b>{scoreOf(r)}</b><small>wins</small></span>
                  </li>
                ))}
              </ol>
            )}
          {me && <p className="muted t-note"><Icon name="trophy" size={14} /> Your rank: <b>{me.rank ?? '—'}</b></p>}
        </>
      )}
    </div>
  )
}
