/**
 * HQ: Lagos Life, live. Reads the usage counts from /api/lagos?stats=N
 * (needs the stats key, kept on this device only), refreshes every minute,
 * and draws them with Chart.js: doughnuts and pies for the mix, smooth lines
 * and areas over time, bars for finish rates and health.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Chart, ArcElement, LineElement, BarElement, PointElement, LineController, BarController, DoughnutController,
  PieController, CategoryScale, LinearScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { timeline, MODES, change, finishRate, headlines, dayProgress, rangeByMode, closedByStage, STAGES, STAGE_LABELS } from './statsView'

Chart.register(ArcElement, LineElement, BarElement, PointElement, LineController, BarController, DoughnutController,
  PieController, CategoryScale, LinearScale, Filler, Tooltip, Legend)
Chart.defaults.color = '#a8b2cc'
Chart.defaults.font.family = "'Inter', system-ui, sans-serif"
Chart.defaults.borderColor = 'rgba(255,255,255,0.07)'
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.legend.labels.boxWidth = 8
Chart.defaults.plugins.tooltip.backgroundColor = '#0b1020'
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,200,61,0.5)'
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 10

const KEY = 'capball:hq-stats-key'
const REFRESH_MS = 60_000
const readKey = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const saveKey = (k) => { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY) } catch { /* this visit only */ } }
const fmt = (v) => (Number.isFinite(v) ? v.toLocaleString('en-NG') : '—')
const label = (day, n) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-NG', n <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' })
const GOLD = '#ffc83d'

/** A chart that stays mounted and updates in place when its data changes. */
function ChartBox({ type, data, options, plugins, height = 260 }) {
  const ref = useRef(null)
  const chart = useRef(null)
  useEffect(() => {
    chart.current = new Chart(ref.current, { type, data, options: { responsive: true, maintainAspectRatio: false, ...options }, plugins })
    return () => chart.current?.destroy()
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps
  // Redraw only when the numbers or labels actually change, and without the grow-in animation
  const sig = JSON.stringify([data.labels, data.datasets.map((d) => d.data)])
  const seen = useRef(sig)
  useEffect(() => {
    const c = chart.current
    if (!c || seen.current === sig) return
    seen.current = sig
    c.data = data
    c.options = { responsive: true, maintainAspectRatio: false, ...options }
    c.update('none')
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="sd-chart" style={{ height }}><canvas ref={ref} /></div>
}

/** Writes a total in the middle of a doughnut. */
const centre = (top, bottom) => ({
  id: 'centre',
  afterDraw(c) {
    const { ctx, chartArea: a } = c
    if (!a) return
    const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2
    ctx.save()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#eef2fa'
    ctx.font = "800 30px 'Barlow Condensed', sans-serif"
    ctx.fillText(top, x, y + 4)
    ctx.fillStyle = '#8590ad'
    ctx.font = "600 11px 'Inter', sans-serif"
    ctx.fillText(bottom, x, y + 22)
    ctx.restore()
  },
})

export default function LagosStats() {
  const [key, setKey] = useState(readKey)
  const [range, setRange] = useState(14)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [at, setAt] = useState(null)

  const load = useCallback(async () => {
    if (!key) return
    try {
      const r = await fetch(`/api/lagos?stats=${range}`, { headers: { 'x-stats-key': key }, cache: 'no-store' })
      if (r.status === 404) { setError('That stats key isn’t right. Enter it again.'); saveKey(''); setKey(''); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      const next = j.live || []
      setData((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      setError('')
      setAt(Date.now())
    } catch {
      setError('Couldn’t load the numbers. Retrying in a minute.')
    }
  }, [key, range])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  if (!key) return <KeyGate error={error} onKey={(k) => { saveKey(k); setError(''); setKey(k) }} />
  const days = data ? timeline(data) : []
  return (
    <section aria-label="Lagos Life stats" className="sd">
      <header className="sd-hero">
        <div>
          <div className="sd-kicker"><span className="sd-dot" />Live from Lagos Life</div>
          <h1>Counterball pulse</h1>
          <p>{at ? <Since at={at} /> : 'Loading the numbers…'}</p>
        </div>
        <div className="sd-hero-ctl">
          <div className="sd-pills" role="group" aria-label="Days shown">
            {[7, 14, 30].map((n) => <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n}d</button>)}
          </div>
          <button className="sd-ghost" onClick={() => { saveKey(''); setKey(''); setData(null) }}>Forget key</button>
        </div>
      </header>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {days.length > 0 && <Dashboard days={days} />}
    </section>
  )
}

/** "Updated 12s ago": ticks on its own, so nothing else on the page redraws. */
function Since({ at }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t) }, [])
  const secs = Math.max(0, Math.round((now - at) / 1000))
  return <>Updated {secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m`} ago · refreshes every minute</>
}

function KeyGate({ error, onKey }) {
  const [v, setV] = useState('')
  return (
    <section className="sd-gate" aria-label="Stats key">
      <div className="sd-kicker"><span className="sd-dot" />Lagos Life</div>
      <h1>Counterball pulse</h1>
      <p>Enter the stats key (the <code>LAGOS_STATS_KEY</code> setting in Vercel). It stays on this device.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onKey(v.trim()) }}>
        <label htmlFor="st-key" className="sd-sr">Stats key</label>
        <input id="st-key" type="password" placeholder="Stats key" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} />
        <button type="submit">Show the numbers</button>
      </form>
      {error && <p className="adm-error" role="alert">{error}</p>}
    </section>
  )
}

function Dashboard({ days }) {
  const today = days.at(-1)
  const yday = days.at(-2)
  const part = dayProgress()
  const notes = useMemo(() => headlines(days), [days])
  const totals = useMemo(() => rangeByMode(days), [days])
  const labels = days.map((d) => label(d.day, days.length))
  const active = MODES.filter((m) => totals[m.key].started > 0)
  const paced = (v) => (part > 0.05 ? v / part : v)
  const rate = finishRate(today.started, today.finished)
  const back = yday?.players && today.returning !== null ? Math.round((today.returning / yday.players) * 100) : null

  // ── KPI cards ──
  const kpis = [
    { k: 'Players today', v: fmt(today.players), c: change(paced(today.players), yday?.players), sub: yday ? `${fmt(yday.players)} yesterday` : '', series: days.map((d) => d.players) },
    { k: 'Matches today', v: fmt(today.started), c: change(paced(today.started), yday?.started), sub: today.players ? `${(today.started / today.players).toFixed(1)} per player` : '', series: days.map((d) => d.started) },
    { k: 'Matches finished', v: rate === null ? '—' : `${rate}%`, c: yday ? change(rate, finishRate(yday.started, yday.finished)) : null, sub: `${fmt(today.finished)} of ${fmt(today.started)}`, gauge: rate },
    { k: 'Came back from yesterday', v: back === null ? '—' : `${back}%`, c: null, sub: back === null ? 'counting starts once the update is live' : `${fmt(today.returning)} of yesterday’s ${fmt(yday.players)}`, series: days.map((d) => d.returning ?? 0) },
  ]

  // ── Charts ──
  const hasReturn = days.some((d) => d.returning !== null)
  const playersChart = {
    labels,
    datasets: hasReturn ? [
      { label: 'Played yesterday too', data: days.map((d) => d.returning), backgroundColor: 'rgba(52,210,123,0.55)', borderColor: '#34d27b', fill: true, tension: 0.4, pointRadius: 0, stack: 'p' },
      { label: 'New this week', data: days.map((d) => d.newPlayers), backgroundColor: 'rgba(79,179,255,0.45)', borderColor: '#4fb3ff', fill: '-1', tension: 0.4, pointRadius: 0, stack: 'p' },
      { label: 'Back after a break', data: days.map((d) => (d.returning === null ? d.players : Math.max(0, d.players - d.returning - (d.newPlayers ?? 0)))), backgroundColor: 'rgba(255,200,61,0.35)', borderColor: GOLD, fill: '-1', tension: 0.4, pointRadius: 0, stack: 'p' },
    ] : [
      { label: 'Players', data: days.map((d) => d.players), borderColor: GOLD, borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: GOLD,
        backgroundColor: (ctx) => { const { chart } = ctx; const a = chart.chartArea; if (!a) return 'rgba(255,200,61,0.2)'; const g = chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, 'rgba(255,200,61,0.45)'); g.addColorStop(1, 'rgba(255,200,61,0)'); return g },
        segment: { borderDash: (c) => (c.p1DataIndex === days.length - 1 ? [6, 6] : undefined) } },
    ],
  }
  const lineOpts = (legend, stacked = false) => ({ interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: legend, position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, stacked } } })

  const modeLines = {
    labels,
    datasets: active.map((m) => ({ label: m.label, data: days.map((d) => d.byMode[m.key].started), borderColor: m.color, backgroundColor: m.color, tension: 0.4, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6 })),
  }
  const todayMix = MODES.filter((m) => today.byMode[m.key].started)
  const doughnut = (list, getter) => ({ labels: list.map((m) => m.label), datasets: [{ data: list.map(getter), backgroundColor: list.map((m) => m.color), borderColor: '#0d1325', borderWidth: 3, hoverOffset: 10 }] })
  const doughnutOpts = { cutout: '68%', plugins: { legend: { position: 'bottom' } } }
  const totalStarted = active.reduce((s, m) => s + totals[m.key].started, 0)
  const totalFinished = active.reduce((s, m) => s + totals[m.key].finished, 0)
  const totalQuits = active.reduce((s, m) => s + totals[m.key].quits, 0)
  const endings = { labels: ['Finished', 'Left from the menu', 'Closed the app'], datasets: [{ data: [totalFinished, totalQuits, Math.max(0, totalStarted - totalFinished - totalQuits)], backgroundColor: ['#34d27b', '#ffc83d', '#ff5468'], borderColor: '#0d1325', borderWidth: 3, hoverOffset: 10 }] }
  const rates = { labels: active.map((m) => m.label), datasets: [{ label: 'Finished', data: active.map((m) => finishRate(totals[m.key].started, totals[m.key].finished) ?? 0), backgroundColor: active.map((m) => m.color), borderRadius: 8, barThickness: 18 }] }
  const quitBuckets = ['0m', '1m', '3m', '6m']
  const quitTotals = quitBuckets.map((b) => days.reduce((s, d) => s + MODES.reduce((t, m) => t + d.byMode[m.key].quits[b], 0), 0))
  const quits = { labels: ['Under 1 min', '1–3 min', '3–6 min', '6+ min'], datasets: [{ data: quitTotals, backgroundColor: ['#ff5468', '#ff8a4c', '#ffc83d', '#4fb3ff'], borderColor: '#0d1325', borderWidth: 3, hoverOffset: 10 }] }
  const closed = closedByStage(days)
  const hasClosed = closed.some((n) => n > 0)
  const closedChart = { labels: STAGES.map((k) => STAGE_LABELS[k]), datasets: [{ label: 'Closed', data: closed, backgroundColor: ['#ff5468', '#ff8a4c', '#ffc83d', '#34d27b', '#4fb3ff', '#a78bfa'], borderRadius: 8, barThickness: 22 }] }
  const health = {
    labels,
    datasets: [
      { label: 'Pitch drop, seen', data: days.map((d) => d.pitch.shown), backgroundColor: '#ff5468', borderRadius: 4, stack: 'h' },
      { label: 'Pitch drop, background', data: days.map((d) => d.pitch.lost - d.pitch.shown), backgroundColor: 'rgba(255,84,104,0.4)', borderRadius: 4, stack: 'h' },
      { label: 'Pitch froze', data: days.map((d) => d.pitch.stall), backgroundColor: '#ff8a4c', borderRadius: 4, stack: 'h' },
      { label: 'Online errors', data: days.map((d) => Object.values(d.errors).reduce((s, v) => s + v, 0)), backgroundColor: '#4fb3ff', borderRadius: 4, stack: 'h' },
    ],
  }

  return (
    <>
      <div className="sd-kpis">{kpis.map((x) => <Kpi key={x.k} {...x} />)}</div>
      {notes.length > 0 && (
        <ul className="sd-notes" aria-label="What stands out">
          {notes.map((n, i) => <li key={i} data-tone={n.tone}>{n.text}</li>)}
        </ul>
      )}
      <div className="sd-grid">
        <Panel title="Players per day" sub={hasReturn ? 'Who came back, who’s new' : `Today is ${Math.round(part * 100)}% through, so it’s dashed`} span={2}>
          <ChartBox type="line" data={playersChart} options={lineOpts(hasReturn, hasReturn)} height={280} />
        </Panel>
        <Panel title="Today’s matches" sub="By mode">
          {todayMix.length ? <ChartBox type="doughnut" data={doughnut(todayMix, (m) => today.byMode[m.key].started)} options={doughnutOpts} plugins={[centre(fmt(today.started), 'matches today')]} height={280} /> : <p className="sd-empty">No matches yet today.</p>}
        </Panel>
        <Panel title="Matches per day, by mode" sub="Started" span={2}>
          <ChartBox type="line" data={modeLines} options={lineOpts(true, false)} height={280} />
        </Panel>
        <Panel title={`The mix, last ${days.length} days`} sub="Share of all matches">
          <ChartBox type="doughnut" data={doughnut(active, (m) => totals[m.key].started)} options={doughnutOpts} plugins={[centre(fmt(totalStarted), 'matches')]} height={280} />
        </Panel>
        <Panel title="How matches ended" sub={`Last ${days.length} days`}>
          <ChartBox type="pie" data={endings} options={{ plugins: { legend: { position: 'bottom' } } }} height={260} />
        </Panel>
        <Panel title="Finish rate by mode" sub="Share of started matches finished">
          <ChartBox type="bar" data={rates} options={{ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw}% finished` } } }, scales: { x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } }, y: { grid: { display: false } } } }} height={260} />
        </Panel>
        <Panel title="When people quit" sub="Time played before leaving from the menu">
          <ChartBox type="doughnut" data={quits} options={doughnutOpts} plugins={[centre(fmt(quitTotals.reduce((a, b) => a + b, 0)), 'quit')]} height={260} />
        </Panel>
        <Panel title="Where matches get closed" sub={`Closed the app mid-match and never came back, last ${days.length} days`} span={3}>
          {hasClosed
            ? <ChartBox type="bar" data={closedChart} options={{ plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }} height={220} />
            : <p className="sd-empty">Counting starts once the update that tracks this is live.</p>}
        </Panel>
        <Panel title="Health" sub="Pitch drops, freezes and online errors" span={3}>
          <ChartBox type="bar" data={health} options={{ plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true } } }} height={200} />
        </Panel>
      </div>
    </>
  )
}

function Panel({ title, sub, span = 1, children }) {
  return (
    <div className="sd-panel" data-span={span}>
      <div className="sd-panel-h"><h2>{title}</h2>{sub && <span>{sub}</span>}</div>
      {children}
    </div>
  )
}

function Kpi({ k, v, c, sub, series, gauge }) {
  return (
    <div className="sd-kpi">
      <div className="sd-kpi-top">
        <span className="sd-kpi-k">{k}</span>
        {c !== null && c !== undefined && <span className="sd-chip" data-up={c >= 0 ? 'true' : 'false'}>{c >= 0 ? '▲' : '▼'} {Math.abs(c)}%</span>}
      </div>
      <div className="sd-kpi-v">{v}</div>
      <div className="sd-kpi-sub">{sub}</div>
      {gauge !== undefined ? (
        <ChartBox type="doughnut" height={64}
          data={{ datasets: [{ data: [gauge ?? 0, 100 - (gauge ?? 0)], backgroundColor: [gauge >= 60 ? '#34d27b' : gauge >= 40 ? GOLD : '#ff5468', 'rgba(255,255,255,0.08)'], borderWidth: 0 }] }}
          options={{ rotation: -90, circumference: 180, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }} />
      ) : series && (
        <ChartBox type="line" height={64}
          data={{ labels: series.map((_, i) => i), datasets: [{ data: series, borderColor: GOLD, borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true, backgroundColor: 'rgba(255,200,61,0.12)' }] }}
          options={{ plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }} />
      )}
    </div>
  )
}
