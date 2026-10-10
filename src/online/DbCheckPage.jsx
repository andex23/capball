import { useEffect, useState } from 'react'
import { runDbCheck } from './dbCheck'

/** The #dbcheck page: runs the database check and lists what passed. */
export default function DbCheckPage() {
  const [rows, setRows] = useState([])
  const [done, setDone] = useState(null)
  useEffect(() => {
    let live = true
    runDbCheck((row) => { if (live) setRows((r) => [...r, row]) }).then((ok) => { if (live) setDone(ok) })
    return () => { live = false }
  }, [])
  return (
    <div className="screen" style={{ padding: 'calc(var(--safe-top) + 20px) var(--gutter-r) 40px var(--gutter-l)' }}>
      <div className="card card-pad" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="eyebrow">COUNTER BALL · online tournaments</div>
        <h1 className="display" style={{ fontSize: 38 }}>Database check</h1>
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <b style={{ color: r.pass ? 'var(--good)' : 'var(--bad)', minWidth: 18 }}>{r.pass ? '✓' : '✗'}</b>
              <span><b>{r.name}</b>{r.detail ? <span className="muted"> — {r.detail}</span> : null}</span>
            </li>
          ))}
        </ol>
        {done === null && <p className="muted">Running…</p>}
        {done === true && <p style={{ color: 'var(--good)', fontWeight: 700 }}>All good — the game can use your database.</p>}
        {done === false && <p style={{ color: 'var(--bad)', fontWeight: 700 }}>Something failed — send a screenshot of this page.</p>}
      </div>
    </div>
  )
}
