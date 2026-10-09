import { useEffect, useState } from 'react'
import { useBoardStore } from '../state/boardStore'
import { useAccountStore } from '../state/accountStore'
import { weekKey } from '../state/savedMatch'
import { playButtonSelect } from '../audio/SoundManager'
import RecordsPanel from './RecordsPanel'

const TABS = [
  { key: 'week', label: 'This week' },
  { key: 'all', label: 'All time' },
  { key: 'mine', label: 'My records' },
]

/** Leaderboards (signed-in players, vs computer and online wins) and your own records. */
export default function RankingsPanel({ onSignIn }) {
  const [tab, setTab] = useState('week')
  const { rows, loading, error, load } = useBoardStore()
  const username = useAccountStore((s) => s.username)
  const period = tab === 'all' ? 'all' : weekKey()

  useEffect(() => { if (tab !== 'mine') load(tab) }, [tab, load])

  return (
    <div className="rankings">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { playButtonSelect(); setTab(t.key) }}>{t.label}</button>
        ))}
      </div>
      {tab === 'mine' ? <RecordsPanel /> : (
        <>
          <p className="muted t-note">Most wins against the computer and online{tab === 'week' ? ' this week (from Monday)' : ''}. Goals break ties.</p>
          {!username && (
            <p className="t-note rankings-join">
              Sign in to get on the board. <button className="btn btn-ghost" onClick={onSignIn}>Sign in</button>
            </p>
          )}
          {error && <p className="t-warn" role="alert">{error}</p>}
          {loading && !rows[period] ? <p className="muted">Loading…</p> : (
            (rows[period] || []).length === 0
              ? <p className="muted saved-empty">Nobody on the board yet{tab === 'week' ? ' this week' : ''}. Win a match to be first.</p>
              : (
                <ol className="rankings-list">
                  {rows[period].map((r) => (
                    <li key={`${r.rank}-${r.name}`} data-me={username && r.name.toLowerCase() === username.toLowerCase() ? 'true' : undefined}>
                      <span className="rankings-rank">{r.rank}</span>
                      <span className="rankings-name">{r.name}</span>
                      <span className="rankings-num"><b>{r.won}</b><small>wins</small></span>
                      <span className="rankings-num"><b>{r.goals}</b><small>goals</small></span>
                    </li>
                  ))}
                </ol>
              )
          )}
        </>
      )}
    </div>
  )
}
