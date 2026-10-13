import { useCallback, useEffect, useMemo, useState } from 'react'
import { call, callAds, callHelp, login, logout, setup, status, messageFor, readSession, saveSession, summariseSave } from './adminApi'
import { DIVISIONS } from '../game/divisions'
import { DEFAULT_ADS, AD_MAX, ADS_MAX, cleanAds } from '../game/arenaAds'

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'help', label: 'Help requests' },
  { key: 'players', label: 'Players' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'board', label: 'Leaderboard' },
  { key: 'matches', label: 'Play anytime' },
  { key: 'ads', label: 'Arena boards' },
  { key: 'admins', label: 'Admins' },
]

const n = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-NG') : '—')
const when = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  if (mins < 60 * 24 * 14) { const d = Math.round(mins / 1440); return d === 1 ? 'yesterday' : `${d} days ago` }
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}
const kb = (b) => (b > 1024 ? `${Math.round(b / 1024)} KB` : `${b || 0} B`)

export default function AdminApp() {
  const [session, setSession] = useState(readSession)
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const [section, setSection] = useState(() => (SECTIONS.some((s) => `#${s.key}` === location.hash) ? location.hash.slice(1) : 'overview'))

  // Check the saved session is still good
  useEffect(() => {
    if (!session) return
    let live = true
    call(session.token, 'me')
      .then((r) => { if (live) { setMe(r.email); setError('') } })
      .catch((e) => {
        if (!live) return
        setMe(null)
        setError(e.code === 'signed-out' ? '' : messageFor(e))
        saveSession(null)
        setSession(null)
      })
    return () => { live = false }
  }, [session])

  const go = (key) => { setSection(key); history.replaceState(null, '', `#${key}`) }
  const signOut = async () => {
    if (session) await logout(session.token)
    saveSession(null)
    setSession(null)
    setMe(null)
  }

  if (!session || !me) {
    return <SignIn error={error} checking={!!session} onSignedIn={(s) => { saveSession(s); setError(''); setSession(s) }} />
  }

  const api = (action, data) => call(session.token, action, data)
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-brand"><span className="adm-mark" aria-hidden="true" />Counterball <span>admin</span></div>
        <div className="adm-who">
          <span>{me}</span>
          <button className="adm-link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <nav className="adm-nav" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <button key={s.key} aria-current={section === s.key ? 'page' : undefined} onClick={() => go(s.key)}>
            {s.label}{s.key === 'help' && <HelpBadge token={session.token} section={section} />}
          </button>
        ))}
      </nav>
      <main className="adm-main">
        {section === 'overview' && <Overview api={api} go={go} />}
        {section === 'help' && <HelpRequests token={session.token} api={api} />}
        {section === 'players' && <Players api={api} />}
        {section === 'tournaments' && <Tournaments api={api} />}
        {section === 'board' && <Board api={api} />}
        {section === 'matches' && <Matches api={api} />}
        {section === 'ads' && <ArenaBoards token={session.token} />}
        {section === 'admins' && <Admins api={api} me={me} />}
      </main>
    </div>
  )
}

/** Sign in, or, the very first time, create the admin login. */
function SignIn({ error, checking, onSignedIn }) {
  const [mode, setMode] = useState(null) // 'setup' | 'login' | 'missing'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    status().then((r) => setMode(r?.setup ? 'setup' : 'login'), (e) => { setMode('missing'); setErr(messageFor(e)) })
  }, [])
  const first = mode === 'setup'
  const submit = async (e) => {
    e.preventDefault()
    if (first && password !== again) { setErr('The two passwords don’t match.'); return }
    setBusy(true)
    setErr('')
    try {
      const r = first ? await setup(email.trim(), password) : await login(email.trim(), password)
      onSignedIn({ token: r.token, email: r.email })
    } catch (x) {
      if (x.code === 'setup-done') setMode('login')
      setErr(messageFor(x))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="adm-signin">
      <form className="adm-card adm-signin-card" onSubmit={submit}>
        <div className="adm-brand"><span className="adm-mark" aria-hidden="true" />Counterball <span>admin</span></div>
        {mode === null && <p className="adm-muted">{checking ? 'Checking your session…' : 'Loading…'}</p>}
        {first && <p className="adm-muted">Create your admin login. This only works once: after this, the page asks for this email and password.</p>}
        {mode === 'login' && <p className="adm-muted">Sign in with your admin email and password.</p>}
        {(mode === 'setup' || mode === 'login') && (
          <>
            <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={first ? 'new-password' : 'current-password'} minLength={first ? 10 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {first && <label>Password again<input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>}
            {first && <small className="adm-muted">At least 10 characters.</small>}
          </>
        )}
        {(err || error) && <p className="adm-error" role="alert">{err || error}</p>}
        {mode === 'missing' && <button type="button" className="adm-btn" onClick={() => location.reload()}>Reload</button>}
        {(mode === 'setup' || mode === 'login') && (
          <button className="adm-btn adm-btn-gold" disabled={busy}>{busy ? (first ? 'Creating…' : 'Signing in…') : (first ? 'Create login' : 'Sign in')}</button>
        )}
      </form>
    </div>
  )
}

/** Load something for a section, with loading and error states. */
function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: '', loading: true })
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    return fn().then((data) => setState({ data, error: '', loading: false }), (e) => setState({ data: null, error: messageFor(e), loading: false }))
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

function Status({ loading, error, reload }) {
  if (error) return <div className="adm-error" role="alert">{error} <button className="adm-link" onClick={reload}>Try again</button></div>
  if (loading) return <p className="adm-muted">Loading…</p>
  return null
}

/* ── Overview ── */

function Overview({ api, go }) {
  const { data: o, error, loading, reload } = useLoad(() => api('overview'), [])
  if (!o) return <Status loading={loading} error={error} reload={reload} />
  const max = Math.max(1, ...o.signups.map((d) => d.n))
  const tiles = [
    ['Players', o.players, `${n(o.new7d)} joined this week`, 'players'],
    ['Joined today', o.new24h, null, 'players'],
    ['Played today', o.active24h, `${n(o.active7d)} this week`, 'players'],
    ['Saves on the server', o.saves, `${n(o.saved24h)} updated today`, 'players'],
    ['Open tournaments', o.openTournaments, `${n(o.tournaments)} made in all`, 'tournaments'],
    ['Results this week', o.results7d, null, 'tournaments'],
    ['On this week’s board', o.boardWeek, o.week, 'board'],
  ]
  if (o.anytime != null) tiles.push(['Play anytime matches', o.anytime, `${n(o.anytimeActive)} going, ${n(o.anytimeWaiting)} waiting`, 'matches'])
  if (o.lagosPurchases != null) tiles.push(['Lagos Life purchases', o.lagosPurchases, `${n(o.lagosBuyers)} buyers · ${n(o.lagosTestPurchases)} test`, null])
  return (
    <section aria-label="Overview">
      <div className="adm-head"><h1>Overview</h1><button className="adm-btn" onClick={reload}>Refresh</button></div>
      <div className="adm-tiles">
        {tiles.map(([label, value, sub, to]) => (
          <button key={label} className="adm-tile" onClick={to ? () => go(to) : undefined} disabled={!to}>
            <span className="adm-tile-n">{n(value)}</span>
            <span className="adm-tile-l">{label}</span>
            {sub && <small>{sub}</small>}
          </button>
        ))}
      </div>
      <div className="adm-card">
        <h2>New players, last 14 days</h2>
        <div className="adm-bars" role="img" aria-label={`New players per day: ${o.signups.map((d) => d.n).join(', ')}`}>
          {o.signups.map((d) => (
            <div key={d.day} className="adm-bar" title={`${d.day}: ${d.n}`}>
              <span className="adm-bar-n">{d.n || ''}</span>
              <span className="adm-bar-fill" style={{ height: `${(d.n / max) * 100}%` }} />
              <span className="adm-bar-d">{new Date(d.day).toLocaleDateString('en-NG', { day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Players ── */

function Players({ api }) {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState('active')
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(null)
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setOffset(0) }, 300); return () => clearTimeout(t) }, [q])
  const { data, error, loading, reload } = useLoad(() => api('players', { q: term, sort, offset, limit: 50 }), [term, sort, offset])
  return (
    <section aria-label="Players">
      <div className="adm-head">
        <h1>Players {data && <span className="adm-count">{n(data.total)}</span>}</h1>
        <div className="adm-tools">
          <input type="search" placeholder="Search usernames" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search usernames" />
          <select value={sort} onChange={(e) => { setSort(e.target.value); setOffset(0) }} aria-label="Sort players">
            <option value="active">Last played</option>
            <option value="new">Newest</option>
          </select>
        </div>
      </div>
      <Status loading={loading && !data} error={error} reload={reload} />
      {data && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Player</th><th>Joined</th><th>Last played</th><th>Phones</th><th>Save</th></tr></thead>
            <tbody>
              {data.rows.map((p) => (
                <tr key={p.id} onClick={() => setOpen(p.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(p.id) }}>
                  <td><b>{p.name}</b></td>
                  <td>{when(p.createdAt)}</td>
                  <td>{when(p.lastSeen)}</td>
                  <td>{p.sessions}</td>
                  <td>{p.savedAt ? `${kb(p.saveBytes)}, ${when(p.savedAt)}` : 'none'}</td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={5} className="adm-muted">No players match that.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 50 && (
        <div className="adm-pager">
          <button className="adm-btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
          <span>{offset + 1}–{Math.min(offset + 50, data.total)} of {n(data.total)}</span>
          <button className="adm-btn" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</button>
        </div>
      )}
      {open && <PlayerSheet api={api} id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </section>
  )
}

function PlayerSheet({ api, id, onClose, onChanged }) {
  const { data: p, error, loading, reload } = useLoad(() => api('player', { id }), [id])
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const s = useMemo(() => (p ? summariseSave(p.save) : null), [p])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const act = async (action, data, done) => {
    setBusy(true)
    setNote('')
    try {
      await api(action, { id, ...data })
      setNote(done)
      onChanged()
      if (action === 'delete-player') onClose()
      else reload()
    } catch (e) {
      setNote(messageFor(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="adm-sheet-back" onClick={onClose}>
      <aside className="adm-sheet" role="dialog" aria-modal="true" aria-label="Player" onClick={(e) => e.stopPropagation()}>
        <div className="adm-head"><h2>{p?.name || 'Player'}</h2><button className="adm-link" onClick={onClose}>Close</button></div>
        <Status loading={loading && !p} error={error} reload={reload} />
        {p && s && (
          <>
            <dl className="adm-facts">
              <dt>Joined</dt><dd>{new Date(p.createdAt).toLocaleString('en-NG')}</dd>
              <dt>Last save</dt><dd>{when(p.savedAt)}</dd>
              <dt>Signed in on</dt><dd>{p.sessions.length} phone{p.sessions.length === 1 ? '' : 's'}{p.sessions[0] ? `, last ${when(p.sessions[0].lastSeen)}` : ''}</dd>
              <dt>Matches</dt><dd>{s.played != null ? `${n(s.played)} played · ${n(s.won)} W ${n(s.drawn)} D ${n(s.lost)} L · ${n(s.goalsFor)} goals` : 'none saved'}</dd>
              <dt>Career</dt><dd>{s.club ? `${s.club}, ${DIVISIONS[s.level]?.name || 'division ?'}, season ${s.season}${s.coins != null ? `, ${n(s.coins)} in the bank` : ''}${s.sacked ? ' (sacked)' : ''}` : 'not started'}</dd>
              {s.hall > 0 && <><dt>Hall of Fame</dt><dd>{s.hall} finished career{s.hall === 1 ? '' : 's'}</dd></>}
              <dt>Leaderboard</dt><dd>{p.board.length ? p.board.map((b) => `${b.period === 'all' ? 'All time' : b.period}: ${b.won}/${b.played} won`).join(' · ') : 'not on it'}</dd>
            </dl>

            <h3>Reset password</h3>
            <p className="adm-muted">Sets a new password and signs them out everywhere. Tell them the new one yourself.</p>
            <div className="adm-row">
              <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (6+ characters)" aria-label="New password" />
              <button className="adm-btn" disabled={busy || pw.length < 6} onClick={() => act('reset-password', { password: pw }, 'Password changed.').then(() => setPw(''))}>Set password</button>
            </div>

            <h3>Sessions</h3>
            <div className="adm-row">
              <button className="adm-btn" disabled={busy || !p.sessions.length} onClick={() => act('sign-out', {}, 'Signed out everywhere.')}>Sign out on every phone</button>
            </div>

            <h3>Delete account</h3>
            <p className="adm-muted">Removes the account, its save and its leaderboard rows. This can’t be undone. Type <b>{p.name}</b> to confirm.</p>
            <div className="adm-row">
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type the username to confirm" />
              <button className="adm-btn adm-btn-bad" disabled={busy || confirm !== p.name} onClick={() => act('delete-player', {}, 'Deleted.')}>Delete</button>
            </div>
            {note && <p className="adm-note" role="status">{note}</p>}

            <details className="adm-raw">
              <summary>Saved data ({s.keys} parts)</summary>
              <pre>{JSON.stringify(Object.fromEntries(Object.entries(p.save?.items || {}).map(([k, v]) => [k, `${String(v).length} characters`])), null, 2)}</pre>
            </details>
          </>
        )}
      </aside>
    </div>
  )
}

/* ── Tournaments ── */

function Tournaments({ api }) {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [note, setNote] = useState('')
  const [sure, setSure] = useState(null)
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(t) }, [q])
  const { data, error, loading, reload } = useLoad(() => api('tournaments', { q: term }), [term])
  const act = async (action, t, done) => {
    try { await api(action, { id: t.id }); setNote(done); setSure(null); reload() } catch (e) { setNote(messageFor(e)) }
  }
  return (
    <section aria-label="Online tournaments">
      <div className="adm-head">
        <h1>Online tournaments {data && <span className="adm-count">{n(data.total)}</span>}</h1>
        <div className="adm-tools"><input type="search" placeholder="Code or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tournaments" /></div>
      </div>
      {note && <p className="adm-note" role="status">{note}</p>}
      <Status loading={loading && !data} error={error} reload={reload} />
      {data && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Code</th><th>Name</th><th>Teams</th><th>Results</th><th>Last change</th><th /></tr></thead>
            <tbody>
              {data.rows.map((t) => (
                <tr key={t.id}>
                  <td><code>{t.code}</code>{t.closed && <span className="adm-tag adm-tag-dim">closed</span>}</td>
                  <td>{t.name || '—'}</td>
                  <td>{t.claimed}/{t.teams} joined</td>
                  <td>{t.results}</td>
                  <td>{when(t.updatedAt)}</td>
                  <td className="adm-actions">
                    {!t.closed && <button className="adm-btn" onClick={() => act('close-tournament', t, `Closed ${t.code}.`)}>Close</button>}
                    {sure === t.id
                      ? <button className="adm-btn adm-btn-bad" onClick={() => act('delete-tournament', t, `Deleted ${t.code}.`)}>Delete for good</button>
                      : <button className="adm-btn" onClick={() => setSure(t.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={6} className="adm-muted">No tournaments.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ── Leaderboard ── */

function Board({ api }) {
  const [period, setPeriod] = useState('')
  const [note, setNote] = useState('')
  const { data, error, loading, reload } = useLoad(() => api('board', { period }), [period])
  const remove = async (r) => {
    try { await api('board-remove', { id: r.id, period: data.period }); setNote(`Took ${r.name} off the board.`); reload() } catch (e) { setNote(messageFor(e)) }
  }
  return (
    <section aria-label="Leaderboard">
      <div className="adm-head">
        <h1>Leaderboard</h1>
        <div className="adm-tools">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Which board">
            <option value="">This week{data?.week ? ` (${data.week})` : ''}</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>
      <p className="adm-muted">Numbers come from players’ phones. Take off anyone whose numbers look wrong.</p>
      {note && <p className="adm-note" role="status">{note}</p>}
      <Status loading={loading && !data} error={error} reload={reload} />
      {data && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>#</th><th>Player</th><th>Won</th><th>Played</th><th>Goals</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.rank}</td><td><b>{r.name}</b></td><td>{r.won}</td><td>{r.played}</td><td>{r.goals}</td><td>{when(r.updatedAt)}</td>
                  <td className="adm-actions"><button className="adm-btn" onClick={() => remove(r)}>Remove</button></td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={7} className="adm-muted">Nobody on this board yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ── Play anytime ── */

function Matches({ api }) {
  const { data, error, loading, reload } = useLoad(() => api('matches'), [])
  return (
    <section aria-label="Play anytime matches">
      <div className="adm-head"><h1>Play anytime</h1><button className="adm-btn" onClick={reload}>Refresh</button></div>
      <Status loading={loading && !data} error={error} reload={reload} />
      {data?.missing && <p className="adm-muted">Play anytime isn’t set up in this database.</p>}
      {data && !data.missing && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Code</th><th>Players</th><th>Score</th><th>Status</th><th>Turns</th><th>Last move</th></tr></thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.code}>
                  <td><code>{m.code}</code></td>
                  <td>{(m.players || []).join(' v ') || '—'}</td>
                  <td>{m.score ? `${m.score.team1 ?? 0}–${m.score.team2 ?? 0}` : '—'}</td>
                  <td><span className="adm-tag" data-tone={m.status}>{m.status}</span></td>
                  <td>{m.turns}</td>
                  <td>{when(m.updatedAt)}</td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={6} className="adm-muted">No matches yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ── Admins ── */

const ACTION_LABEL = {
  setup: 'created the first admin login', 'reset-password': 'reset a player’s password', 'sign-out': 'signed a player out',
  'delete-player': 'deleted a player', 'close-tournament': 'closed a tournament', 'delete-tournament': 'deleted a tournament',
  'board-remove': 'removed a leaderboard row', 'add-admin': 'added an admin', 'remove-admin': 'removed an admin',
  'change-password': 'changed their password',
}

function Admins({ api, me }) {
  const { data, error, loading, reload } = useLoad(() => api('admins'), [])
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [note, setNote] = useState('')
  const act = async (action, d, done, clear) => {
    setNote('')
    try { await api(action, d); setNote(done); clear?.(); reload() } catch (e) { setNote(messageFor(e)) }
  }
  return (
    <section aria-label="Admins">
      <div className="adm-head"><h1>Admins</h1></div>
      <Status loading={loading && !data} error={error} reload={reload} />
      {note && <p className="adm-note" role="status">{note}</p>}
      {data && (
        <>
          <div className="adm-card">
            <h2>Who can sign in</h2>
            <ul className="adm-list">
              {data.rows.map((a) => (
                <li key={a.id}>
                  <span><b>{a.email}</b>{a.email === me && <span className="adm-tag">you</span>} <small className="adm-muted">added {when(a.addedAt)}{a.lastSeen ? `, last in ${when(a.lastSeen)}` : ''}</small></span>
                  {a.email !== me && <button className="adm-btn" onClick={() => act('remove-admin', { id: a.id, email: a.email }, `${a.email} can no longer sign in.`)}>Remove</button>}
                </li>
              ))}
            </ul>
            <h2>Add an admin</h2>
            <form className="adm-row" onSubmit={(e) => { e.preventDefault(); act('add-admin', { email: email.trim(), password: pw }, `${email.trim()} can now sign in. Give them the password yourself.`, () => { setEmail(''); setPw('') }) }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" aria-label="Their email" required />
              <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="A password for them (10+)" aria-label="Their password" minLength={10} required />
              <button className="adm-btn adm-btn-gold">Add</button>
            </form>
          </div>
          <div className="adm-card">
            <h2>Change your password</h2>
            <form className="adm-row" onSubmit={(e) => { e.preventDefault(); act('change-password', { current: cur, password: next }, 'Password changed. Other devices are signed out.', () => { setCur(''); setNext('') }) }}>
              <input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" aria-label="Current password" required />
              <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (10+)" aria-label="New password" minLength={10} required />
              <button className="adm-btn">Change</button>
            </form>
          </div>
          <div className="adm-card">
            <h2>Recent admin actions</h2>
            <ul className="adm-log">
              {data.log.map((l, i) => (
                <li key={i}><b>{l.admin}</b> {ACTION_LABEL[l.action] || l.action}{l.detail?.email ? ` (${l.detail.email})` : ''} <small className="adm-muted">{when(l.at)}</small></li>
              ))}
              {!data.log.length && <li className="adm-muted">Nothing yet.</li>}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

/* ── Arena boards ── */

const toLines = (list) => list.join('\n')
const fromLines = (text) => text.split('\n').map((x) => x.replace(/\s+/g, ' ').trim().toUpperCase()).filter(Boolean)

/** One list of messages: a line each, checked as you type, with a preview strip. */
function AdList({ label, hint, value, onChange, tone }) {
  const lines = fromLines(value)
  const long = lines.filter((x) => x.length > AD_MAX)
  const tooMany = lines.length > ADS_MAX
  return (
    <div className="adm-card">
      <h2>{label}</h2>
      <p className="adm-muted">{hint} One message per line, up to {ADS_MAX} lines, {AD_MAX} characters each.</p>
      <textarea className="adm-ads-input" rows={ADS_MAX} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} spellCheck={false} />
      {long.length > 0 && <p className="adm-error">Too long: {long.join(', ')}</p>}
      {tooMany && <p className="adm-error">That’s {lines.length} lines; the most is {ADS_MAX}.</p>}
      <div className="adm-led" data-tone={tone} aria-label={`${label} preview`}>
        {(lines.length ? lines : ['—']).slice(0, ADS_MAX).map((x, i) => <span key={i}>{x.slice(0, AD_MAX)}</span>)}
      </div>
    </div>
  )
}

function ArenaBoards({ token }) {
  const { data, error, loading, reload } = useLoad(() => callAds(token, 'get'), [token])
  const [boards, setBoards] = useState('')
  const [ribbon, setRibbon] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!data) return
    const ads = cleanAds(data.ads)
    setBoards(toLines(ads.boards))
    setRibbon(toLines(ads.ribbon))
  }, [data])
  const b = fromLines(boards)
  const r = fromLines(ribbon)
  const valid = (l) => l.length >= 1 && l.length <= ADS_MAX && l.every((x) => x.length <= AD_MAX)
  const run = async (action, payload, done) => {
    setBusy(true)
    setNote('')
    try { await callAds(token, action, payload); setNote(done); reload() } catch (e) { setNote(messageFor(e)) } finally { setBusy(false) }
  }
  return (
    <section aria-label="Arena boards">
      <div className="adm-head">
        <h1>Arena boards</h1>
        <div className="adm-tools">
          <button className="adm-btn" disabled={busy || !data?.ads} onClick={() => run('reset', {}, 'Back to the built-in boards.')}>Use built-in text</button>
          <button className="adm-btn adm-btn-gold" disabled={busy || !valid(b) || !valid(r)} onClick={() => run('set', { boards: b, ribbon: r }, 'Saved. Players see it next time they open the game.')}>Save</button>
        </div>
      </div>
      <p className="adm-muted">The text on the screens in Cap Arena, the top-division stadium. {data?.updatedAt ? `Last changed ${when(data.updatedAt)}.` : 'Showing the built-in text.'}</p>
      {note && <p className="adm-note" role="status">{note}</p>}
      <Status loading={loading && !data} error={error} reload={reload} />
      {data && (
        <>
          <AdList label="Boards round the table" hint="The LED boards right next to the table, seen in every view." value={boards} onChange={setBoards} tone="gold" />
          <AdList label="Balcony ribbon" hint="The long screen that runs round the stands between the two tiers." value={ribbon} onChange={setRibbon} tone="white" />
          <p className="adm-muted">Built-in boards: {DEFAULT_ADS.boards.join(' · ')}</p>
        </>
      )}
    </section>
  )
}

/* ── Help requests (forgotten passwords) ── */

/** How many requests are waiting, next to the menu item. */
function HelpBadge({ token, section }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    callHelp(token, 'list').then((r) => { if (live) setN(r?.open || 0) }, () => {})
    return () => { live = false }
  }, [token, section])
  return n > 0 ? <span className="adm-badge" aria-label={`${n} waiting`}>{n}</span> : null
}

function HelpRequests({ token, api }) {
  const [status, setStatus] = useState('open')
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')
  const { data, error, loading, reload } = useLoad(() => callHelp(token, 'list', { status }), [token, status])
  const act = async (action, id, done) => {
    try { await callHelp(token, action, { id }); setNote(done); reload() } catch (e) { setNote(messageFor(e)) }
  }
  return (
    <section aria-label="Help requests">
      <div className="adm-head">
        <h1>Help requests {data && data.open > 0 && <span className="adm-count">{data.open} waiting</span>}</h1>
        <div className="adm-tools">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Which requests">
            <option value="open">Waiting</option>
            <option value="done">Done</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      <p className="adm-muted">Players who forgot their password and have no recovery code. Open the player, check the details they gave match (club, team name, when they joined), then reset their password and send it to them. They get a recovery code when they next sign in.</p>
      {note && <p className="adm-note" role="status">{note}</p>}
      <Status loading={loading && !data} error={error} reload={reload} />
      {data && (
        <ul className="adm-help">
          {data.rows.map((h) => (
            <li key={h.id} className="adm-card" data-done={h.status === 'done' ? 'true' : undefined}>
              <div className="adm-help-top">
                <b>{h.accountName || h.username}</b>
                {!h.accountId && <span className="adm-tag adm-tag-bad">no such player</span>}
                {h.status === 'done' && <span className="adm-tag adm-tag-dim">done{h.doneBy ? ` by ${h.doneBy}` : ''}</span>}
                <small className="adm-muted">{when(h.createdAt)}</small>
              </div>
              <dl className="adm-facts">
                <dt>Reach them at</dt><dd className="adm-contact">{h.contact}</dd>
                {h.note && <><dt>They say</dt><dd>{h.note}</dd></>}
              </dl>
              <div className="adm-row">
                {h.accountId && <button className="adm-btn adm-btn-gold" onClick={() => setOpen(h.accountId)}>Open player</button>}
                {h.status === 'open' && <button className="adm-btn" onClick={() => act('done', h.id, `Marked ${h.username} as done.`)}>Mark done</button>}
                <button className="adm-btn" onClick={() => act('delete', h.id, 'Request deleted.')}>Delete</button>
              </div>
            </li>
          ))}
          {!data.rows.length && <li className="adm-muted">{status === 'open' ? 'Nobody is waiting for help.' : 'Nothing here.'}</li>}
        </ul>
      )}
      {open && <PlayerSheet api={api} id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </section>
  )
}
