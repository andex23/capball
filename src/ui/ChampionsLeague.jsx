/**
 * The Canta Champions League on the career screen: your next night (with the
 * trophy and what's at stake), and the two group tables.
 */
import { ME, CCL_NAME, cclLabel, compOf, opponentOvr, formatGameDate, cclDate } from '../game/career'
import { cclNext, cclRun, cclWinner, CCL_PRIZE } from '../game/championsLeague'
import { teamById, standings } from '../game/tournament'
import { money, matchupOf } from '../game/squad'
import { playHoverTick } from '../audio/SoundManager'
import { TeamTag } from './TournamentBits'
import Icon from './Icon'

const MATCHUP = { favourite: 'Favourites', even: 'Evenly matched', underdog: 'Underdogs' }

/** The next Champions League match, ready to play (`fixture` is due now). */
export function CclMatchCard({ career, fixture, myOvr, onPlay }) {
  const t = compOf(career, 'ccl', fixture.id)
  const opp = teamById(t, fixture.home === ME ? fixture.away : fixture.home)
  const oppOvr = opp ? opponentOvr(career, opp.name, career.level) : 0
  const final = t.format === 'knockout' && fixture.round === 1
  const row = t.format === 'league' ? standings(t).find((r) => r.id === ME) : null
  return (
    <section className="card card-pad career-next ccl-card" data-final={final ? 'true' : undefined} aria-label={CCL_NAME}>
      <div className="career-date">{formatGameDate(cclDate(career, fixture))} · {fixture.home === ME ? 'Home' : 'Away'} · Champions League night</div>
      <div className="ccl-head"><span aria-hidden>🏆</span><div><b>{cclLabel(career, fixture.id)}</b><small>{final ? `Win it: ${money(CCL_PRIZE.won)}` : t.format === 'league' ? `Each group win: ${money(CCL_PRIZE.groupWin)}${row?.p ? ` · you have ${row.pts} pts` : ''}` : `Reach the final: ${money(CCL_PRIZE.final)}`}</small></div></div>
      <div className="career-vs">
        <TeamTag team={teamById(t, ME)} size={52} strong />
        <span className="vs-badge">VS</span>
        <TeamTag team={opp} size={52} strong mirror />
      </div>
      <p className="career-match-line" data-matchup={matchupOf(myOvr, oppOvr)}>OVR {myOvr} v {oppOvr} · <b>{MATCHUP[matchupOf(myOvr, oppOvr)]}</b></p>
      <button className="btn btn-gold btn-lg btn-block" onClick={onPlay} onMouseEnter={playHoverTick}><Icon name="trophy" size={20} /> {final ? 'Play the final' : 'Play match'}</button>
    </section>
  )
}

/** Both groups, the knockout once drawn, and when your next match is. */
export function CclPanel({ career }) {
  const c = career.ccl
  if (!c) return null
  const out = cclRun(c)
  const next = cclNext(c)
  const winner = cclWinner(c)
  return (
    <section className="card card-pad ccl-panel" aria-label={CCL_NAME}>
      <div className="ccl-head"><span aria-hidden>🏆</span><div><b>{CCL_NAME}</b><small>
        {out === 'won' ? 'Champions of everything!' : out ? `You went out in the ${out === 'group' ? 'group stage' : out === 'semi' ? 'semi-finals' : 'final'}${winner ? ` · ${winner} won it` : ''}`
          : next ? `Next: after league matchday ${next.opensAfter}` : 'Two groups of four · top two to the semis'}
      </small></div></div>
      <div className="ccl-groups">
        {c.groups.map((g, i) => (
          <div key={g.id} className="ccl-group">
            <small>Group {i ? 'B' : 'A'}</small>
            <ol>
              {standings(g).map((r, k) => (
                <li key={r.id} data-mine={i === 0 && r.id === ME ? 'true' : undefined} data-through={k < 2 ? 'true' : undefined}>
                  <i style={{ background: teamById(g, r.id)?.primary, borderColor: teamById(g, r.id)?.edge }} />
                  <span>{r.name}</span><b>{r.pts}</b>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}
