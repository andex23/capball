/**
 * Near misses: decide whether a ball collision during a shot deserves a call
 * ("Off the post!", "Just wide!", "Saved!", "Blocked!"). Pure, so it can be
 * tested without the physics engine.
 */
import { PITCH, BALL_RADIUS } from '../data/TeamData'

const GOAL_HALF = PITCH.goalWidth / 2
// Engine velocities are per physics step: a firm shot is about 0.3, a dribble under 0.05
const MIN_SPEED = 0.06

/** Where a ball moving in a straight line crosses the goal line (or null if it's going the other way). */
export function crossingAt(ball, goalX) {
  if (Math.abs(ball.vx) < 1e-6) return null
  const t = (goalX - ball.x) / ball.vx
  if (t <= 0) return null
  return ball.y + ball.vy * t
}

/**
 * `ball`: { x, y, vx, vy } just as it meets `other`.
 * `other`: { kind: 'wall' | 'keeper' | 'cap', team }.
 * `attackDir`: +1 if the shooting side attacks the right-hand goal, -1 the left.
 * Returns 'post' | 'wide' | 'save' | 'block' | null.
 */
export function shotCall({ ball, other, attackDir, shooterTeam }) {
  const goalX = attackDir * PITCH.halfW
  const speed = Math.hypot(ball.vx, ball.vy)
  const towardGoal = ball.vx * attackDir > 0
  if (other.kind === 'wall') {
    // Only the frame right by the goal mouth: the posts, or the end line just outside them
    if (Math.abs(ball.x - goalX) > BALL_RADIUS + 0.6) return null
    const ay = Math.abs(ball.y)
    const toPost = Math.hypot(ball.x - goalX, ay - GOAL_HALF)
    if (toPost < BALL_RADIUS + 0.35) return 'post'
    if (ay > GOAL_HALF && ay < GOAL_HALF + 2.2 && speed > MIN_SPEED * 0.6) return 'wide'
    return null
  }
  // A defender stops a ball that was heading inside the posts
  if (!towardGoal || speed < MIN_SPEED || other.team === shooterTeam) return null
  if (Math.abs(goalX - ball.x) > PITCH.halfW) return null // still in its own half: not a shot yet
  const y = crossingAt(ball, goalX)
  if (y === null || Math.abs(y) > GOAL_HALF - 0.1) return null
  return other.kind === 'keeper' ? 'save' : 'block'
}
