import { useTournamentStore } from '../state/tournamentStore'
import { useSavedStore, resumeSavedMatch, deleteSavedMatch, describeSave } from '../state/savedMatch'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Icon from './Icon'
import { allFixtures } from '../game/tournament'

const MODE_LABEL = { ai: 'Vs computer', local: 'Local', online: 'Online' }

function day(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/**
 * Everything the player has on the go: the saved match, their tournaments and
 * their recent results — with a way back into each.
 */
export default function SavedGames() {
  const saved = useSavedStore((s) => s.saved)
  const history = useSavedStore((s) => s.history)
  const career = useSavedStore((s) => s.career)
  const local = useTournamentStore((s) => s.local)
  const recentOnline = useTournamentStore((s) => s.recentOnline)
  const won = useTournamentStore((s) => s.history)
  const { openHub, openOnline } = useTournamentStore.getState()

  const fixtures = local ? allFixtures(local) : []
  const localLabel = local
    ? `${local.format === 'league' ? 'League' : 'Cup'} · ${local.teams.length} teams${local.championId ? ' · finished' : ` · ${fixtures.filter((f) => f.result).length}/${fixtures.length} played`}`
    : null

  return (
    <div className="saved-games">
      <section>
        <h3 className="saved-h">Career</h3>
        {career.played === 0 ? (
          <p className="muted saved-empty">Play a match and your totals start here.</p>
        ) : (
          <>
            <div className="career-grid">
              <div className="career-stat"><b>{career.played}</b><small>Played</small></div>
              <div className="career-stat" data-tone="good"><b>{career.won}</b><small>Won</small></div>
              <div className="career-stat"><b>{career.drawn}</b><small>Drawn</small></div>
              <div className="career-stat" data-tone="bad"><b>{career.lost}</b><small>Lost</small></div>
              <div className="career-stat"><b>{career.goalsFor}</b><small>Scored</small></div>
              <div className="career-stat"><b>{career.goalsAgainst}</b><small>Conceded</small></div>
              <div className="career-stat"><b>{career.cleanSheets}</b><small>Clean sheets</small></div>
              <div className="career-stat" data-tone="gold"><b>{won.length}</b><small>Cups won</small></div>
            </div>
            <p className="muted saved-empty" style={{ marginTop: 8 }}>
              {career.bestWin ? <>Best win: <b>{career.bestWin.for}–{career.bestWin.against}</b> vs {career.bestWin.vs}. </> : null}
              {career.played - career.local > 0 && <>Win rate {Math.round((career.won / (career.played - career.local)) * 100)}%. </>}
              {career.local > 0 && <>{career.local} pass-and-play match{career.local === 1 ? '' : 'es'} (not counted as wins or losses).</>}
            </p>
          </>
        )}
      </section>

      <section>
        <h3 className="saved-h">Saved match</h3>
        {saved ? (
          <div className="saved-row">
            <div className="saved-main">
              <b>{describeSave(saved)}</b>
              <small className="muted">Saved {day(saved.savedAt)}</small>
            </div>
            <button className="btn btn-gold" onClick={() => { playConfirm(); resumeSavedMatch() }}><Icon name="play" size={16} /> Continue</button>
            <button className="btn btn-ghost saved-del" aria-label="Delete saved match" onClick={() => { playButtonSelect(); deleteSavedMatch() }}><Icon name="close" size={16} /></button>
          </div>
        ) : (
          <p className="muted saved-empty">None. Pause any match and tap <b>Save &amp; quit</b> to carry on later.</p>
        )}
      </section>

      <section>
        <h3 className="saved-h">Tournaments</h3>
        {!local && recentOnline.length === 0 && <p className="muted saved-empty">None yet. Start one from Tournament on the menu.</p>}
        {local && (
          <div className="saved-row">
            <div className="saved-main"><b>On this phone</b><small className="muted">{localLabel}</small></div>
            <button className="btn btn-secondary" onClick={() => { playConfirm(); openHub('local') }}>Open</button>
          </div>
        )}
        {recentOnline.slice(0, 4).map((r) => (
          <div className="saved-row" key={r.code}>
            <div className="saved-main"><b>Online · {r.code}</b><small className="muted">{r.label}</small></div>
            <button className="btn btn-secondary" onClick={() => { playConfirm(); openHub('online'); openOnline(r.code).catch(() => {}) }}>Open</button>
          </div>
        ))}
        {won.length > 0 && <p className="muted saved-empty">{won.length} tournament{won.length === 1 ? '' : 's'} won — see Records.</p>}
      </section>

      <section>
        <h3 className="saved-h">Recent matches</h3>
        {history.length === 0 ? (
          <p className="muted saved-empty">Your results will show up here.</p>
        ) : (
          <ul className="saved-history">
            {history.slice(0, 8).map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <span className="saved-dot" style={{ background: h.team1.primary }} />
                <span className="saved-score">
                  {h.team1.name} <b>{h.score.team1}–{h.score.team2}</b> {h.team2.name}
                  {h.pens && <small> ({h.pens.team1}–{h.pens.team2} pens)</small>}
                </span>
                <span className="saved-dot" style={{ background: h.team2.primary }} />
                <small className="muted saved-when">{h.tournament ? 'Cup · ' : ''}{MODE_LABEL[h.mode] || ''} · {day(h.at)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

