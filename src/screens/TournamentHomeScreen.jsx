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
    if (code) { setWhere('online'); setJoining(true); setJoinCode(code.toUpperCase().slice(0, CODE_LENGTH)); join(code) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finished = !!local?.championId
  const p = progress(local)
  const champ = finished ? teamById(local, local.championId) : null

  const startNew = () => {
    playButtonSelect()
    if (local && !finished) setConfirm('new')
    else startSetup('local')
  }

  // Where the next tournament is played: this phone, over Wi-Fi, or online
  const transport = useTournamentStore((s) => s.localTransport)
  const [where, setWhere] = useState(() => (joining ? 'online' : !isLagos() && transport === 'lan' ? 'lan' : 'device'))
  const [winners, setWinners] = useState(false)
  const myKit = useMatchStore((s) => s.teamConfig.team1)
  const WHERE = {
    device: { label: 'This phone', line: 'Pass and play, or against the computer. Computer matches play themselves on the fixture list.' },
    lan: { label: 'Wi-Fi', line: 'You run it on this phone; friends on the same Wi-Fi or hotspot join each match from theirs. No internet needed.' },
    online: { label: 'Online', line: 'Everyone plays from their own phone, anywhere. Share the code and every result lands in one table.' },
  }
  const create = () => {
    if (where === 'online') { playConfirm(); startSetup('online'); return }
    useTournamentStore.getState().setLocalTransport(where === 'lan' ? 'lan' : 'device')
    startNew()
  }
  const slot = (team) => (team
    ? <span className="tour-slot"><i style={{ background: team.primary, borderColor: team.edge }} />{team.name}</span>
    : <span className="tour-slot" data-empty="true">?</span>)

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
          {/* The cup-draw poster */}
          <section className="tour-poster">
            <div className="tour-poster-k">Cup or league · 3 to 8 teams</div>
            <div className="tour-bracket" aria-hidden>
              <span className="tour-bracket-col">{slot(myKit)}{slot(null)}{slot(null)}{slot(null)}</span>
              <span className="tour-bracket-col">{slot(null)}{slot(null)}</span>
              <span className="tour-bracket-final"><Icon name="trophy" size={20} />Final</span>
            </div>
            <button className="btn btn-gold btn-lg btn-block" onClick={create} onMouseEnter={playHoverTick} disabled={where === 'online' && !online}>
              {where === 'lan' ? 'Host a tournament' : where === 'online' ? 'Create online' : 'New tournament'} <Icon name="next" size={18} />
            </button>
          </section>

          {/* LAN and online competitions need their own pairing and accounts; not in Lagos Life */}
          {!isLagos() && (
            <div className="segmented stretch tour-where" role="group" aria-label="Where you play">
              {Object.entries(WHERE).map(([k, w]) => (
                <button key={k} aria-pressed={where === k} onClick={() => { playButtonSelect(); setWhere(k); setJoining(false); setJoinError(null) }}>{w.label}</button>
              ))}
            </div>
          )}
          <p className="tour-line">{WHERE[where].line}</p>

          {where === 'lan' && (
            <button className="btn btn-blue btn-block" onClick={() => { playButtonSelect(); goToScreen(SCREEN.LAN) }} onMouseEnter={playHoverTick}><Icon name="wifi" size={18} /> Join a friend’s match</button>
          )}

          {where === 'online' && (
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
                <button className="btn btn-blue btn-block" onClick={() => { playButtonSelect(); setJoining(true) }} onMouseEnter={playHoverTick} disabled={!online}>Join with a code</button>
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

          <button className="tour-winners" onClick={() => { playButtonSelect(); setWinners(true) }}>
            <b>Winners</b>
            <span>{history.length ? history.slice(0, 3).map((h) => h.champion.name).join(' · ') : 'None yet'}</span>
            <Icon name="next" size={16} />
          </button>
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
