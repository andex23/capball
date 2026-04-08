import { PITCH } from '../data/TeamData'
import { useMatchStore } from '../state/MatchStore'

const { halfW, goalWidth } = PITCH
const goalHalf = goalWidth / 2

// Track if there has been at least one ball touch since kickoff
// (a ball touch = any cap collided with ball)
let ballTouchedSinceKickoff = false
let turnCount = 0

export function markBallTouched() {
  ballTouchedSinceKickoff = true
}

export function resetKickoffProtection() {
  ballTouchedSinceKickoff = false
  turnCount = 0
}

export function incrementTurnCount() {
  turnCount++
  // After first turn completes (kickoff taker flicked), allow goals on subsequent turns
  if (turnCount >= 2) {
    ballTouchedSinceKickoff = true
  }
}

/**
 * Check if the ball has crossed either goal line.
 *
 * Goal sides:
 *   LEFT goal (x < -halfW):  Team1's defensive goal → TEAM2 scores
 *   RIGHT goal (x > halfW):  Team2's defensive goal → TEAM1 scores
 *
 * Returns: 'team1' | 'team2' | 'gk_violation' | 'kickoff_violation' | null
 */
export function checkGoal(ballBody) {
  if (!ballBody) return null

  const { x, y } = ballBody.position

  if (Math.abs(y) >= goalHalf) return null

  // Determine which team scores based on side selection
  const team1Side = useMatchStore.getState().team1Side || 'left'
  let scorer = null

  if (team1Side === 'left') {
    // team1 defends LEFT goal, team2 defends RIGHT goal
    if (x < -halfW) scorer = 'team2'
    if (x > halfW) scorer = 'team1'
  } else {
    // team1 defends RIGHT goal, team2 defends LEFT goal
    if (x < -halfW) scorer = 'team1'
    if (x > halfW) scorer = 'team2'
  }

  if (!scorer) return null

  // No goal directly from kickoff — need at least one completed turn after kickoff
  if (!ballTouchedSinceKickoff) {
    return 'kickoff_violation'
  }

  // GK restriction: GKs cannot score goals
  const lastFlicked = useMatchStore.getState().lastFlickedCapId
  if (lastFlicked && lastFlicked.endsWith('_gk')) {
    return 'gk_violation'
  }

  return scorer
}
