import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Matter from 'matter-js'
import {
  createPhysicsWorld, getBodies, resetToKickoff, setupFreeKick, setupPenalty,
  FREE_KICK_WALL_DISTANCE, FREE_KICK_WALL_MIN, setupCorner, setupGoalKick,
  clampAllBodies, stepPhysics, allBodiesSettled, radiusOf, snapshotBodies, applyBodySnapshot, getEngine, getGoalEvidence,
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

  it('free kick in the taker\'s own half: the wall stands well back, between ball and goal', () => {
    useMatchStore.setState({ team1Side: 'left' })
    resetToKickoff('team1')
    setupFreeKick({ x: -8, y: 3 }, 'team1') // team1 attacks the right goal from its own half
    const wall = ['team2_def1'] // far out: a one-cap wall
    for (const id of wall) {
      const d = Math.hypot(pos(id).x + 8, pos(id).y - 3)
      expect(d, `${id} wall distance`).toBeGreaterThan(FREE_KICK_WALL_DISTANCE - 1.5)
      expect(pos(id).x, `${id} is between ball and goal`).toBeGreaterThan(-8)
    }
    // Every other opponent keeps at least that distance too
    for (const id of capIds()) {
      if (!id.startsWith('team2_') || id === 'team2_gk') continue
      expect(Math.hypot(pos(id).x + 8, pos(id).y - 3), id).toBeGreaterThanOrEqual(FREE_KICK_WALL_DISTANCE - 1.5)
    }
    expectNoOverlaps()
    expectInsidePitch()
  })

  it('free kick near the box: the wall still stands between ball and goal, off the ball', () => {
    useMatchStore.setState({ team1Side: 'left' })
    resetToKickoff('team1')
    setupFreeKick({ x: 4, y: -1 }, 'team1') // 11 from the goal line: the full distance doesn't fit
    // 11 out: a one-cap wall (the rest wait back behind the ball)
    for (const id of ['team2_def1']) {
      expect(pos(id).x, `${id} between ball and goal`).toBeGreaterThan(4)
      expect(Math.hypot(pos(id).x - 4, pos(id).y + 1), id).toBeGreaterThanOrEqual(FREE_KICK_WALL_MIN - 0.5)
    }
    expectNoOverlaps()
    expectInsidePitch()
  })

  it('free kicks anywhere: nobody crowds the ball, nothing overlaps, everyone on the pitch', () => {
    for (const side of ['left', 'right']) {
      for (const team of ['team1', 'team2']) {
        for (let x = -12; x <= 12; x += 3) {
          for (let y = -7; y <= 7; y += 3.5) {
            useMatchStore.setState({ team1Side: side })
            resetToKickoff(team)
            setupFreeKick({ x, y }, team)
            const b = pos('ball')
            const where = `${side}/${team}/${x},${y}`
            for (const id of capIds()) {
              if (id === `${team}_atk1` || id.endsWith('_gk')) continue // taker; keepers keep their line
              const d = Math.hypot(pos(id).x - b.x, pos(id).y - b.y)
              // Opponents stand at least as far back as the wall; teammates just give room
              // (right by the goal the wall squeezes in beside the keeper: 3.2 is promised)
              const toGoal = PITCH.halfW - Math.abs(b.x)
              const nearGoal = toGoal < 9 && Math.sign(b.x) === (side === 'left' ? 1 : -1) * (team === 'team1' ? 1 : -1)
              const min = id.startsWith(team) ? 3.5 : nearGoal ? 3.2 : FREE_KICK_WALL_MIN - 0.5
              expect(d, `${id} at ${where}`).toBeGreaterThanOrEqual(min)
            }
            expectNoOverlaps()
            expectInsidePitch()
          }
        }
      }
    }
  })

  it('free kick close to goal: a two-cap wall between ball and goal', () => {
    useMatchStore.setState({ team1Side: 'left' })
    resetToKickoff('team1')
    setupFreeKick({ x: 9, y: 2 }, 'team1') // 6 from team2's goal line
    const between = capIds().filter((id) => id.startsWith('team2_') && id !== 'team2_gk')
      .filter((id) => pos(id).x > 9 && pos(id).x < PITCH.halfW)
    expect(between.length).toBeGreaterThanOrEqual(2)
    // …and further out, just one cap stands in the wall's spot
    resetToKickoff('team1')
    setupFreeKick({ x: -4, y: 0 }, 'team1')
    const inLine = capIds().filter((id) => id.startsWith('team2_') && id !== 'team2_gk')
      .filter((id) => Math.abs(pos(id).y) < 1.5 && pos(id).x > -4 && pos(id).x < 6)
    expect(inLine.length).toBe(1)
    expectNoOverlaps()
    expectInsidePitch()
  })

  it('corner kicks from all four corners: ball off the walls, taker beside it, defenders back', () => {
    useMatchStore.setState({ team1Side: 'left' })
    for (const [ex, ey] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      resetToKickoff('team1')
      const team = ex === 1 ? 'team1' : 'team2' // the side attacking that end
      setupCorner(team, ex, ey)
      const b = pos('ball')
      expect(Math.abs(b.x)).toBeLessThan(PITCH.halfW - 0.9)
      expect(Math.abs(b.y)).toBeLessThan(PITCH.halfH - 0.9)
      expect(store().freeKickCapId).toBe(`${team}_atk1`)
      expect(Math.hypot(pos(`${team}_atk1`).x - b.x, pos(`${team}_atk1`).y - b.y)).toBeLessThan(2.5)
      for (const id of capIds()) {
        if (id.startsWith(team) || id.endsWith('_gk')) continue
        expect(Math.hypot(pos(id).x - b.x, pos(id).y - b.y), `${id} at corner ${ex},${ey}`).toBeGreaterThanOrEqual(4.4)
      }
      expectNoOverlaps()
      expectInsidePitch()
    }
  })

  it('goal kicks: the keeper takes it in his box, attackers stand off', () => {
    useMatchStore.setState({ team1Side: 'left' })
    for (const ey of [1, -1]) {
      resetToKickoff('team1')
      setupGoalKick('team1', -1, ey)
      const b = pos('ball')
      expect(b.x).toBeLessThan(-PITCH.halfW + PITCH.penAreaW)
      expect(store().freeKickCapId).toBe('team1_gk')
      for (const id of capIds()) {
        if (!id.startsWith('team2') || id.endsWith('_gk')) continue
        expect(Math.hypot(pos(id).x - b.x, pos(id).y - b.y), id).toBeGreaterThanOrEqual(5.9)
      }
      expectNoOverlaps()
      expectInsidePitch()
    }
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

  it('caps can enter the goal mouth to reach a ball on the line', () => {
    resetToKickoff('team1')
    readyTurn()
    place('team1_atk1', PITCH.halfW - 3, 0)
    place('team2_gk', PITCH.halfW - 1.2, 5)
    place('ball', 0, 8)
    performFlick('team1_atk1', { x: 4.5, y: 0 })
    let furthest = pos('team1_atk1').x
    for (let i = 0; i < 1200; i++) {
      stepPhysics(2)
      clampAllBodies()
      furthest = Math.max(furthest, pos('team1_atk1').x)
    }
    expect(furthest).toBeGreaterThan(PITCH.halfW)
    expect(furthest).toBeLessThanOrEqual(PITCH.halfW + PITCH.goalDepth - radiusOf('team1_atk1') + 0.01)
  })
})


describe('goal-line clearances', () => {
  it('lets a cap behind a ball on the line clear it back into play', () => {
    isolate('team1_atk1', 'ball')
    useMatchStore.setState({ phase: PHASE.SELECT, activeTeam: 'team1', team1Side: 'left', kickoffGuard: false })
    place('team2_gk', PITCH.halfW - 1.2, 5)
    place('ball', PITCH.halfW + 0.2, 0)
    place('team1_atk1', PITCH.halfW + 1.6, 0)
    expect(checkGoal(getBodies().ball)).toBeNull()
    expect(performFlick('team1_atk1', { x: -0.6, y: 0 })).toBeNull()
    simulate(4000)
    expect(pos('ball').x).toBeLessThan(PITCH.halfW - 1)
    expect(checkGoal(getBodies().ball)).toBeNull()
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

describe('pitch walls', () => {
  it('no wall reaches onto the pitch (the goal side-nets start at the goal line)', () => {
    createPhysicsWorld()
    const statics = Matter.Composite.allBodies(getEngine().world).filter((b) => b.isStatic)
    for (const w of statics) {
      const { min, max } = w.bounds
      const intrudes = min.x < PITCH.halfW - 0.01 && max.x > -PITCH.halfW + 0.01 && min.y < PITCH.halfH - 0.01 && max.y > -PITCH.halfH + 0.01
      expect(intrudes).toBe(false)
    }
  })

  it('a corner played straight along the end line runs down to the goal mouth', () => {
    useMatchStore.setState({ team1Side: 'left' })
    createPhysicsWorld()
    setupCorner('team1', 1, 1)
    Matter.Body.setVelocity(getBodies().team1_atk1, { x: 0, y: -PHYSICS.maxFlickVelocity * 0.6 })
    simulate()
    expect(pos('ball').y).toBeLessThan(4.5)
  })
})

describe('free kicks can be scored', () => {
  it('a central free kick leaves a clear line into the far corner', () => {
    useMatchStore.setState({ team1Side: 'left' })
    createPhysicsWorld()
    setupFreeKick({ x: 7.5, y: 0 }, 'team1')
    const b = getBodies(); const ball = b.ball.position
    const blockers = Object.entries(b).filter(([id]) => id.startsWith('team2')).map(([, x]) => ({ x: x.position.x, y: x.position.y, r: x.circleRadius + 0.48 }))
    let open = 0
    for (let ty = -2.5; ty <= 2.5; ty += 0.1) {
      const dx = PITCH.halfW - ball.x, dy = ty - ball.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L
      const hit = blockers.some((c) => { const fx = c.x - ball.x, fy = c.y - ball.y, t = fx * ux + fy * uy; return t > 0 && t < L && Math.hypot(fx - ux * t, fy - uy * t) < c.r })
      if (!hit) open++
    }
    expect(open).toBeGreaterThan(5)
  })
})

describe('goal contact history', () => {
  function contact(a, b) {
    Matter.Events.trigger(getEngine(), 'collisionStart', { pairs: [{ bodyA: a, bodyB: b }] })
  }
  function goalReady() {
    useMatchStore.setState({ phase: PHASE.RESOLVE, kickoffGuard: false, lastFlickedCapId: 'team1_atk1', firstCollisionTracked: true })
    place('ball', PITCH.halfW + 0.8, 0)
  }

  it('counts a direct goal when the shooter cap hits a pitch edge', () => {
    goalReady()
    const cushion = Matter.Composite.allBodies(getEngine().world).find((b) => b.label === 'pitch_cushion')
    contact(getBodies().team1_atk1, cushion)
    expect(getGoalEvidence().capHitEdge).toBe(true)
    expect(checkGoal(getBodies().ball)).toEqual({ outcome: 'goal', scorer: 'team1' })
  })

  it('does not turn net contact after entry into a disallowed bank shot', () => {
    goalReady()
    const net = Matter.Composite.allBodies(getEngine().world).find((b) => b.isStatic && b.position.x > PITCH.halfW + PITCH.goalDepth)
    expect(net).toBeTruthy()
    contact(getBodies().ball, net)
    expect(checkGoal(getBodies().ball)).toEqual({ outcome: 'goal', scorer: 'team1' })
  })

  it('allows a shot deflected off the goalpost tip into the net', () => {
    goalReady()
    place('ball', PITCH.halfW - 0.2, PITCH.goalWidth / 2 + 0.2)
    const post = Matter.Composite.allBodies(getEngine().world).find((b) => b.label === 'pitch_cushion' && b.position.x > PITCH.halfW)
    contact(getBodies().ball, post)
    expect(getGoalEvidence().postContact).toBe(true)
    place('ball', PITCH.halfW + 0.8, 0)
    expect(checkGoal(getBodies().ball)).toEqual({ outcome: 'goal', scorer: 'team1' })
  })

  it('disallows a ball off a pitch cushion, until another cap touches it', () => {
    goalReady()
    place('ball', 0, PITCH.halfH - 0.5)
    const cushion = Matter.Composite.allBodies(getEngine().world).find((b) => b.label === 'pitch_cushion')
    contact(getBodies().ball, cushion)
    place('ball', PITCH.halfW + 0.8, 0)
    expect(checkGoal(getBodies().ball).outcome).toBe('bank_shot')
    contact(getBodies().ball, getBodies().team2_def1)
    expect(getGoalEvidence().capAfterBank).toBe(true)
    expect(checkGoal(getBodies().ball)).toEqual({ outcome: 'goal', scorer: 'team1' })
  })
})
