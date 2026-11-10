import { describe, it, expect } from 'vitest'
import { createSimulationWorld, keeperRead, crossingAt, REFLEX } from '../physics/WorldCore'
import { createLayouts } from '../physics/Layouts'
import { makeDynamicBody } from '../physics/WorldCore'
import { PITCH, PHYSICS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { longShotWobble, distanceToGoal, LONG_SHOT } from '../game/flick'
import { keeperReflex, reflexForRating, reflexOptions, REFLEX_LEVEL, DEFAULT_REFLEX } from '../game/keeper'

describe('long shots stray', () => {
  it('nothing near the box, the most from the far end, and only on hard flicks', () => {
    expect(longShotWobble(LONG_SHOT.near - 1, 1)).toBe(0)
    expect(longShotWobble(LONG_SHOT.far + 5, 1)).toBeCloseTo(LONG_SHOT.maxDeg)
    expect(longShotWobble(LONG_SHOT.far, 0.3)).toBe(0)
    expect(longShotWobble(18, 1)).toBeGreaterThan(longShotWobble(12, 1))
    expect(longShotWobble(NaN, 1)).toBe(0)
  })
  it('measures from the goal the cap attacks', () => {
    const state = { team1Side: 'left' }
    // team1 defends the left goal, so it attacks x = +halfW
    expect(distanceToGoal(state, 'team1_atk1', { x: PITCH.halfW - 5, y: 0 })).toBeCloseTo(5)
    expect(distanceToGoal(state, 'team2_atk1', { x: -PITCH.halfW + 5, y: 0 })).toBeCloseTo(5)
  })
})

describe('keeper reflex levels', () => {
  it('follows the computer level, a career rating, or medium', () => {
    expect(keeperReflex({ gameMode: 'ai', aiTeam: 'team2', aiDifficulty: 'hard' }, 'team2')).toBe(REFLEX_LEVEL.hard)
    expect(keeperReflex({ gameMode: 'ai', aiTeam: 'team2', aiDifficulty: 'hard' }, 'team1')).toBe(DEFAULT_REFLEX)
    expect(keeperReflex({ teamConfig: { team1: { ratings: { gk: 90 } } } }, 'team1')).toBeCloseTo(0.85)
    expect(reflexForRating(20)).toBeGreaterThanOrEqual(0.35)
  })
  it('is off for penalties and the daily puzzle', () => {
    expect(reflexOptions({ penaltyKick: true })).toBeNull()
    expect(reflexOptions({ penaltyShootout: true })).toBeNull()
    expect(reflexOptions({ challenge: {} })).toBeNull()
    expect(reflexOptions({ team1Side: 'left' }).reflex.team1).toBe(DEFAULT_REFLEX)
  })
})

describe('save reflex', () => {
  it('works out where a shot crosses the goal line', () => {
    expect(crossingAt(0, 0, 1, 0.1, 10)).toBeCloseTo(1)
    expect(crossingAt(0, 0, -1, 0, 10)).toBeNull()
  })
  it('reads long shots far more often than close ones, and the same shot the same way', () => {
    let near = 0, far = 0
    for (let i = 0; i < 400; i++) {
      const y = (i % 40) / 10 - 2
      if (keeperRead(0.65, 4, 0, PITCH.halfW - 4, y + i / 1000) !== null) near++
      if (keeperRead(0.65, 24, 0, PITCH.halfW - 24, y + i / 1000) !== null) far++
    }
    expect(far).toBeGreaterThan(near * 2)
    expect(keeperRead(0.65, 20, 1, 3, 1)).toBe(keeperRead(0.65, 20, 1, 3, 1))
    expect(keeperRead(0, 24, 0, 1, 1)).toBeNull()
  })

  /** Fire a long shot at the corner of team2's goal; did it go in? */
  function longShot(reflex, ballY) {
    const ballX = PITCH.halfW - 22
    const w = createSimulationWorld({
      ball: { x: ballX, y: ballY },
      team2_gk: { x: PITCH.halfW - 1.5, y: 0 },
    }, { team1Side: 'left', reflex })
    let dx = PITCH.halfW - ballX, dy = 2.2 - ballY
    const l = Math.hypot(dx, dy); dx /= l; dy /= l
    // Strike the ball as a full-power flick would
    const speed = PHYSICS.maxFlickVelocity * 1.2
    w.reset({ ball: { x: ballX, y: ballY, vx: dx * speed, vy: dy * speed }, team2_gk: { x: PITCH.halfW - 1.5, y: 0 } })
    for (let f = 0; f < 500; f++) {
      w.step(16)
      const b = w.bodies.ball.position
      if (b.x > PITCH.halfW + BALL_RADIUS) return Math.abs(b.y) < PITCH.goalWidth / 2
    }
    return false
  }
  it('saves more long shots than a keeper who just stands there', () => {
    let still = 0, sharp = 0
    for (let i = 0; i < 30; i++) {
      const y = -3 + i * 0.2
      if (longShot(null, y)) still++
      if (longShot({ team1: 0.85, team2: 0.85 }, y)) sharp++
    }
    expect(still).toBeGreaterThan(sharp)
  })
  it('keeps its tuning sensible', () => {
    expect(REFLEX.slide).toBeLessThan(1.8) // slower than a penalty dive
  })
})

describe('narrowing the angle', () => {
  function layouts(bodies) {
    const state = { team1Side: 'left' }
    return createLayouts(bodies, () => state, (p) => Object.assign(state, p))
  }
  it('steps out between the ball and the middle of his goal', () => {
    const gk = makeDynamicBody('team2_gk', PITCH.halfW - GK_RADIUS - 0.2, 0)
    const ball = makeDynamicBody('ball', PITCH.halfW - 9, 4)
    layouts({ team2_gk: gk, ball }).narrowAngles()
    expect(gk.position.x).toBeLessThan(PITCH.halfW - GK_RADIUS - 0.2) // came off his line
    expect(gk.position.y).toBeGreaterThan(0) // towards the ball's side
  })
  it('stays put when the ball is in the other half or he would land on a cap', () => {
    const gk = makeDynamicBody('team2_gk', PITCH.halfW - 1.5, 0)
    const ball = makeDynamicBody('ball', -3, 0)
    layouts({ team2_gk: gk, ball }).narrowAngles()
    expect(gk.position.x).toBeCloseTo(PITCH.halfW - 1.5)
    const gk2 = makeDynamicBody('team2_gk', PITCH.halfW - 1.5, 0)
    const ball2 = makeDynamicBody('ball', PITCH.halfW - 8, 0)
    const blocker = makeDynamicBody('team1_atk1', PITCH.halfW - 2.6, 0)
    const blocker2 = makeDynamicBody('team1_atk2', PITCH.halfW - 3.4, 0)
    layouts({ team2_gk: gk2, ball: ball2, team1_atk1: blocker, team1_atk2: blocker2 }).narrowAngles()
    expect(gk2.position.x).toBeCloseTo(PITCH.halfW - 1.5)
  })
})
