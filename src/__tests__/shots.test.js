import { describe, it, expect, beforeEach } from 'vitest'
import Matter from 'matter-js'
import { createPhysicsWorld, getBodies, resetToKickoff, stepPhysics, clampAllBodies, allBodiesSettled } from '../physics/PhysicsWorld'
import { useMatchStore, PHASE, clearMatchTimers } from '../state/MatchStore'
import { performFlick } from '../game/flick'
import { PITCH, PHYSICS } from '../data/TeamData'
import { shotCall } from '../game/shots'

const place = (id, x, y) => { Matter.Body.setPosition(getBodies()[id], { x, y }); Matter.Body.setVelocity(getBodies()[id], { x: 0, y: 0 }) }
function simulate(ms = 5000) {
  for (let t = 0; t < ms; t += 16) {
    for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(16 / PHYSICS.subSteps)
    clampAllBodies()
    if (t > 200 && allBodiesSettled()) break
  }
}
// Park everyone but the shooter, the ball and the keeper well away
function clearPitch() {
  for (const id of Object.keys(getBodies())) {
    if (id === 'ball' || id === 'team1_atk1' || id === 'team2_gk') continue
    const i = Object.keys(getBodies()).indexOf(id)
    place(id, -12 + (i % 6) * 2, i % 2 ? 8.5 : -8.5)
  }
}

describe('shot calls (rules)', () => {
  const H = PITCH.halfW
  it('a keeper stopping a goal-bound ball is a save; off target is not', () => {
    expect(shotCall({ ball: { x: H - 2, y: 0, vx: 1, vy: 0 }, other: { kind: 'keeper', team: 'team2' }, attackDir: 1, shooterTeam: 'team1' })).toBe('save')
    expect(shotCall({ ball: { x: H - 2, y: 0, vx: 1, vy: 2 }, other: { kind: 'keeper', team: 'team2' }, attackDir: 1, shooterTeam: 'team1' })).toBeNull()
    expect(shotCall({ ball: { x: H - 2, y: 0, vx: 1, vy: 0 }, other: { kind: 'cap', team: 'team2' }, attackDir: 1, shooterTeam: 'team1' })).toBe('block')
    expect(shotCall({ ball: { x: H - 2, y: 0, vx: 1, vy: 0 }, other: { kind: 'cap', team: 'team1' }, attackDir: 1, shooterTeam: 'team1' })).toBeNull()
  })
  it('the frame by the posts is the post; just outside is wide; elsewhere nothing', () => {
    expect(shotCall({ ball: { x: H - 0.3, y: PITCH.goalWidth / 2 + 0.3, vx: 1, vy: 0 }, other: { kind: 'wall' }, attackDir: 1, shooterTeam: 'team1' })).toBe('post')
    expect(shotCall({ ball: { x: H - 0.4, y: PITCH.goalWidth / 2 + 1.5, vx: 1, vy: 0 }, other: { kind: 'wall' }, attackDir: 1, shooterTeam: 'team1' })).toBe('wide')
    expect(shotCall({ ball: { x: 0, y: PITCH.halfH - 0.4, vx: 1, vy: 1 }, other: { kind: 'wall' }, attackDir: 1, shooterTeam: 'team1' })).toBeNull()
  })
})

describe('shot calls (in a match)', () => {
  beforeEach(() => {
    clearMatchTimers()
    useMatchStore.setState({ team1Side: 'left', matchEvents: [], shotCall: null, challenge: null, penaltyShootout: false })
    createPhysicsWorld()
  })
  const ready = () => useMatchStore.setState({ phase: PHASE.SELECT, activeTeam: 'team1', kickoffGuard: false, shotCalled: false })

  it('a shot straight at the keeper is called a save', () => {
    resetToKickoff('team1'); ready(); clearPitch()
    place('team2_gk', PITCH.halfW - 1.2, 0)
    place('ball', PITCH.halfW - 6, 0)
    place('team1_atk1', PITCH.halfW - 8, 0)
    performFlick('team1_atk1', { x: 2.2, y: 0 })
    simulate()
    const ev = useMatchStore.getState().matchEvents
    expect(ev.map((e) => e.type)).toContain('save')
    expect(ev.find((e) => e.type === 'save').by).toBe('team2_gk')
    expect(useMatchStore.getState().stats.team2.saves).toBe(1)
  })

  it('a shot against the post is called', () => {
    resetToKickoff('team1'); ready(); clearPitch()
    place('team2_gk', PITCH.halfW - 1.2, -2.5)
    const postY = PITCH.goalWidth / 2 + 0.35
    place('ball', PITCH.halfW - 5, postY)
    place('team1_atk1', PITCH.halfW - 7, postY)
    performFlick('team1_atk1', { x: 2.4, y: 0 })
    simulate()
    expect(useMatchStore.getState().matchEvents.map((e) => e.type)).toContain('post')
  })
})
