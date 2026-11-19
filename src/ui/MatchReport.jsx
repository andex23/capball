import { CareerScoreboard } from './CareerScoreboard'
import { PressRoom, MatchFigures } from './MatchFigures'
import { ME, careerNext, careerDate, formatGameDate } from '../game/career'
import { teamById, allFixtures } from '../game/tournament'
import { scoreText } from './TournamentBits'
import { PlayerRatings } from './SquadPanel'
import Icon from './Icon'

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
  const mineHome = m.home === ME
  const due = careerNext(career)
  const nextTeam = due && teamById(due.kind === 'cup' ? career.cup.tournament : career.league, due.fixture.home === ME ? due.fixture.away : due.fixture.home)
  // The rest of the matchday
  const others = cup
    ? (t.rounds?.[m.round] || []).filter((x) => x.home !== ME && x.away !== ME)
    : allFixtures(t).filter((f) => f.round === m.round && f.home !== ME && f.away !== ME)
  const name = (id) => teamById(t, id)?.name || '—'

  return (
    <div className="match-report">
      {m.derby && (() => {
        const mine = mineHome ? m.result.home : m.result.away
        const theirs = mineHome ? m.result.away : m.result.home
        return <p className="derby-report" data-tone={mine > theirs ? 'good' : mine < theirs ? 'bad' : undefined}>{m.derby} · <b>{mine > theirs ? 'Derby win!' : mine < theirs ? 'Derby defeat' : 'Honours even'}</b></p>
      })()}
      <CareerScoreboard career={career} />
      {(m.stats || m.momentum) && <MatchFigures match={m} mine={career.club.name} opponent={name(mineHome ? m.away : m.home)} />}
      {m.story?.length > 0 && (
        <section className="card card-pad" aria-label="Commentary">
          <h2 className="saved-h">Commentary</h2>
          {m.brief && <p className="cs-preview-line">{m.brief}</p>}
          {m.debuts?.length > 0 && <p className="cs-preview-line"><b>Club debut</b> · {m.debuts.join(', ')}</p>}
          <ol className="match-story">
            {m.story.map((x, i) => (
              <li key={i} data-kind={x.kind} data-mine={(x.mine ?? (x.team && ((x.team === 'team1') === mineHome))) ? 'true' : undefined}>
                <span className="match-story-min">{x.min != null ? `${x.min}’` : ''}</span>
                <span>{x.kind === 'goal' && <Icon name="ball" size={13} />} {x.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <PressRoom career={career} />
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

      {nextTeam && <p className="cs-next-line"><b>Next fixture</b> {nextTeam.name} · {due.fixture.home === ME ? 'Home' : 'Away'} · {formatGameDate(careerDate(career))}</p>}
      <button className="btn btn-gold btn-lg btn-block" onClick={onDone}><Icon name="next" size={18} /> Continue</button>
    </div>
  )
}
