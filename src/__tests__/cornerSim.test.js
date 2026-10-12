import { describe, it, expect } from 'vitest'
import Matter from 'matter-js'
import { createPhysicsWorld, getBodies, clampAllBodies, stepPhysics, allBodiesSettled } from '../physics/PhysicsWorld'
import { PITCH, PHYSICS } from '../data/TeamData'
import { ballInCorner } from '../game/rules'

function simulate(ms = 8000) {
  for (let t = 0; t < ms; t += 16) {
    for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(16 / PHYSICS.subSteps)
    clampAllBodies()
    if (t > 200 && allBodiesSettled()) break
  }
}
const ball = () => getBodies().ball

/** Clear the corner area and roll the ball into it from (x, y) at a speed fraction. */
function rollIntoCorner(x, y, speed) {
  createPhysicsWorld()
  let px = -12
  for (const id of Object.keys(getBodies())) {
    if (id === 'ball') continue
    Matter.Body.setPosition(getBodies()[id], { x: px, y: -8.5 }); Matter.Body.setVelocity(getBodies()[id], { x: 0, y: 0 }); px += 2.5
  }
  Matter.Body.setPosition(ball(), { x, y })
  const dx = PITCH.halfW - x, dy = PITCH.halfH - y, d = Math.hypot(dx, dy)
  const v = PHYSICS.maxFlickVelocity * speed
  Matter.Body.setVelocity(ball(), { x: (dx / d) * v, y: (dy / d) * v })
  simulate()
  return ballInCorner(ball().position.x, ball().position.y)
}

describe('a ball that stops in the corner is called', () => {
  it('a soft roll that dies in the corner gives a corner or goal kick', () => {
    for (const [x, y] of [[9, 4], [10, 6], [12, 5], [8, 7]]) {
      expect(rollIntoCorner(x, y, 0.45), `from ${x},${y}`).toBeTruthy()
    }
  })
  it('a hard hit that bounces back out of the corner stays in play', () => {
    for (const [x, y] of [[9, 4], [12, 5]]) {
      expect(rollIntoCorner(x, y, 1), `from ${x},${y}`).toBeNull()
    }
  })
})
