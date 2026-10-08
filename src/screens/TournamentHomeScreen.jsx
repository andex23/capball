import { useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { progress, teamById } from '../game/tournament'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { TeamTag, ProgressBar } from '../ui/TournamentBits'
import { displayColor } from '../ui/color'

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
  const [confirm, setConfirm] = useState(null) // 'new' | 'abandon'

  const finished = !!local?.championId
  const p = progress(local)
  const champ = finished ? teamById(local, local.championId) : null

  const go = (screen) => { playConfirm(); goToScreen(screen) }
  const startNew = () => {
    playButtonSelect()
    if (local && !finished) setConfirm('new')
    else goToScreen(SCREEN.TOURNAMENT_SETUP)
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
                  <button className="btn btn-gold" onClick={() => go(SCREEN.TOURNAMENT_HUB)} onMouseEnter={playHoverTick}>
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
                  <button className="btn btn-gold btn-lg" onClick={() => go(SCREEN.TOURNAMENT_SETUP)} onMouseEnter={playHoverTick}>
                    New tournament <Icon name="next" size={18} />
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="card card-pad t-home-card t-home-online" aria-disabled="true">
            <div className="t-card-head">
              <div>
                <div className="eyebrow">With friends online</div>
                <h2 className="display t-card-title">Online tournament</h2>
              </div>
              <span className="chip t-static-chip t-soon">Coming soon</span>
            </div>
            <p className="muted">Everyone plays from their own phone with a shared tournament code. Results land in one table for all of you.</p>
            <div className="t-actions">
              <button className="btn btn-purple" disabled><Icon name="globe" size={18} /> Create online</button>
              <button className="btn btn-blue" disabled>Join with a code</button>
            </div>
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
                  if (confirm === 'new') goToScreen(SCREEN.TOURNAMENT_SETUP)
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
