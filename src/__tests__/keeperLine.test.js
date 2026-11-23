import { describe, it, expect, beforeEach } from 'vitest'
import Matter from 'matter-js'
import { createPhysicsWorld, getBodies, setupFreeKick, narrowAngles } from '../physics/PhysicsWorld'
import { useMatchStore } from '../state/MatchStore'
import { radiusOf } from '../physics/WorldCore'
import { PITCH, GK_HALF_D } from '../data/TeamData'

const gap = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) - radiusOf(a.label) - radiusOf(b.label)

describe('keepers and free kicks', () => {
  beforeEach(() => { useMatchStore.setState({ team1Side: 'left' }); createPhysicsWorld() })

  it('a free kick out wide by the goal line doesn’t put the keeper next to the ball', () => {
    for (const y of [-8, -6, 6, 8]) {
      setupFreeKick({ x: 12, y }, 'team1')
      const B = getBodies()
      expect(gap(B.team2_gk, B.ball)).toBeGreaterThan(2)
    }
  })

  it('no opponent crowds a free kick anywhere outside the box', () => {
    for (let x = -12; x <= 10; x += 2) for (let y = -8; y <= 8; y += 2) {
      setupFreeKick({ x, y }, 'team1')
      const B = getBodies()
      for (const id of Object.keys(B)) if (id.startsWith('team2')) expect(gap(B[id], B.ball)).toBeGreaterThan(1.5)
    }
  })

  it('a keeper pushed into his own net gets back to his line', () => {
    const B = getBodies()
    // team2 defends the right-hand goal; ball far away up the other end
    Matter.Body.setPosition(B.ball, { x: -8, y: 0 })
    Matter.Body.setPosition(B.team2_gk, { x: PITCH.halfW + 0.8, y: 1.2 })
    narrowAngles()
    expect(B.team2_gk.position.x).toBeLessThanOrEqual(PITCH.halfW - GK_HALF_D)
    expect(B.team2_gk.position.x).toBeGreaterThan(PITCH.halfW - 1)
    // ...and with the ball close by too
    Matter.Body.setPosition(B.ball, { x: 9, y: 2 })
    Matter.Body.setPosition(B.team2_gk, { x: PITCH.halfW + 0.8, y: -1 })
    narrowAngles()
    expect(B.team2_gk.position.x).toBeLessThanOrEqual(PITCH.halfW - GK_HALF_D)
  })

  it('a keeper left out of position drifts home when the ball is away', () => {
    const B = getBodies()
    Matter.Body.setPosition(B.ball, { x: -8, y: 0 })
    Matter.Body.setPosition(B.team2_gk, { x: 11, y: 3 })
    narrowAngles()
    expect(B.team2_gk.position.x).toBeCloseTo(PITCH.halfW - GK_HALF_D - 0.1, 1)
  })
})
