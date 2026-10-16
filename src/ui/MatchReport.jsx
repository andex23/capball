import { DIVISIONS, ME, CUP_NAME, myPosition, leagueDate, cupDate, formatGameDate } from '../game/career'
import { teamById, allFixtures, roundName } from '../game/tournament'
import { TeamTag, scoreText } from './TournamentBits'
import { PlayerRatings } from './SquadPanel'
import Icon from './Icon'

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * After a career match: who won, the written commentary (text, no audio),
 * your players' ratings, and the other results from that matchday.
 */
export default function MatchReport({ career, onDone }) {
  const m = career.lastMatch
  if (!m) return null
  const cup = m.competition === 'cup'
  const t = cup ? career.cup?.tournament : career.league
  if (!t) return null
  const home = teamById(t, m.home)
  const away = teamById(t, m.away)
  const mineHome = m.home === ME
  const gf = mineHome ? m.result.home : m.result.away
  const ga = mineHome ? m.result.away : m.result.home
  const pensWon = m.result.pens ? (mineHome ? m.result.pens.home > m.result.pens.away : m.result.pens.away > m.result.pens.home) : null
  const outcome = gf > ga || pensWon === true ? 'win' : gf < ga || pensWon === false ? 'loss' : 'draw'
  const title = { win: 'Victory!', draw: 'Draw', loss: 'Defeat' }[outcome]
  const label = cup
    ? `${CUP_NAME} · ${roundName(m.round, t.rounds?.length || 3)}`
    : `Matchday ${m.round + 1} · ${DIVISIONS[career.level]?.name || ''}`
  const date = formatGameDate(cup ? cupDate(career, m.round) : leagueDate(career, { round: m.round }))
  // The rest of the matchday
  const others = cup
    ? (t.rounds?.[m.round] || []).filter((x) => x.home !== ME && x.away !== ME)
    : allFixtures(t).filter((f) => f.round === m.round && f.home !== ME && f.away !== ME)
  const name = (id) => teamById(t, id)?.name || '—'

  return (
    <div className="match-report">
      <section className="card card-pad career-end match-report-head" data-tone={outcome === 'win' ? 'good' : outcome === 'loss' ? 'bad' : ''}>
        <div className="career-date">{date}</div>
        <div className="eyebrow">{label}</div>
        <h2 className="display career-end-title">{title}</h2>
        <div className="career-vs match-report-score">
          <TeamTag team={home} size={34} strong />
          <span className="match-report-goals">{m.result.home} – {m.result.away}</span>
          <TeamTag team={away} size={34} strong mirror />
        </div>
        {m.result.pens && <p className="t-note">Penalties: {m.result.pens.home}–{m.result.pens.away}</p>}
        {!cup && <p className="t-note">You’re now <b>{ordinal(myPosition(career.league))}</b> in the table.</p>}
      </section>

      {m.story?.length > 0 && (
        <section className="card card-pad" aria-label="Commentary">
          <h2 className="saved-h">Commentary</h2>
          <ol className="match-story">
            {m.story.map((x, i) => (
              <li key={i} data-kind={x.kind} data-mine={x.team && ((x.team === 'team1') === mineHome) ? 'true' : undefined}>
                <span className="match-story-min">{x.min != null ? `${x.min}’` : ''}</span>
                <span>{x.kind === 'goal' && <Icon name="ball" size={13} />} {x.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <PlayerRatings career={career} title="Player ratings" fixtureId={m.fixtureId} />

      {others.length > 0 && (
        <section className="card card-pad" aria-label="Other results">
          <h2 className="saved-h">{cup ? 'Other ties' : 'Around the league'}</h2>
          <ul className="club-lines match-others">
            {others.map((f) => (
              <li key={f.id}>
                <span>{name(f.home)}</span>
                <b>{f.result ? scoreText(f.result) : 'to play'}</b>
                <span className="match-others-away">{name(f.away)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button className="btn btn-gold btn-lg btn-block" onClick={onDone}><Icon name="next" size={18} /> Continue</button>
    </div>
  )
}
