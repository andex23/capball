import { useState, useEffect } from 'react'
import { isLagos } from '../platform'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { progress, teamById } from '../game/tournament'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
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

  const [showOnline, setShowOnline] = useState(false)
  const [showLan, setShowLan] = useState(false)
  const [winners, setWinners] = useState(false)
  const shelf = [...history.slice(0, 4), ...Array(Math.max(0, 4 - history.length)).fill(null)]

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head tour-top">
          <button className="tour-back" onClick={() => { playButtonSelect(); goToScreen(SCREEN.MENU) }} aria-label="Back to the menu"><Icon name="back" size={18} /></button>
          <div>
            <h1 className="display tour-title">Tournaments</h1>
            <div className="tour-sub">Cups and leagues, 3 to 8 teams</div>
          </div>
        </header>

        <main className="shell-body t-home tour-home">
          {/* The trophy cabinet: the last four winners */}
          <button className="tour-shelf" onClick={() => { playButtonSelect(); setWinners(true) }} aria-label={history.length ? 'See every winner' : 'No winners yet'}>
            <span className="tour-shelf-row">
              {shelf.map((h, i) => (
                <span key={h?.id || `empty${i}`} className="tour-trophy" data-empty={h ? undefined : 'true'}>
                  <svg viewBox="0 0 48 60" width="46" height="58" aria-hidden>
                    <path d="M10 4h28v12c0 10-6 18-14 18S10 26 10 16z" />
                    <path d="M10 8H3v5c0 6 4 10 9 11M38 8h7v5c0 6-4 10-9 11" fill="none" strokeWidth="3" />
                    <path d="M21 34h6v8h-6z" /><path d="M13 42h22l3 14H10z" />
                  </svg>
                  <small>{h ? h.champion.name : '?'}</small>
                </span>
              ))}
            </span>
            {!history.length && <span className="tour-shelf-note">Win a tournament to put a trophy here</span>}
          </button>

          {local && (
            <div className="tour-going">
              <button className="tour-going-main" onClick={() => { playConfirm(); openHub('local') }}>
                <Icon name={finished ? 'trophy' : 'play'} size={22} />
                <span>
                  <b>{finished ? 'See results' : 'Carry on'} · {formatLabel(local)}</b>
                  <small>{finished ? <>{champ.name} won it</> : `${p.played} of ${p.total} matches played · ${local.teams.length} teams`}</small>
                </span>
                <Icon name="next" size={18} />
              </button>
              {!finished && <button className="tour-going-x" onClick={() => { playButtonSelect(); setConfirm('abandon') }}>Abandon</button>}
            </div>
          )}

          <button className="tour-tile" data-tone="red" onClick={() => { useTournamentStore.getState().setLocalTransport('device'); startNew() }} onMouseEnter={playHoverTick}>
            <span className="tour-tile-icon"><Icon name="users" size={26} /></span>
            <span className="tour-tile-text"><b>This phone</b><small>Pass and play, or against the computer</small></span>
            <Icon name="next" size={18} />
          </button>

          {/* LAN and online competitions need their own pairing and accounts; not in Lagos Life */}
          {!isLagos() && <>
            <div className="tour-tile-wrap">
              <button className="tour-tile" data-tone="blue" aria-expanded={showLan} onClick={() => { playButtonSelect(); setShowLan(!showLan) }} onMouseEnter={playHoverTick}>
                <span className="tour-tile-icon"><Icon name="wifi" size={26} /></span>
                <span className="tour-tile-text"><b>Same Wi-Fi</b><small>Each friend on their own phone, no internet needed</small></span>
                <Icon name="next" size={18} />
              </button>
              {showLan && (
                <div className="tour-online">
                  <div className="t-actions" style={{ marginTop: 0 }}>
                    <button className="btn btn-gold" onClick={() => { useTournamentStore.getState().setLocalTransport('lan'); startNew() }} onMouseEnter={playHoverTick}>Host a cup or league</button>
                    <button className="btn btn-blue" onClick={() => { playButtonSelect(); goToScreen(SCREEN.LAN) }} onMouseEnter={playHoverTick}><Icon name="wifi" size={18} /> Join a match</button>
                  </div>
                  <p className="muted t-note">The host runs the tournament on their phone. When a match is yours, join it here.</p>
                </div>
              )}
            </div>

            <div className="tour-tile-wrap" data-open={showOnline || joining ? 'true' : undefined}>
              <button className="tour-tile" data-tone="purple" aria-expanded={showOnline || joining} onClick={() => { playButtonSelect(); setShowOnline(!(showOnline || joining)); setJoining(false); setJoinError(null) }} onMouseEnter={playHoverTick}>
                <span className="tour-tile-icon"><Icon name="globe" size={26} /></span>
                <span className="tour-tile-text"><b>Online</b><small>Everyone on their own phone, one table for all</small></span>
                <Icon name="next" size={18} />
              </button>
              {(showOnline || joining) && (
                <div className="tour-online">
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
                    <div className="t-actions" style={{ marginTop: 0 }}>
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
                </div>
              )}
            </div>
          </>}
        </main>
      </div>

      {winners && (
        <Modal title="Winners" onClose={() => setWinners(false)}>
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
        </Modal>
      )}

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
