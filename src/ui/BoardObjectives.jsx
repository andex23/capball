import { TARGETS, TARGET_BONUS, PROMOTED, TOP, DIVISIONS, CUP_NAME, CUP_PRIZE, targetMet, myPosition, seasonOver, spendingFrozen, playedThisSeason } from '../game/career'
import { money } from '../game/squad'

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * What the board expects of you this season, and how you're doing: the
 * league target (with the sack if you miss it twice), keeping the books out
 * of the red, and the bonuses on offer.
 */
export default function BoardObjectives({ career }) {
  const count = career.league.teams.length
  const pos = myPosition(career.league)
  const played = playedThisSeason(career.league)
  const target = career.target
  const onTrack = target ? targetMet(target, pos, count) : true
  const done = seasonOver(career.league)
  const frozen = spendingFrozen(career)
  const division = DIVISIONS[career.level].name
  const status = !played ? 'Season not started' : onTrack ? (done ? 'Met' : 'On track') : (done ? 'Missed' : 'Off track')
  const tone = !played ? '' : onTrack ? 'good' : 'bad'
  return (
    <section className="card card-pad board-card" aria-label="Board objectives">
      <h2 className="saved-h">Board objectives</h2>
      {career.warning && <p className="club-alert" role="alert">Final warning: you missed last season’s target. Miss this one and you’re sacked.</p>}
      <ul className="board-list">
        {target && (
          <li data-tone={tone}>
            <span className="board-what">
              <b>{TARGETS[target]}</b>
              <small>{career.level < TOP ? `Top ${PROMOTED} in the ${division} go up.` : `Win the ${division}.`} You’re {played ? ordinal(pos) : 'yet to play'}{played ? ` of ${count}` : ''}. Miss it and you get a final warning; miss twice and you’re sacked.</small>
            </span>
            <span className="board-status">{status}</span>
          </li>
        )}
        <li data-tone={frozen ? 'bad' : 'good'}>
          <span className="board-what">
            <b>Keep the books out of the red</b>
            <small>Below zero, the board freezes transfers and building until you’re back in profit.</small>
          </span>
          <span className="board-status">{frozen ? 'In the red' : money(career.coins)}</span>
        </li>
        <li>
          <span className="board-what">
            <b>Go far in the {CUP_NAME}</b>
            <small>Not required, but it pays: {money(CUP_PRIZE.won)} to win it, {money(CUP_PRIZE.final)} for the final.</small>
          </span>
          <span className="board-status">Bonus</span>
        </li>
      </ul>
      {target && <p className="muted t-note">Meet the league target for a <b>{money(TARGET_BONUS[target])}</b> board bonus at the end of the season.</p>}
    </section>
  )
}
