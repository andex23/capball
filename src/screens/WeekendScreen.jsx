/**
 * The Weekend Cup (Lagos Life): your run, the next club up, and the live
 * table for all of Lagos Life. Friday to Sunday; rules in game/weekendRules.js.
 */
import { useEffect, useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useWeekendStore, nextUp } from '../state/weekendStore'
import {
  weekendClubs, weekendWindow, isOpen, runPoints, matchPoints, wentThrough, ROUND_NAMES, RUNS, ROUNDS,
  TOP_PRIZE, RUN_PRIZE, PRIZE_PLACES,
} from '../game/weekendCup'
import { weekendCap } from '../game/rewards'
import { money } from '../game/squad'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import { CrownRank } from '../lagos/LagosPanels'
import CapPreview from '../ui/CapPreview'
import Icon from '../ui/Icon'
import '../ui/weekend.css'

/** "2d 6h", "5h 12m", "14m" */
export function timeLeft(ms) {
  if (ms <= 0) return 'closed'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`
}

const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export default function WeekendScreen() {
  const key = useWeekendStore((s) => s.key)
  const runs = useWeekendStore((s) => s.runs)
  const table = useWeekendStore((s) => s.table)
  const error = useWeekendStore((s) => s.error)
  const [, tick] = useState(0)

  useEffect(() => {
    const w = useWeekendStore.getState()
    w.roll()
    w.refreshTable()
    const t = setInterval(() => { tick((n) => n + 1); useWeekendStore.getState().refreshTable() }, 30000)
    return () => clearInterval(t)
  }, [])

  const open = isOpen()
  const clubs = key ? weekendClubs(key) : []
  const up = nextUp(runs)
  const runIdx = up ? up.run : runs.length - 1
  const run = runs[runIdx] || []
  const best = runs.length ? Math.max(...runs.map(runPoints)) : 0
  const left = key ? weekendWindow(key).end - Date.now() : 0
  const cap = key ? weekendCap(key) : null
  const back = () => { playButtonSelect(); useMatchStore.getState().goToScreen(SCREEN.MENU) }
  const play = () => { playConfirm(); useWeekendStore.getState().play() }

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head tour-top">
          <button className="tour-back" onClick={back} aria-label="Back to the menu"><Icon name="back" size={18} /></button>
          <div>
            <h1 className="display tour-title">Weekend Cup</h1>
            <div className="tour-sub">All of Lagos Life · Friday to Sunday</div>
          </div>
        </header>
        <main className="shell-body wk">
          <section className="wk-poster">
            <div className="wk-live">{open ? <><i aria-hidden /> Live now</> : 'Closed'}</div>
            <div className="wk-poster-row">
              <div>
                <p>Five matches, harder each one. Your best run counts. Top of the table on Sunday night wins.</p>
                <div className="wk-facts">
                  <span><b>{table?.players ?? '—'}</b> playing</span>
                  <span><b>{timeLeft(left)}</b> left</span>
                  {table?.me && <span><b>#{table.me.rank}</b> you</span>}
                </div>
              </div>
              {cap && <div className="wk-prize-cap"><CapPreview config={cap} size={64} /><small>Top 3 win it</small></div>}
            </div>
          </section>

          <section className="wk-card" aria-label="Your run">
            <div className="wk-card-h">
              <h2 className="display">{up ? `Run ${up.run + 1} of ${RUNS}` : 'All three runs played'}</h2>
              <span>Best run counts</span>
            </div>
            <ol className="wk-rounds">
              {clubs.map((c, i) => {
                const m = run[i]
                const next = up && up.run === runIdx && up.round === i
                const state = m ? (wentThrough(m) ? 'won' : 'lost') : next ? 'next' : 'todo'
                return (
                  <li key={i} data-state={state}>
                    <span className="wk-rd">{ROUND_NAMES[i]}</span>
                    <CapPreview config={c} size={28} />
                    <span className="wk-club"><b>{c.name}</b><small>{LEVEL_LABEL[c.difficulty]}</small></span>
                    <span className="wk-score">
                      {m ? <>{m.gf}–{m.ga}{m.pens ? <small> {m.pens === 'won' ? 'pens W' : 'pens L'}</small> : null}<em>+{matchPoints(m)}</em></> : next ? 'Next ►' : '–'}
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="wk-points">
              <div><small>This run</small><b>{runPoints(run)}</b></div>
              <div><small>Your best</small><b>{best}</b></div>
              <p>Win 3 · draw 1 (then penalties) · +1 a goal. Lose and the run ends.</p>
            </div>
            {open && up ? (
              <button className="btn btn-gold btn-lg btn-block" onClick={play}>
                <Icon name="play" size={18} /> {up.round === 0 ? (up.run === 0 ? 'Play the Weekend Cup' : `Start run ${up.run + 1}`) : `Play ${ROUND_NAMES[up.round].toLowerCase()}`}
              </button>
            ) : (
              <p className="muted wk-done">{!open ? 'The Weekend Cup is closed. A new one starts Friday.' : `That’s your three runs. Your best, ${best} points, is on the table.`}</p>
            )}
          </section>

          <section className="wk-card" aria-label="The table">
            <div className="wk-card-h"><h2 className="display">The Lagos table</h2><span>Live</span></div>
            {!table ? <p className="muted">{error || 'Loading the table…'}</p> : table.top.length === 0 ? <p className="muted">No one on the table yet. Be the first.</p> : (
              <ol className="wk-table">
                {table.top.map((r) => (
                  <li key={r.rank} data-me={r.me ? 'true' : undefined} data-top={r.rank <= PRIZE_PLACES ? 'true' : undefined}>
                    <span className="wk-rank">{r.rank === 1 ? <CrownRank size={26} /> : r.rank}</span>
                    <span className="wk-name">{r.me ? 'You' : r.name}</span>
                    <b>{r.points}</b>
                  </li>
                ))}
                {table.me && !table.top.some((r) => r.me) && (
                  <>
                    <li className="wk-gap" aria-hidden>···</li>
                    <li data-me="true"><span className="wk-rank">{table.me.rank}</span><span className="wk-name">You</span><b>{table.me.points}</b></li>
                  </>
                )}
              </ol>
            )}
            {error && table && <p className="muted wk-note">{error}</p>}
            <p className="muted wk-note">Top {PRIZE_PLACES} win the weekend’s cap and {money(TOP_PRIZE)} club money. Get through all {ROUNDS} in a run: {money(RUN_PRIZE)}. Same five clubs for everyone. Leave a match early and you play that round again.</p>
          </section>
        </main>
      </div>
    </div>
  )
}
