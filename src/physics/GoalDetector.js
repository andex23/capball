import { judgeGoal } from '../game/rules'
import { useMatchStore } from '../state/MatchStore'
import { getBallBanked } from './PhysicsWorld'

/**
 * Check whether the ball is in a goal and whether that goal stands.
 * Returns { outcome: 'goal' | 'kickoff_violation' | 'goal_kick_violation' | 'bank_shot', scorer } or null.
 */
export function checkGoal(ballBody) {
  if (!ballBody) return null
  const { team1Side, kickoffGuard, goalKickGuard, lastFlickedCapId } = useMatchStore.getState()
  return judgeGoal({
    x: ballBody.position.x,
    y: ballBody.position.y,
    team1Side: team1Side || 'left',
    kickoffGuard,
    goalKickGuard,
    lastFlickedCapId,
    banked: getBallBanked(),
  })
}
