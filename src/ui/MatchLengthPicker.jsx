import { useMatchStore, MATCH_DURATIONS, GOAL_TARGETS } from '../state/MatchStore'
import { formatClock } from '../game/rules'
import { playButtonSelect } from '../audio/SoundManager'

/**
 * How a match ends: on the clock (1 to 3 minutes) or first to 3 / 5 goals.
 * Used on the venue screen and again right before kick-off.
 */
export default function MatchLengthPicker({ disabled = false, compact = false }) {
  const matchDuration = useMatchStore((s) => s.matchDuration)
  const goalTarget = useMatchStore((s) => s.goalTarget)
  const { setMatchDuration, setGoalTarget } = useMatchStore.getState()
  const pick = (fn) => () => { playButtonSelect(); fn() }

  return (
    <div className={`match-length${compact ? ' compact' : ''}`}>
      <div className="segmented stretch" role="group" aria-label="How the match ends">
        <button aria-pressed={!goalTarget} disabled={disabled} onClick={pick(() => setGoalTarget(0))}>On the clock</button>
        {GOAL_TARGETS.map((n) => (
          <button key={n} aria-pressed={goalTarget === n} disabled={disabled} onClick={pick(() => setGoalTarget(n))}>First to {n}</button>
        ))}
      </div>
      {!goalTarget && (
        <div className="segmented stretch" role="group" aria-label="Match length" style={{ marginTop: 6 }}>
          {MATCH_DURATIONS.map((d) => (
            <button key={d} aria-pressed={matchDuration === d} disabled={disabled} onClick={pick(() => setMatchDuration(d))}>
              {formatClock(d)}
            </button>
          ))}
        </div>
      )}
      <p className="muted match-length-note">
        {goalTarget
          ? `The first side to score ${goalTarget} wins. No clock.`
          : `Two halves of ${formatClock(matchDuration / 2)}. The clock stops between turns.`}
      </p>
    </div>
  )
}
