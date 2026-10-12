import { useEffect, useRef } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { useDailyStore, playDaily, liveStreak } from '../state/dailyStore'
import { playButtonSelect, playConfirm, playGoal } from '../audio/SoundManager'
import { stopAllBodies } from '../physics/PhysicsWorld'
import Icon from './Icon'
import GoalClips from './GoalClips'

/** Daily challenge: what to do, flicks left, and the result at the end. */
export default function ChallengeHud() {
  const challenge = useMatchStore((s) => s.challenge)
  const phase = useMatchStore((s) => s.phase)
  const paused = useMatchStore((s) => s.paused)
  const daily = useDailyStore()
  const counted = useRef(null)

  // Count the attempt once, when it ends
  useEffect(() => {
    if (phase !== PHASE.CHALLENGE_DONE || !challenge || counted.current === challenge) return
    counted.current = challenge
    useDailyStore.getState().finish(challenge.won)
    if (challenge.won) playGoal()
  }, [phase, challenge])

  if (!challenge || paused) return null
  const done = phase === PHASE.CHALLENGE_DONE

  if (!done) {
    return (
      <div className="challenge-card" role="status">
        <div className="challenge-tab">Daily challenge</div>
        <b>{challenge.name}</b>
        <span className="challenge-flicks" aria-label={`${challenge.flicksLeft} flicks left`}>
          {Array.from({ length: challenge.flicks }, (_, i) => <i key={i} data-used={i >= challenge.flicksLeft ? 'true' : undefined} />)}
        </span>
        <small>{challenge.text} Score in {challenge.flicks} flick{challenge.flicks === 1 ? '' : 's'}.</small>
      </div>
    )
  }

  const streak = liveStreak(daily)
  return (
    <div className="challenge-done" role="dialog" aria-label="Challenge result" data-won={challenge.won ? 'true' : 'false'}>
      <div className="challenge-tab">Daily challenge</div>
      <h2 className="display">{challenge.won ? 'Challenge beaten!' : 'Out of flicks'}</h2>
      <p>{challenge.won
        ? `${streak} day${streak === 1 ? '' : 's'} in a row. Best streak: ${daily.best}. Come back tomorrow for a new one.`
        : 'So close. Have another go — it only counts once you score.'}</p>
      {challenge.won && <GoalClips limit={1} />}
      <div className="challenge-actions">
        <button className="btn btn-gold" onClick={() => { playConfirm(); stopAllBodies(); playDaily() }}><Icon name="restart" size={18} /> {challenge.won ? 'Play again' : 'Try again'}</button>
        <button className="btn btn-secondary" onClick={() => { playButtonSelect(); stopAllBodies(); useMatchStore.getState().leaveChallenge() }}><Icon name="exit" size={18} /> Menu</button>
      </div>
    </div>
  )
}
