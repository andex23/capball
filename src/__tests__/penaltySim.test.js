import { describe, it, expect } from 'vitest'
import { createPhysicsWorld, getBodies, setupPenalty, applyFlick, stepPhysics, allBodiesSettled, clampAllBodies, diveKeeper } from '../physics/PhysicsWorld'
import { useMatchStore } from '../state/MatchStore'
import { checkGoal } from '../physics/GoalDetector'
import { PHYSICS, PITCH, CAP_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { penaltyFlick } from '../game/penalty'

// One penalty by team1 at the right goal: the taker aims at targetSide, the keeper dives `dive`
function penalty(targetSide, dive) {
  useMatchStore.setState({ team1Side: 'left', penaltyShootout: true })
  createPhysicsWorld()
  setupPenalty('team1')
  const b = getBodies()
  const rng = (() => { const seq = [0, targetSide > 0 ? 0.9 : 0.1, 0.5, 1]; let i = 0; return () => seq[i++ % seq.length] })()
  const v = penaltyFlick({ cap: b.team1_atk1.position, ball: b.ball.position, rSum: CAP_RADIUS + BALL_RADIUS, goalX: PITCH.halfW, goalWidth: PITCH.goalWidth, level: 'hard', maxSpeed: PHYSICS.maxFlickVelocity, rng })
  applyFlick('team1_atk1', v)
  diveKeeper('team2', dive)
  for (let i = 0; i < 600; i++) {
    for (let j = 0; j < PHYSICS.subSteps; j++) stepPhysics(16 / PHYSICS.subSteps)
    clampAllBodies()
    const g = checkGoal(b.ball)
    if (g) return g.scorer === 'team1'
    if (i > 30 && allBodiesSettled()) break
  }
  return false
}

describe('penalties as a guessing game', () => {
  it('a well-struck corner beats a keeper who stays, and one who dives the wrong way', () => {
    for (const side of [-1, 1]) {
      expect(penalty(side, 0)).toBe(true)
      expect(penalty(side, -side)).toBe(true)
    }
  })
  it('a keeper who guesses the right corner saves it', () => {
    for (const side of [-1, 1]) expect(penalty(side, side)).toBe(false)
  })
})
