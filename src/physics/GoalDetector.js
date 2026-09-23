import { judgeGoal } from '../game/rules'
import { useMatchStore } from '../state/MatchStore'

/**
 * Check whether the ball is in a goal and whether that goal stands.
 * Returns { outcome: 'goal' | 'kickoff_violation' | 'gk_violation', scorer } or null.
 */
export function checkGoal(ballBody) {
  if (!ballBody) return null
  const { team1Side, kickoffGuard, lastFlickedCapId } = useMatchStore.getState()
  return judgeGoal({
    x: ballBody.position.x,
    y: ballBody.position.y,
    team1Side: team1Side || 'left',
    kickoffGuard,
    lastFlickedCapId,
  })
}
