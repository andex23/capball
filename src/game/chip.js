/**
 * Chip shots: the rules for when a cap may chip. Double-tap a cap to arm it
 * (a small ⤴ on the cap, no buttons); the flick then lifts the ball if the
 * cap strikes it first. Each side has CHIPS_PER_HALF a half, only in the
 * half it attacks, only from a cap close to the ball, never a keeper, and not
 * in penalties, the daily challenge or saved anytime matches.
 * The flight itself is in physics/WorldCore (attachChipFlight).
 */
import { CAP_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { teamOf, isGoalkeeper, teamHomeDir } from './rules'

export const CHIPS_PER_HALF = 3
/** How far (centre to centre) a cap may be from the ball to chip it. */
export const CHIP_RANGE = CAP_RADIUS + BALL_RADIUS + 1.6

/** Why this cap can't chip now, or null if it can. ball/cap: {x, y}. */
export function chipError(state, capId, ball, cap) {
  if (state.penaltyKick || state.penaltyShootout || state.challenge || state.gameMode === 'anytime') return 'not-here'
  const team = teamOf(capId)
  if (!team || team !== state.activeTeam) return 'not-your-cap'
  if (isGoalkeeper(capId)) return 'keeper'
  // (unlimited in the Training Ground)
  if (!state.training && (state.chipsLeft?.[team] ?? CHIPS_PER_HALF) <= 0) return 'none-left'
  if (!ball || !cap) return 'no-ball'
  // Only in the half you attack
  if (ball.x * teamHomeDir(team, state.team1Side || 'left') > 0) return 'own-half'
  if (Math.hypot(cap.x - ball.x, cap.y - ball.y) > CHIP_RANGE) return 'too-far'
  return null
}
