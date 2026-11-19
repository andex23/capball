import { useEffect, useState } from 'react'
import { useLagosStore, winsOf, rankValue } from './lagosStore'
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
          <button className="btn btn-primary" onClick={() => { playButtonSelect(); window.location.reload() }}>Try again</button>
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
          <p className="muted account-note">Your career, results and rewards sync to your Lagos Life account.</p>
          <SavedGames />
        </>
      )}
    </div>
  )
}

/** A place on the board where ties share a place: 1 + how many have more wins (as Lagos Life counts your rank). */
export function tiedRank(top, i, scoreOf) {
  const mine = scoreOf(top[i])
  let ahead = 0
  for (const r of top) if (scoreOf(r) > mine) ahead++
  return ahead + 1
}

/** Gold, silver and bronze for the top three places (ties share a medal). */
export const medal = (rank) => ({ 1: 'gold', 2: 'silver', 3: 'bronze' })[rank]

/** The words that run along the pitch-side board: the top five and you. */
const rawOf = (r) => r?.score ?? r?.best ?? 0

/** The board in order: most wins first, then most goals (the numbers carry both). */
export function orderedBoard(board) {
  const top = Array.isArray(board?.top) ? board.top : []
  return top.map((r, i) => ({ r, i })).sort((a, b) => (rankValue(rawOf(b.r)) - rankValue(rawOf(a.r))) || (a.i - b.i)).map((x) => x.r)
}

export function tickerItems(board, wins = 0, max = 5) {
  const top = orderedBoard(board)
  const value = (r) => rankValue(rawOf(r))
  const items = top.slice(0, max).filter((r) => r?.name).map((r, i) => ({ rank: tiedRank(top, i, value), name: String(r.name).slice(0, 18), wins: winsOf(rawOf(r)) }))
  const me = board?.me
  return { items, me: me?.rank ? { rank: me.rank, wins: Math.max(wins, winsOf(rawOf(me))) } : null }
}

/** A pitch-side LED board on the menu: the top players run past, right to left. Tap for the full board. */
export function LagosTicker({ onOpen }) {
  const board = useLagosStore((s) => s.board)
  const wins = useLagosStore((s) => Math.max(s.wins || 0, s.best || 0))
  const { items, me } = tickerItems(board, wins)
  if (!items.length) return null
  const run = (
    <span className="tk-run">
      {items.map((x) => <span key={`${x.rank}-${x.name}`} data-medal={medal(x.rank)}><span className="tk-rank">{x.rank}</span><b>{x.name}</b><small>{x.wins} {x.wins === 1 ? 'win' : 'wins'}</small><i>◆</i></span>)}
      {me && <span data-me="true"><span className="tk-rank">{me.rank}</span><b>You</b><small>{me.wins} {me.wins === 1 ? 'win' : 'wins'}</small><i>◆</i></span>}
    </span>
  )
  return (
    <button type="button" className="tk" onClick={() => { playButtonSelect(); onOpen() }} aria-label={`Top player: ${items[0].name}, ${items[0].wins} wins. Open the leaderboard`}>
      <span className="tk-tag">Top player</span>
      <span className="tk-track" style={{ '--tk-time': `${8 + (items.length + (me ? 1 : 0)) * 4}s` }} aria-hidden="true">{run}{run}</span>
    </button>
  )
}

/** The Lagos Life leaderboard: total wins. */
export function LagosBoard() {
  const { board, boardError, wins, best, player } = useLagosStore()
  const [tab, setTab] = useState('board')
  useEffect(() => { if (tab === 'board') useLagosStore.getState().loadBoard() }, [tab])
  const top = orderedBoard(board)
  const me = board?.me
  const scoreOf = (r) => rankValue(rawOf(r))
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
                  <li key={`${i}-${r.name}`} data-medal={medal(tiedRank(top, i, scoreOf))} data-me={player && r.name === player.name && scoreOf(r) === scoreOf(me) ? 'true' : undefined}>
                    <span className="rankings-rank">{tiedRank(top, i, scoreOf)}</span>
                    <span className="rankings-name">{r.name}</span>
                    <span className="rankings-num"><b>{winsOf(rawOf(r))}</b><small>wins</small></span>
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
