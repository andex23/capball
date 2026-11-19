/**
 * The daily reward (seven days, one reward a day) and this week's three
 * goals, as sheets in the menu corner.
 */
import { useState } from 'react'
import { useRewardsStore } from '../state/rewardsStore'
import { useAccountStore } from '../state/accountStore'
import { useCareerStore } from '../state/careerStore'
import { DAILY_REWARDS, weekProgress, weekCap, weekKey, WEEK_BONUS, nextMysteryCap } from '../game/rewards'
import { isLagos } from '../platform'
import { dayKey } from '../game/daily'
import { money } from '../game/squad'
import { playConfirm } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

/** What a day's reward is, in two short words. */
function rewardLabel(r, hasCareer) {
  if (r.scout) return ['Scout report', '+ ' + money(r.coins)]
  if (r.cap) return ['Mystery cap', `+ ${money(r.coins)}`]
  if (r.fitness && hasCareer) return ['Fitness', 'Squad fully rested']
  return [money(r.coins), 'Club money']
}

export function DailyReward({ onClose }) {
  const daily = useRewardsStore((s) => s.daily)
  const caps = useRewardsStore((s) => s.caps)
  const signedIn = !!useAccountStore((s) => s.username)
  const saving = useAccountStore((s) => s.saving)
  const saveError = useAccountStore((s) => s.error)
  const hasCareer = !!useCareerStore((s) => s.career)
  const [got, setGot] = useState(null)
  const { day, ready } = useRewardsStore.getState().status(dayKey())
  const today = ready ? day : (day + DAILY_REWARDS.length - 1) % DAILY_REWARDS.length
  const mystery = nextMysteryCap(caps)
  const claim = () => {
    const r = useRewardsStore.getState().claim()
    if (r) { playConfirm(); setGot(r) }
  }
  void daily // re-render after a claim
  return (
    <section className="corner-sheet rw" role="dialog" aria-label="Daily reward">
      <header className="corner-sheet-head"><b>Daily reward</b><button className="corner-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></header>
      <div className="rw-body">
        <p className="rw-lead">Come back every day for a reward. Miss a day and you just carry on where you left off.</p>
        <ol className="rw-days">
          {DAILY_REWARDS.map((r, i) => {
            const [big, small] = rewardLabel(r, hasCareer)
            const state = i < today || (i === today && !ready) ? 'got' : i === today ? 'now' : 'later'
            return (
              <li key={i} data-state={state} data-cap={r.cap ? 'true' : undefined}>
                <small>{state === 'now' ? 'Today' : `Day ${i + 1}`}</small>
                {r.cap && mystery && <span className="rw-cap"><CapPreview config={mystery} size={44} /></span>}
                <b>{big}</b>
                <span>{state === 'got' ? '✓ Got it' : small}</span>
              </li>
            )
          })}
        </ol>
        {got ? (
          <p className="rw-got" role="status">
            {got.cap ? <>You won the <b>{got.cap.name}</b> cap! Pick it in Edit team. </> : null}
            {got.scout && <>One free report is ready in the career transfer market. </>}
            {got.fitness ? <>Your whole squad is fully rested.</> : null}
            {got.coins ? <><b>{money(got.coins)}</b> {hasCareer ? 'is in your career budget.' : 'is saved for your career budget.'}</> : null}
          </p>
        ) : !signedIn ? (
          <p className="rw-got">Sign in to collect daily rewards. It’s free.</p>
        ) : ready ? (
          <button className="btn btn-gold btn-lg btn-block" onClick={claim}>Collect day {day + 1}</button>
        ) : (
          <p className="rw-got">Come back tomorrow for day {day + 1}.</p>
        )}
        {isLagos() && (got || !ready) && (saving || saveError || got) && (
          <div aria-live="polite">
            {saving ? <p>Saving reward…</p> : saveError ? <>
              <p>Reward sync pending. {saveError}</p>
              <button className="btn btn-secondary" onClick={() => useAccountStore.getState().save()}>Retry save</button>
            </> : <p>Reward saved.</p>}
          </div>
        )}
        <p className="rw-note">Money goes into your career budget, for new players and club upgrades.</p>
      </div>
    </section>
  )
}

export function WeeklyGoals({ onClose }) {
  const week = useRewardsStore((s) => s.week)
  const key = weekKey()
  const goals = weekProgress(week, key)
  const done = goals.filter((g) => g.done).length
  const cap = weekCap(key)
  const have = done === goals.length
  const left = 7 - ((new Date().getDay() + 6) % 7)
  return (
    <section className="corner-sheet rw" role="dialog" aria-label="Weekly goals">
      <header className="corner-sheet-head"><b>Weekly goals</b><button className="corner-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></header>
      <div className="rw-body">
        <div className="rw-week-head"><span>{left === 1 ? 'Last day' : `${left} days left`} · new goals every Monday</span><b>{done}/3</b></div>
        <ul className="rw-goals">
          {goals.map((g) => (
            <li key={g.id} data-done={g.done ? 'true' : undefined}>
              <span className="rw-tick" aria-hidden>{g.done ? '✓' : ''}</span>
              <span className="rw-goal"><b>{g.title}</b><small>{g.sub}</small></span>
              <span className="rw-pay">{money(g.coins)}</span>
              <span className="rw-blocks" aria-label={`${g.have} of ${g.need}`}>
                {Array.from({ length: Math.min(g.need, 10) }, (_, i) => <i key={i} data-on={i < Math.round(g.have / g.need * Math.min(g.need, 10)) ? 'true' : undefined} />)}
              </span>
            </li>
          ))}
        </ul>
        <div className="rw-prize" data-won={have ? 'true' : undefined}>
          <CapPreview config={cap} size={72} />
          <div>
            <small>{have ? 'You won it!' : 'Finish all three'}</small>
            <b>{cap.name}</b>
            <span>{have ? 'Pick it in Edit team.' : `Plus ${money(WEEK_BONUS)}. A new cap every week.`}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
