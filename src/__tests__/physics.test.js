import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Matter from 'matter-js'
import {
  createPhysicsWorld, getBodies, resetToKickoff, setupFreeKick, setupPenalty,
  clampAllBodies, stepPhysics, allBodiesSettled, radiusOf, snapshotBodies, applyBodySnapshot,
} from '../physics/PhysicsWorld'
import { checkGoal } from '../physics/GoalDetector'
import { useMatchStore, PHASE, clearMatchTimers } from '../state/MatchStore'
import { performFlick } from '../game/flick'
import { PITCH, PHYSICS, FORMATIONS, getFormationPositions } from '../data/TeamData'
import { teamHomeDir, teamOf } from '../game/rules'

const initial = useMatchStore.getState()
const store = () => useMatchStore.getState()
const pos = (id) => getBodies()[id].position
const capIds = () => Object.keys(getBodies()).filter((id) => id !== 'ball')

function simulate(ms = 6000) {
  for (let t = 0; t < ms; t += 16) {
    for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(16 / PHYSICS.subSteps)
    clampAllBodies()
    if (t > 200 && allBodiesSettled()) break
  }
}

function place(id, x, y) {
  Matter.Body.setPosition(getBodies()[id], { x, y })
  Matter.Body.setVelocity(getBodies()[id], { x: 0, y: 0 })
}

/** Park every body except `keep` in a row along the bottom so it can't interfere */
function isolate(...keep) {
  let x = -12
  for (const id of Object.keys(getBodies())) {
    if (keep.includes(id) || id.endsWith('_gk')) continue
    place(id, x, -8.5)
    x += 2.5
  }
}

function expectNoOverlaps() {
  const ids = Object.keys(getBodies())
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = pos(ids[i])
      const b = pos(ids[j])
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      expect(d, `${ids[i]} overlaps ${ids[j]}`).toBeGreaterThanOrEqual(radiusOf(ids[i]) + radiusOf(ids[j]) - 0.01)
    }
  }
}

function expectInsidePitch() {
  for (const id of capIds()) {
    const p = pos(id)
    expect(Math.abs(p.x), id).toBeLessThanOrEqual(PITCH.halfW)
    expect(Math.abs(p.y), id).toBeLessThanOrEqual(PITCH.halfH)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  clearMatchTimers()
  useMatchStore.setState(initial, true)
  createPhysicsWorld()
})
afterEach(() => {
  clearMatchTimers()
  vi.useRealTimers()
})

describe('kick-off layout', () => {
  const cases = []
  for (const formation of Object.keys(FORMATIONS)) {
    for (const side of ['left', 'right']) {
      for (const kicker of ['team1', 'team2']) cases.push([formation, side, kicker])
    }
  }

  it.each(cases)('%s, team1 %s, %s kicking: legal and tidy', (formation, side, kicker) => {
    useMatchStore.setState({ formations: { team1: formation, team2: formation }, team1Side: side })
    resetToKickoff(kicker)

    expect(pos('ball')).toMatchObject({ x: 0, y: 0 })
    for (const id of capIds()) {
      const team = teamOf(id)
      const home = teamHomeDir(team, side)
      const p = pos(id)
      // Everyone in their own half
      expect(Math.sign(p.x), `${id} in own half`).toBe(home)
      // Defending side outside the centre circle
      if (team !== kicker) {
        expect(Math.hypot(p.x, p.y), `${id} outside circle`).toBeGreaterThanOrEqual(PITCH.centerCircleR)
      }
    }
    // Kicker is right next to the ball
    const k = pos(`${kicker}_atk1`)
    expect(Math.hypot(k.x, k.y)).toBeLessThan(2)
    expectNoOverlaps()
    expectInsidePitch()
  })

  it('uses the chosen formation (it used to be ignored)', () => {
    useMatchStore.setState({ formations: { team1: 'default', team2: 'diamond' }, team1Side: 'left' })
    resetToKickoff('team1')
    const expected = getFormationPositions('team2', 'diamond', 'left')
    expect(pos('team2_def1').x).toBeCloseTo(expected.def1.x, 1)
    expect(pos('team2_def1').y).toBeCloseTo(expected.def1.y, 1)
  })
})

describe('set pieces', () => {
  it('free kick: ball on the spot, only the taker near it, taker locked in', () => {
    useMatchStore.setState({ team1Side: 'left' })
    resetToKickoff('team1')
    setupFreeKick({ x: 5, y: 2 }, 'team1')
    expect(pos('ball')).toMatchObject({ x: 5, y: 2 })
    expect(store().freeKickCapId).toBe('team1_atk1')
    for (const id of capIds()) {
      if (id === 'team1_atk1') continue
      const d = Math.hypot(pos(id).x - 5, pos(id).y - 2)
      expect(d, `${id} too close to the free kick`).toBeGreaterThanOrEqual(3.5)
    }
    expectNoOverlaps()
    expectInsidePitch()
  })

  it('free kick right by the wall still keeps the ball on the pitch', () => {
    setupFreeKick({ x: 14.9, y: -9.9 }, 'team2')
    expect(Math.abs(pos('ball').x)).toBeLessThan(PITCH.halfW)
    expect(Math.abs(pos('ball').y)).toBeLessThan(PITCH.halfH)
    expectInsidePitch()
  })

  it('penalty: ball on the spot of the defending goal, keeper on the line', () => {
    useMatchStore.setState({ team1Side: 'left' })
    setupPenalty('team1') // team1 attacks the right goal
    expect(pos('ball').x).toBeCloseTo(PITCH.halfW - PITCH.penSpotDist)
    expect(pos('ball').y).toBeCloseTo(0)
    expect(pos('team2_gk').x).toBeGreaterThan(PITCH.halfW - 2)
    expect(store().freeKickCapId).toBe('team1_atk1')
    // Both keepers start inside their own penalty areas
    expect(pos('team1_gk').x).toBeLessThan(-PITCH.halfW + PITCH.penAreaW)
    expect(pos('team2_gk').x).toBeGreaterThan(PITCH.halfW - PITCH.penAreaW)
    expectNoOverlaps()
  })
})

describe('goalkeeper confinement', () => {
  it('keeps each keeper in its own penalty area, and follows a change of ends', () => {
    useMatchStore.setState({ team1Side: 'left' })
    place('team1_gk', 0, 8)
    clampAllBodies()
    expect(pos('team1_gk').x).toBeLessThan(-PITCH.halfW + PITCH.penAreaW)
    expect(Math.abs(pos('team1_gk').y)).toBeLessThan(PITCH.penAreaH / 2)

    useMatchStore.setState({ team1Side: 'right' })
    resetToKickoff('team2')
    clampAllBodies()
    expect(pos('team1_gk').x).toBeGreaterThan(PITCH.halfW - PITCH.penAreaW)
  })
})

describe('simulated play', () => {
  function readyTurn(team = 'team1') {
    useMatchStore.setState({ phase: PHASE.SELECT, activeTeam: team, team1Side: 'left', kickoffGuard: false })
  }

  it('a flick into the ball moves it and counts a shot', () => {
    resetToKickoff('team1')
    readyTurn()
    place('team1_atk1', -3, 0)
    expect(performFlick('team1_atk1', { x: 4, y: 0 })).toBeNull()
    expect(store().phase).toBe(PHASE.RESOLVE)
    simulate()
    expect(pos('ball').x).toBeGreaterThan(1)
    expect(store().stats.team1.shots).toBe(1)
    expect(store().firstCollisionTracked).toBe(true)
  })

  it('hitting an opponent first is a foul', () => {
    resetToKickoff('team1')
    readyTurn()
    isolate('team1_atk1', 'team2_atk1')
    place('team1_atk1', -3, 5)
    place('team2_atk1', 1, 5)
    expect(performFlick('team1_atk1', { x: 4, y: 0 })).toBeNull()
    simulate(1500)
    vi.advanceTimersByTime(400)
    expect(store().phase).toBe(PHASE.FOUL)
    expect(store().foulData).toMatchObject({ fouledTeam: 'team2', inPenaltyBox: false })
  })

  it('bouncing off the cushion first does not decide the contact', () => {
    resetToKickoff('team1')
    readyTurn()
    isolate('team1_atk1')
    place('team1_atk1', -3, 8)
    // Gentle flick into the top cushion — the only contact is the wall
    expect(performFlick('team1_atk1', { x: 0, y: 1.5 })).toBeNull()
    simulate(2000)
    expect(store().firstCollisionTracked).toBe(false)
  })

  it('a shot into the goal is detected as a goal for the attacking team', () => {
    resetToKickoff('team1')
    readyTurn()
    // Clear the keeper out of the way and line up a shot at the right goal
    place('team2_gk', PITCH.halfW - 1.2, 5)
    place('ball', PITCH.halfW - 3, 0)
    place('team1_atk1', PITCH.halfW - 5, 0)
    performFlick('team1_atk1', { x: 4.5, y: 0 })
    let verdict = null
    for (let t = 0; t < 4000 && !verdict; t += 16) {
      for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(16 / PHYSICS.subSteps)
      clampAllBodies()
      verdict = checkGoal(getBodies().ball)
    }
    expect(verdict).toEqual({ outcome: 'goal', scorer: 'team1' })
  })

  it('caps can never leave the pitch through a goal mouth', () => {
    resetToKickoff('team1')
    readyTurn()
    place('team1_atk1', PITCH.halfW - 3, 0)
    place('team2_gk', PITCH.halfW - 1.2, 5)
    place('ball', 0, 8)
    performFlick('team1_atk1', { x: 4.5, y: 0 })
    simulate()
    expect(pos('team1_atk1').x).toBeLessThanOrEqual(PITCH.halfW)
  })
})

describe('online snapshots', () => {
  it('round-trips positions and ignores bad data', () => {
    resetToKickoff('team1')
    const snap = snapshotBodies()
    createPhysicsWorld() // back to formation positions
    applyBodySnapshot({ ...snap, ball: [NaN, 1], hacker: [0, 0] })
    expect(pos('team1_atk1').x).toBeCloseTo(snap.team1_atk1[0], 2)
    expect(Number.isFinite(pos('ball').x)).toBe(true)
    expect(getBodies().hacker).toBeUndefined()
  })
})
