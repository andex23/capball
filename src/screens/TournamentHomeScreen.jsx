import { useState, useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { progress, teamById } from '../game/tournament'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { TeamTag, ProgressBar } from '../ui/TournamentBits'
import { displayColor } from '../ui/color'
import { useOnline } from '../pwa/useOnline'

const CODE_LENGTH = 6

const formatLabel = (t) => (t.format === 'league'
  ? `League${t.legs === 2 ? ' · home & away' : ''}`
  : 'Knockout cup')

function dateLabel(ms) {
  try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) } catch { return '' }
}

export default function TournamentHomeScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const local = useTournamentStore((s) => s.local)
  const history = useTournamentStore((s) => s.history)
  const abandonLocal = useTournamentStore((s) => s.abandonLocal)
  const recentOnline = useTournamentStore((s) => s.recentOnline)
  const { startSetup, openHub, openOnline, forgetOnline } = useTournamentStore.getState()
  const [confirm, setConfirm] = useState(null) // 'new' | 'abandon'
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const online = useOnline()

  const join = async (raw) => {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (code.length !== CODE_LENGTH) return
    setJoinBusy(true)
    setJoinError(null)
    try {
      await openOnline(code)
      playConfirm()
      openHub('online')
    } catch (e) {
      setJoinError(e.message)
    } finally {
      setJoinBusy(false)
    }
  }

  // Invite links (?tournament=CODE) open the tournament straight away
  useEffect(() => {
    let code = null
    try {
      const url = new URL(window.location.href)
      code = url.searchParams.get('tournament')
      if (code) {
        url.searchParams.delete('tournament')
        window.history.replaceState(null, '', url.pathname + url.search + url.hash)
      }
    } catch { /* no URL support: ignore */ }
    if (code) { setJoining(true); setJoinCode(code.toUpperCase().slice(0, CODE_LENGTH)); join(code) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finished = !!local?.championId
  const p = progress(local)
  const champ = finished ? teamById(local, local.championId) : null

  const startNew = () => {
    playButtonSelect()
    if (local && !finished) setConfirm('new')
    else startSetup('local')
  }

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow shell-eyebrow">Cups and leagues</div>
            <h1 className="display shell-title">Tournaments</h1>
          </div>
          <span className="mode-icon"><Icon name="trophy" size={24} /></span>
        </header>

        <main className="shell-body t-home">
          <section className="card card-pad t-home-card t-home-local">
            <div className="t-card-head">
              <div>
                <div className="eyebrow">On this device</div>
                <h2 className="display t-card-title">{local ? formatLabel(local) : 'Start a tournament'}</h2>
              </div>
              <span className="chip t-static-chip"><Icon name="users" size={15} /> Pass &amp; play · CPU</span>
            </div>

            {local ? (
              <>
                <div className="t-team-strip" aria-label="Teams">
                  {local.teams.map((team) => (
                    <TeamTag key={team.id} team={team} size={22} strong={team.id === local.championId} />
                  ))}
                </div>
                {finished ? (
                  <div className="t-champ-line" style={{ '--team': displayColor(champ.primary) }}>
                    <Icon name="trophy" size={18} /> <b>{champ.name}</b> won it
                  </div>
                ) : (
                  <ProgressBar played={p.played} total={p.total} label="Progress" />
                )}
                <div className="t-actions">
                  <button className="btn btn-gold" onClick={() => { playConfirm(); openHub('local') }} onMouseEnter={playHoverTick}>
                    {finished ? <>See results <Icon name="next" size={18} /></> : <>Continue <Icon name="play" size={18} /></>}
                  </button>
                  <button className="btn btn-secondary" onClick={startNew} onMouseEnter={playHoverTick}>New tournament</button>
                  {!finished && (
                    <button className="btn btn-ghost t-abandon" onClick={() => { playButtonSelect(); setConfirm('abandon') }}>Abandon</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="muted">A knockout cup or a league for 3 to 8 teams. Friends take turns on this phone; the computer runs any team nobody picks, and its games play out by themselves.</p>
                <div className="t-actions">
                  <button className="btn btn-gold btn-lg" onClick={() => { playConfirm(); startSetup('local') }} onMouseEnter={playHoverTick}>
                    New tournament <Icon name="next" size={18} />
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="card card-pad t-home-card t-home-online">
            <div className="t-card-head">
              <div>
                <div className="eyebrow">With friends online</div>
                <h2 className="display t-card-title">Online tournament</h2>
              </div>
              <span className="chip t-static-chip"><Icon name="globe" size={15} /> Own phones</span>
            </div>
            <p className="muted">Everyone plays from their own phone. Share the code, each friend takes a team, and every result lands in one table for all of you.</p>
            {joining ? (
              <form className="t-join" onSubmit={(e) => { e.preventDefault(); join(joinCode) }}>
                <label className="eyebrow" htmlFor="t-join-code">Tournament code</label>
                <input
                  id="t-join-code"
                  className="field display tabular t-join-field"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
                  placeholder="ABC123"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoFocus
                  disabled={joinBusy}
                />
                {joinError && <p className="t-warn" role="alert" style={{ marginTop: 0 }}>{joinError}</p>}
                <div className="t-actions" style={{ marginTop: 0 }}>
                  <button className="btn btn-blue" type="submit" disabled={joinCode.length !== CODE_LENGTH || joinBusy || !online}>
                    {joinBusy ? 'Opening…' : <>Open <Icon name="next" size={18} /></>}
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => { playButtonSelect(); setJoining(false); setJoinError(null) }}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="t-actions">
                <button className="btn btn-purple" onClick={() => { playConfirm(); startSetup('online') }} onMouseEnter={playHoverTick} disabled={!online}>
                  <Icon name="globe" size={18} /> Create online
                </button>
                <button className="btn btn-blue" onClick={() => { playButtonSelect(); setJoining(true) }} onMouseEnter={playHoverTick} disabled={!online}>Join with a code</button>
              </div>
            )}
            {!online && <p className="t-warn">You’re offline. Online tournaments need a connection.</p>}
            {recentOnline.length > 0 && (
              <div className="t-recent">
                <div className="eyebrow" style={{ marginBottom: 8 }}>Your online tournaments</div>
                <ul>
                  {recentOnline.map((r) => (
                    <li key={r.code}>
                      <button className="list-option t-recent-open" onClick={() => { playButtonSelect(); join(r.code) }} disabled={joinBusy || !online}>
                        <span className="display tabular t-recent-code">{r.code}</span>
                        <small>{r.label}</small>
                      </button>
                      <button className="t-remove" onClick={() => { playButtonSelect(); forgetOnline(r.code) }} aria-label={`Forget ${r.code}`}>
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                {!joining && joinError && <p className="t-warn" role="alert">{joinError}</p>}
              </div>
            )}
          </section>

          <section className="card card-pad t-home-card t-home-history">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Winners</div>
            {history.length ? (
              <ol className="t-history">
                {history.map((h) => (
                  <li key={h.id} style={{ '--team': displayColor(h.champion.primary) }}>
                    <span className="t-history-dot" style={{ background: h.champion.primary, borderColor: h.champion.edge }} aria-hidden />
                    <span className="t-history-main">
                      <b>{h.champion.name}</b>
                      <small className="muted">
                        {h.format === 'league' ? 'League' : 'Cup'} · {h.teams} teams{h.runnerUp ? ` · beat ${h.runnerUp.name}` : ''}
                      </small>
                    </span>
                    <small className="muted t-history-date">{dateLabel(h.date)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted t-empty">No winners yet. Finish a tournament and the champion goes up here.</p>
            )}
          </section>
        </main>

        <footer className="shell-foot">
          <div className="shell-foot-inner">
            <button className="btn btn-secondary" onClick={() => { playButtonSelect(); goToScreen(SCREEN.MENU) }} onMouseEnter={playHoverTick}>
              <Icon name="back" size={18} /> Menu
            </button>
          </div>
        </footer>
      </div>

      {confirm && (
        <Modal
          title={confirm === 'new' ? 'Start again?' : 'Abandon it?'}
          onClose={() => setConfirm(null)}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Keep playing</button>
              <button
                className="btn btn-red"
                onClick={() => {
                  playButtonSelect()
                  if (confirm === 'abandon') abandonLocal()
                  setConfirm(null)
                  if (confirm === 'new') startSetup('local')
                }}
              >
                {confirm === 'new' ? 'Set up a new one' : 'Abandon'}
              </button>
            </>
          )}
        >
          <p className="muted">
            {confirm === 'new'
              ? 'Your tournament in progress is replaced once you create the new one.'
              : `The ${local?.format === 'league' ? 'league' : 'cup'} in progress and its results are deleted.`}
          </p>
        </Modal>
      )}
    </div>
  )
}
