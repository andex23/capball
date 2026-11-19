import { TARGETS, TARGET_BONUS, PROMOTED, CUP_NAME, CUP_PRIZE, targetMet, myPosition, seasonOver, playedThisSeason } from '../game/career'
import { money } from '../game/squad'
import Icon from './Icon'

export default function BoardObjectives({ career }) {
  const target = career.target
  if (!target) return null
  const played = playedThisSeason(career.league)
  const pos = myPosition(career.league)
  const count = career.league.teams.length
  const met = targetMet(target, pos, count)
  const done = seasonOver(career.league)
  const title = target === 'promotion' ? 'Finish in the top ' + PROMOTED : TARGETS[target]
  return <>
    {career.warning && <p className="club-alert" role="alert">Final warning. Miss this target and you lose your job.</p>}
    <details className="club-target">
      <summary><Icon name="trophy" size={20} /><span><small>Season target</small><strong>{title}</strong></span><Icon name="next" size={16} /></summary>
      <div>
        {played > 0 && <p>League position <b>{pos} of {count}</b> · {done ? (met ? 'Target met' : 'Target missed') : (met ? 'On track' : 'Outside target')}</p>}
        <p>Board bonus <b>{money(TARGET_BONUS[target])}</b> at season end.</p>
        {!career.warning && <p>Miss two seasons in a row and you lose your job.</p>}
        <p>{CUP_NAME} prizes · Winners <b>{money(CUP_PRIZE.won)}</b> · Runners-up <b>{money(CUP_PRIZE.final)}</b></p>
      </div>
    </details>
  </>
}
