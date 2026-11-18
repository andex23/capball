import { describe, it, expect } from 'vitest'
import Matter from 'matter-js'
import { createPhysicsWorld, getEngine, getBodies, setShotStray } from '../physics/PhysicsWorld'

const pair = (a, b) => ({ bodyA: getBodies()[a], bodyB: getBodies()[b], collision: { normal: { x: 1, y: 0 }, depth: 0 }, contacts: [], activeContacts: [] })

describe('a long shot\'s drift', () => {
  it('survives several contacts starting in the same step', () => {
    createPhysicsWorld()
    setShotStray('team1_atk1', 4, 0.9)
    // The cap touches a defender first (the drift is dropped), and another contact starts in the same step
    expect(() => Matter.Events.trigger(getEngine(), 'collisionStart', { pairs: [pair('team1_atk1', 'team2_def1'), pair('team2_mid', 'team2_def2')] })).not.toThrow()
  })
})
