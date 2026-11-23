/**
 * HQ: the Lagos Life game, day by day. Reads the usage counts from
 * /api/lagos?stats=N (needs the stats key, kept on this device only) and
 * refreshes itself every minute.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { timeline, MODES, change, finishRate, headlines, dayProgress } from './statsView'

const KEY = 'capball:hq-stats-key'
const REFRESH_MS = 60_000
const readKey = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const saveKey = (k) => { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY) } catch { /* this visit only */ } }
const fmt = (v) => (Number.isFinite(v) ? v.toLocaleString('en-NG') : '—')
const short = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
const weekday = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-NG', { weekday: 'short' })

export default function LagosStats() {
  const [key, setKey] = useState(readKey)
  const [range, setRange] = useState(14)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [at, setAt] = useState(null)
  const [, tick] = useState(0)

  const load = useCallback(async () => {
    if (!key) return
    try {
      const r = await fetch(`/api/lagos?stats=${range}`, { headers: { 'x-stats-key': key }, cache: 'no-store' })
      if (r.status === 404) { setError('That stats key isn’t right. Enter it again.'); saveKey(''); setKey(''); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setData(j.live || [])
      setError('')
      setAt(Date.now())
    } catch {
      setError('Couldn’t load the numbers. Retrying in a minute.')
    }
  }, [key, range])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    const s = setInterval(() => tick((n) => n + 1), 5000)
    return () => { clearInterval(t); clearInterval(s) }
  }, [load])

  if (!key) return <KeyGate error={error} onKey={(k) => { saveKey(k); setError(''); setKey(k) }} />

  const days = data ? timeline(data) : []
  return (
    <section aria-label="Lagos Life stats" className="st">
      <div className="adm-head">
        <h1>Lagos Life, day by day</h1>
        <div className="st-ctl">
          <div className="st-range" role="group" aria-label="Days shown">
            {[7, 14, 30].map((n) => <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n} days</button>)}
          </div>
          <span className="st-live"><i />{at ? `Updated ${Math.max(0, Math.round((Date.now() - at) / 1000))}s ago` : 'Loading…'}</span>
          <button className="adm-link" onClick={() => { saveKey(''); setKey(''); setData(null) }}>Forget key</button>
        </div>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {days.length > 0 && <Board days={days} />}
    </section>
  )
}

function KeyGate({ error, onKey }) {
  const [v, setV] = useState('')
  return (
    <section className="adm-card st-gate" aria-label="Stats key">
      <h1>Lagos Life stats</h1>
      <p>Enter the stats key (the <code>LAGOS_STATS_KEY</code> setting in Vercel). It stays on this device.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onKey(v.trim()) }}>
        <label htmlFor="st-key">Stats key</label>
        <input id="st-key" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="adm-btn" type="submit">Show the numbers</button>
      </form>
      {error && <p className="adm-error" role="alert">{error}</p>}
    </section>
  )
}

function Board({ days }) {
  const today = days.at(-1)
  const yday = days.at(-2)
  const notes = useMemo(() => headlines(days), [days])
  const part = dayProgress()
  const tiles = [
    { label: 'Players today', value: today.players, prev: yday?.players, pace: part, spark: days.map((d) => d.players) },
    { label: 'Matches today', value: today.started, prev: yday?.started, pace: part, spark: days.map((d) => d.started) },
    { label: 'Finished', value: finishRate(today.started, today.finished), unit: '%', prev: yday ? finishRate(yday.started, yday.finished) : null, spark: days.map((d) => finishRate(d.started, d.finished) || 0) },
    { label: 'Matches per player', value: today.players ? +(today.started / today.players).toFixed(1) : null, prev: yday?.players ? +(yday.started / yday.players).toFixed(1) : null, spark: days.map((d) => (d.players ? d.started / d.players : 0)) },
    { label: 'Leaderboard opens', value: today.board, prev: yday?.board, pace: part, spark: days.map((d) => d.board) },
    { label: 'Pitch drops (seen)', value: today.pitch.shown || today.pitch.lost, prev: yday ? (yday.pitch.shown || yday.pitch.lost) : null, pace: part, spark: days.map((d) => d.pitch.lost), lowerIsBetter: true },
  ]
  return (
    <>
      <p className="st-note">Today is {Math.round(part * 100)}% through (UTC), so its numbers are a part-day. Yesterday’s are complete.</p>
      <div className="st-tiles">{tiles.map((t) => <Tile key={t.label} {...t} />)}</div>
      {notes.length > 0 && (
        <ul className="st-notes" aria-label="What stands out">
          {notes.map((n, i) => <li key={i} data-tone={n.tone}>{n.text}</li>)}
        </ul>
      )}
      <div className="st-grid">
        <Card title="Players per day" wide><Line days={days} /></Card>
        <Card title="Matches per day, by mode" wide><Stacked days={days} /></Card>
        <Card title={`Today by mode (${short(today.day)})`}><ModeBars day={today} /></Card>
        <Card title={`When people quit (last ${days.length} days)`}><Quits days={days} /></Card>
        <Card title="Health: pitch drops and online errors" wide><Health days={days} /></Card>
      </div>
    </>
  )
}

function Tile({ label, value, unit = '', prev, spark, lowerIsBetter, pace = null }) {
  // A count from a part-day is compared at today's pace (what it would be by midnight)
  const paced = pace && pace > 0.05 && Number.isFinite(value) ? value / pace : value
  const c = change(paced, prev)
  const good = c === null ? null : lowerIsBetter ? c <= 0 : c >= 0
  return (
    <div className="st-tile">
      <span className="st-tile-l">{label}</span>
      <span className="st-tile-n">{value === null || value === undefined ? '—' : `${fmt(value)}${unit}`}</span>
      <span className="st-tile-c" data-good={good === null ? undefined : String(good)}>{c === null ? 'no comparison' : `${c >= 0 ? '▲' : '▼'} ${Math.abs(c)}% vs yesterday${pace ? ', at today’s pace' : ''}`}</span>
      <Spark values={spark} />
    </div>
  )
}

function Spark({ values }) {
  const w = 120, h = 28, max = Math.max(1, ...values)
  const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * w : w / 2, h - 2 - (v / max) * (h - 6)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts.at(-1)
  return (
    <svg className="st-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="var(--st-spark-fill)" />
      <path d={d} fill="none" stroke="var(--gold)" strokeWidth="1.6" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.6" fill="var(--gold)" />}
    </svg>
  )
}

const Card = ({ title, wide, children }) => <div className={`adm-card st-card${wide ? ' st-wide' : ''}`}><h2>{title}</h2>{children}</div>

/* Shared chart frame: x across the days, y from 0 to a nice max */
function niceMax(v) { if (v <= 5) return 5; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p }
function Axes({ W, H, P, max, days, step = 1 }) {
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f))
  const xs = (i) => P.l + (days.length > 1 ? (i / (days.length - 1)) : 0.5) * (W - P.l - P.r)
  return (
    <g className="st-axes">
      {ticks.map((t) => { const y = H - P.b - (t / max) * (H - P.t - P.b); return <g key={t}><line x1={P.l} x2={W - P.r} y1={y} y2={y} /><text x={P.l - 6} y={y + 4} textAnchor="end">{t}</text></g> })}
      {days.map((d, i) => (i % step === 0 || i === days.length - 1) && <text key={d.day} x={xs(i)} y={H - 6} textAnchor="middle">{days.length <= 7 ? weekday(d.day) : short(d.day)}</text>)}
    </g>
  )
}

function Line({ days }) {
  const W = 760, H = 230, P = { l: 62, r: 36, t: 18, b: 26 }
  const max = niceMax(Math.max(...days.map((d) => d.players)))
  const x = (i) => P.l + (days.length > 1 ? i / (days.length - 1) : 0.5) * (W - P.l - P.r)
  const y = (v) => H - P.b - (v / max) * (H - P.t - P.b)
  const pts = days.map((d, i) => [x(i), y(d.players)])
  const solid = pts.slice(0, -1), lastSeg = pts.slice(-2)
  const path = (ps) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const step = Math.ceil(days.length / 8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="st-chart" role="img" aria-label={`Players per day: ${days.map((d) => `${short(d.day)} ${d.players}`).join(', ')}`}>
      <Axes W={W} H={H} P={P} max={max} days={days} step={step} />
      <path d={`${path(pts)} L${pts.at(-1)[0]} ${H - P.b} L${pts[0][0]} ${H - P.b} Z`} fill="var(--st-area)" />
      {solid.length > 1 && <path d={path(solid)} fill="none" stroke="var(--gold)" strokeWidth="2.4" />}
      {lastSeg.length === 2 && <path d={path(lastSeg)} fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeDasharray="5 5" />}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? 'var(--bg)' : 'var(--gold)'} stroke="var(--gold)" strokeWidth="2"><title>{`${short(days[i].day)}: ${days[i].players} players`}</title></circle>)}
      <text x={pts.at(-1)[0] - 4} y={Math.max(P.t + 12, pts.at(-1)[1] - 16)} textAnchor="end" className="st-endlabel">{days.at(-1).players} so far</text>
    </svg>
  )
}

function Stacked({ days }) {
  const W = 760, H = 250, P = { l: 62, r: 36, t: 14, b: 26 }
  const max = niceMax(Math.max(1, ...days.map((d) => d.started)))
  const bw = Math.min(34, ((W - P.l - P.r) / days.length) * 0.7)
  const x = (i) => P.l + (days.length > 1 ? i / (days.length - 1) : 0.5) * (W - P.l - P.r - bw) + bw / 2
  const y = (v) => (v / max) * (H - P.t - P.b)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="st-chart" role="img" aria-label="Matches started per day, by mode">
        <Axes W={W} H={H} P={{ ...P, l: P.l, r: P.r }} max={max} days={days} step={Math.ceil(days.length / 8)} />
        {days.map((d, i) => {
          let acc = 0
          return (
            <g key={d.day} opacity={i === days.length - 1 ? 0.7 : 1}>
              {MODES.map((m) => {
                const v = d.byMode[m.key].started
                if (!v) return null
                const h = y(v); const top = H - P.b - acc - h; acc += h
                return <rect key={m.key} x={x(i) - bw / 2} y={top} width={bw} height={Math.max(1, h - 1)} fill={m.color}><title>{`${short(d.day)} · ${m.label}: ${v}`}</title></rect>
              })}
              <text x={x(i)} y={H - P.b - acc - 5} textAnchor="middle" className="st-barlabel">{d.started || ''}</text>
            </g>
          )
        })}
      </svg>
      <Legend />
    </>
  )
}

const Legend = () => <div className="st-legend">{MODES.map((m) => <span key={m.key}><i style={{ background: m.color }} />{m.label}</span>)}</div>

function ModeBars({ day }) {
  const rows = MODES.map((m) => ({ ...m, ...day.byMode[m.key] })).filter((r) => r.started || r.finished)
  const max = Math.max(1, ...rows.map((r) => r.started))
  if (!rows.length) return <p className="st-empty">No matches yet today.</p>
  return (
    <ul className="st-modes">
      {rows.map((r) => {
        const rate = finishRate(r.started, r.finished)
        return (
          <li key={r.key}>
            <span className="st-mode-n"><i style={{ background: r.color }} />{r.label}</span>
            <span className="st-mode-bar" aria-hidden="true">
              <b style={{ width: `${(r.started / max) * 100}%`, background: r.color, opacity: 0.35 }} />
              <b style={{ width: `${(Math.min(r.finished, r.started) / max) * 100}%`, background: r.color }} />
            </span>
            <span className="st-mode-v">{r.started} <small>started</small></span>
            <span className="st-mode-r" data-low={rate !== null && rate < 40 ? 'true' : undefined}>{rate === null ? '—' : `${rate}%`}</span>
          </li>
        )
      })}
      <li className="st-mode-key"><span /><span>light = started · solid = finished</span><span /><span>finished</span></li>
    </ul>
  )
}

function Quits({ days }) {
  const buckets = [['0m', '< 1 min'], ['1m', '1–3 min'], ['3m', '3–6 min'], ['6m', '6+ min']]
  const rows = MODES.map((m) => ({ ...m, q: buckets.map(([b]) => days.reduce((s, d) => s + d.byMode[m.key].quits[b], 0)) })).filter((r) => r.q.some(Boolean))
  const max = Math.max(1, ...rows.flatMap((r) => r.q))
  if (!rows.length) return <p className="st-empty">No quits from the pause menu yet. Closing the app mid-match isn’t counted as a quit.</p>
  return (
    <>
      <table className="st-heat">
        <thead><tr><th />{buckets.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}><th>{r.label}</th>{r.q.map((v, i) => <td key={i} style={{ background: v ? `color-mix(in srgb, var(--bad) ${Math.round(15 + (v / max) * 70)}%, transparent)` : undefined }}>{v || ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <p className="st-empty">How long a match lasted before someone left it from the pause menu.</p>
    </>
  )
}

function Health({ days }) {
  const W = 760, H = 150, P = { l: 62, r: 36, t: 12, b: 26 }
  const vals = days.map((d) => ({ shown: d.pitch.shown, other: d.pitch.lost - d.pitch.shown, err: Object.values(d.errors).reduce((s, v) => s + v, 0) }))
  const max = niceMax(Math.max(1, ...vals.map((v) => v.shown + v.other + v.err)))
  const bw = Math.min(26, ((W - P.l - P.r) / days.length) * 0.6)
  const x = (i) => P.l + (days.length > 1 ? i / (days.length - 1) : 0.5) * (W - P.l - P.r - bw) + bw / 2
  const hh = (v) => (v / max) * (H - P.t - P.b)
  const parts = [['shown', 'var(--bad)', 'Pitch drop, seen'], ['other', '#ff9aa6', 'Pitch drop, in the background or unknown'], ['err', '#4fb3ff', 'Online error']]
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="st-chart" role="img" aria-label="Pitch drops and online errors per day">
        <Axes W={W} H={H} P={P} max={max} days={days} step={Math.ceil(days.length / 8)} />
        {vals.map((v, i) => {
          let acc = 0
          return <g key={i}>{parts.map(([k, c, l]) => { const h = hh(v[k]); if (!h) return null; const top = H - P.b - acc - h; acc += h; return <rect key={k} x={x(i) - bw / 2} y={top} width={bw} height={h} fill={c}><title>{`${short(days[i].day)} · ${l}: ${v[k]}`}</title></rect> })}</g>
        })}
      </svg>
      <div className="st-legend">{parts.map(([k, c, l]) => <span key={k}><i style={{ background: c }} />{l}</span>)}</div>
    </>
  )
}
