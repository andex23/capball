import { describe, it, expect, vi, afterEach } from 'vitest'
import Matter from 'matter-js'
import { createPhysicsWorld, getBodies, stepPhysics, getFoulPending } from '../physics/PhysicsWorld'
import { useMatchStore, PHASE, clearMatchTimers } from '../state/MatchStore'

afterEach(() => { clearMatchTimers(); vi.useRealTimers() })

describe('a whistled foul', () => {
  it('holds the flick until the free kick is given', () => {
    vi.useFakeTimers()
    createPhysicsWorld()
    const b = getBodies()
    // Park everything out of the way, then aim team1_atk1 straight at an opponent
    let x = -12
    for (const id of Object.keys(b)) { Matter.Body.setPosition(b[id], { x, y: -8.5 }); Matter.Body.setVelocity(b[id], { x: 0, y: 0 }); x += 2 }
    Matter.Body.setPosition(b.team1_atk1, { x: 0, y: 0 })
    Matter.Body.setPosition(b.team2_def1, { x: 3, y: 0 })
    useMatchStore.setState({ phase: PHASE.RESOLVE, activeTeam: 'team1', lastFlickedCapId: 'team1_atk1', firstCollisionTracked: false, penaltyShootout: false, challenge: null, paused: false })
    Matter.Body.setVelocity(b.team1_atk1, { x: 2, y: 0 })
    for (let i = 0; i < 400 && !getFoulPending(); i++) stepPhysics(1000 / 60 / 8)
    expect(getFoulPending()).toBe(true)
    expect(useMatchStore.getState().phase).toBe(PHASE.RESOLVE)
    vi.advanceTimersByTime(300)
    expect(getFoulPending()).toBe(false)
    expect(useMatchStore.getState().phase).toBe(PHASE.FOUL)
  })
})
