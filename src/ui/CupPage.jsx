import { DIVISIONS, ME, CUP_NAME, CUP_PRIZE, CUP_AFTER, cupTie, cupNext, cupRun, playedThisSeason, opponentOvr } from '../game/career'
import { teamById, roundName } from '../game/tournament'
import { money, matchupOf } from '../game/squad'
import { Bracket } from '../screens/TournamentHubScreen'
import { TeamTag } from './TournamentBits'
import { Rating, DIV_SHORT } from './PlayerBits'
import Icon from './Icon'

const STAGE = { won: 'Winners!', final: 'Runners-up', semi: 'Out in the semi-finals', quarter: 'Out in the quarter-finals' }
const MATCHUP = { favourite: 'Favourites', even: 'Evenly matched', underdog: 'Underdogs' }

/**
 * The Cap Cup: an eight-club knockout played alongside the league (clubs from
 * your division and the ones either side). Your road, your next tie and when
 * it opens, the full draw, the prize money and who's in it.
 */
export default function CupPage({ career, myOvr, onPlay }) {
  const cup = career.cup
  const t = cup?.tournament
  if (!t) return <p className="muted t-note">No {CUP_NAME} this season.</p>
  const rounds = t.rounds.length
  const tie = cupTie(career)
  const upcoming = cupNext(career)
  const out = cupRun(t)
  const played = playedThisSeason(career.league)
  const levelOf = (id) => cup.levels?.[id] ?? career.level
  const ovrOf = (team) => (team ? opponentOvr(career, team.name, levelOf(team.id)) : 0)
  const next = tie || upcoming?.tie || null
  const opp = next ? teamById(t, next.home === ME ? next.away : next.home) : null
  const oppOvr = ovrOf(opp)
  const entrants = t.teams.filter((x) => x.id !== ME).slice().sort((a, b) => levelOf(b.id) - levelOf(a.id) || ovrOf(b) - ovrOf(a))

  return (
    <div className="cup-page">
      <section className="card card-pad cup-hero" data-state={out === 'won' ? 'won' : out ? 'out' : 'in'}>
        <div className="eyebrow">Season {career.season} · knockout · {rounds === 3 ? 'quarter-finals, semi-finals, final' : `${rounds} rounds`}</div>
        <h2 className="display cup-title"><Icon name="trophy" size={26} /> {CUP_NAME}</h2>
        <p className="t-note">
          {out ? STAGE[out] : next ? <>You’re in the <b>{roundName(next.round, rounds).toLowerCase()}</b>.</> : 'Waiting for the draw.'}
          {' '}Eight clubs from the {DIVISIONS[career.level].name} and the divisions either side. A draw goes to extra time, then penalties.
        </p>
        <ul className="club-lines cup-prizes" aria-label="Prize money">
          <li><span>Winners</span><b>{money(CUP_PRIZE.won)}</b></li>
          <li><span>Runners-up</span><b>{money(CUP_PRIZE.final)}</b></li>
          <li><span>Semi-finalists</span><b>{money(CUP_PRIZE.semi)}</b></li>
        </ul>
      </section>

      {next && !out && (
        <section className="card card-pad career-next career-cup" aria-label="Your next cup tie">
          <div className="eyebrow">{roundName(next.round, rounds)} · {next.home === ME ? 'Home' : 'Away'}</div>
          <div className="career-vs">
            <TeamTag team={teamById(t, ME)} size={30} strong />
            <span className="vs-badge">VS</span>
            <TeamTag team={opp} size={30} strong mirror />
          </div>
          {opp && (
            <div className="career-ovr" data-matchup={matchupOf(myOvr, oppOvr)}>
              <span><b>{myOvr}</b><small>OVR</small></span>
              <span className="career-ovr-word">{MATCHUP[matchupOf(myOvr, oppOvr)]}{levelOf(opp.id) !== career.level ? ` · ${DIVISIONS[levelOf(opp.id)].name}` : ''}</span>
              <span><b>{oppOvr}</b><small>OVR</small></span>
            </div>
          )}
          {tie
            ? <button className="btn btn-purple btn-lg btn-block" onClick={() => onPlay(tie)}><Icon name="trophy" size={20} /> Play cup tie</button>
            : <p className="career-strip" role="status"><Icon name="lock" size={14} /> Opens after league matchday {CUP_AFTER[next.round]} · {Math.max(0, CUP_AFTER[next.round] - played)} league match{CUP_AFTER[next.round] - played === 1 ? '' : 'es'} to go</p>}
        </section>
      )}

      <section className="card card-pad" aria-label="The draw">
        <h2 className="saved-h">The draw</h2>
        <Bracket
          t={t}
          nextId={next?.id}
          actionFor={(f) => (tie && f.id === tie.id ? { kind: 'play' } : null)}
          onAct={() => tie && onPlay(tie)}
        />
        <p className="muted t-note">Rounds open after league matchdays {CUP_AFTER.join(', ')}. Other ties play out alongside yours.</p>
      </section>

      <section className="card card-pad" aria-label="Clubs in the cup">
        <h2 className="saved-h">Who’s in it</h2>
        <ul className="squad-list squad-simple">
          {entrants.map((team) => (
            <li key={team.id}>
              <span className="squad-role">{DIV_SHORT[levelOf(team.id)]}</span>
              <span className="squad-name"><TeamTag team={team} size={22} /><small className="squad-stats">{DIVISIONS[levelOf(team.id)].name}</small></span>
              <Rating value={ovrOf(team)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
