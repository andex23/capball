import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Matter from 'matter-js'
import {
  createPhysicsWorld, getBodies, resetToKickoff, setupFreeKick, setupPenalty,
  clampAllBodies, stepPhysics, allBodiesSettled, createSimulationWorld,
} from '../physics/PhysicsWorld'
import { checkGoal } from '../physics/GoalDetector'
import { useMatchStore, PHASE, clearMatchTimers } from '../state/MatchStore'
import { performFlick } from '../game/flick'
import { PITCH, PHYSICS } from '../data/TeamData'
import { computeSmartDecision } from '../ai/AIController'
import { firstHit, readPositions, makeContext, eligibleCaps } from '../ai/planner'

const initial = useMatchStore.getState()
const store = () => useMatchStore.getState()
const pos = (id) => getBodies()[id].position
const AI = 'team2' // team1Side 'left' → team2 defends the right goal, attacks the left one

/** Small deterministic PRNG so every run makes the same choices */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function place(id, x, y) {
  Matter.Body.setPosition(getBodies()[id], { x, y })
  Matter.Body.setVelocity(getBodies()[id], { x: 0, y: 0 })
}

/** Park every body except `keep` (and the keepers) in a row along the bottom */
function isolate(...keep) {
  let x = -12
  for (const id of Object.keys(getBodies())) {
    if (keep.includes(id) || id.endsWith('_gk')) continue
    place(id, x, -8.5)
    x += 2.5
  }
}

function readyTurn(extra = {}) {
  useMatchStore.setState({
    phase: PHASE.SELECT, activeTeam: AI, aiTeam: AI, gameMode: 'ai', team1Side: 'left',
    kickoffGuard: false, freeKickCapId: null, ...extra,
  })
}

/** Play the decision in the real world; returns the goal verdict (if any). */
function play(decision, ms = 5000) {
  expect(performFlick(decision.capId, decision.velocity)).toBeNull()
  let verdict = null
  for (let t = 0; t < ms && !verdict; t += 16) {
    for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(16 / PHYSICS.subSteps)
    clampAllBodies()
    verdict = checkGoal(getBodies().ball)
    if (t > 200 && allBodiesSettled()) break
  }
  vi.advanceTimersByTime(400) // let a called foul land in the store
  return verdict
}

beforeEach(() => {
  vi.useFakeTimers()
  clearMatchTimers()
  useMatchStore.setState(initial, true)
  createPhysicsWorld()
  resetToKickoff('team1')
})
afterEach(() => {
  clearMatchTimers()
  vi.useRealTimers()
})

describe('simulation world', () => {
  it('replays a flick like the match world without touching it', () => {
    readyTurn()
    isolate('team2_atk1')
    place('ball', -2, 1)
    place('team2_atk1', 3, 0)
    const before = readPositions(getBodies())
    const sim = createSimulationWorld(before, { team1Side: 'left' })
    Matter.Body.setVelocity(sim.bodies.team2_atk1, { x: -1.2, y: 0.15 })
    for (let f = 0; f < 120; f++) sim.step(16)
    // live world untouched
    expect(pos('ball')).toMatchObject({ x: -2, y: 1 })

    // reset() replays the same flick the same way
    const firstRun = { ...sim.bodies.ball.position }
    sim.reset(before)
    expect(sim.bodies.ball.position).toMatchObject({ x: -2, y: 1 })
    Matter.Body.setVelocity(sim.bodies.team2_atk1, { x: -1.2, y: 0.15 })
    for (let f = 0; f < 120; f++) sim.step(16)
    expect(sim.bodies.ball.position.x).toBeCloseTo(firstRun.x, 2)
    expect(sim.bodies.ball.position.y).toBeCloseTo(firstRun.y, 2)

    performFlick('team2_atk1', { x: -1.2, y: 0.15 })
    for (let f = 0; f < 120; f++) {
      for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(16 / PHYSICS.subSteps)
      clampAllBodies()
    }
    expect(sim.bodies.ball.position.x).toBeCloseTo(pos('ball').x, 1)
    expect(sim.bodies.ball.position.y).toBeCloseTo(pos('ball').y, 1)
  })
})

describe('foul avoidance', () => {
  // An opponent stands right between the natural shooter and the ball
  function foulTrap() {
    readyTurn()
    isolate('team2_atk1', 'team1_def1')
    place('ball', -2, 0)
    place('team1_def1', 1, 0)
    place('team2_atk1', 4, 0)
  }

  it('the naive (classic) shot would foul here', () => {
    foulTrap()
    // rng ≈ 1 → easy skips its foul check
    const naive = computeSmartDecision(AI, 'easy', null, () => 0.99)
    expect(naive.capId).toBe('team2_atk1')
    expect(firstHit(readPositions(getBodies()), naive.capId, naive.velocity).kind).toBe('foul')
  })

  it.each([
    ['medium', 1], ['medium', 2], ['medium', 3], ['medium', 4], ['medium', 5],
    ['hard', 1], ['hard', 2], ['hard', 3],
  ])('%s never picks a path through an opponent (seed %i)', (level, seed) => {
    foulTrap()
    const d = computeSmartDecision(AI, level, null, seeded(seed))
    expect(d).toBeTruthy()
    expect(firstHit(readPositions(getBodies()), d.capId, d.velocity)?.kind).not.toBe('foul')
    play(d)
    expect(store().phase).not.toBe(PHASE.FOUL)
    expect(store().foulData).toBeFalsy()
  })

  it.each(['medium', 'hard'])('%s repositions instead of fouling when the ball is screened', (level) => {
    readyTurn()
    place('ball', -8, 4) // behind team1_def2, every team2 path crosses a team1 cap
    const d = computeSmartDecision(AI, level, null, seeded(4))
    expect(d).toBeTruthy()
    play(d)
    expect(store().phase).not.toBe(PHASE.FOUL)
    expect(store().foulData).toBeFalsy()
  })

  it('easy sometimes notices the foul and uses another cap', () => {
    foulTrap()
    const d = computeSmartDecision(AI, 'easy', null, () => 0.01)
    expect(firstHit(readPositions(getBodies()), d.capId, d.velocity)?.kind).not.toBe('foul')
  })
})

describe('attacking', () => {
  it('hard finds the goal when it is open', () => {
    readyTurn()
    isolate('team2_atk1')
    place('team1_gk', -PITCH.halfW + 1.2, 5) // keeper out of position
    place('ball', -9, 1.5)
    place('team2_atk1', -5, 2.5)
    const d = computeSmartDecision(AI, 'hard', null, () => 0.5)
    expect(d.capId).not.toMatch(/_gk$/)
    expect(play(d)).toEqual({ outcome: 'goal', scorer: AI })
  })

  it('the keeper is only offered when the ball is in its own box', () => {
    readyTurn()
    place('ball', 0, 0)
    const ctx = (b) => {
      place('ball', b.x, b.y)
      return makeContext({ positions: readPositions(getBodies()), team: AI, team1Side: 'left' })
    }
    expect(eligibleCaps(ctx({ x: 0, y: 0 }))).not.toContain('team2_gk')
    expect(eligibleCaps(ctx({ x: PITCH.halfW - 3, y: 1 }))).toContain('team2_gk')
  })
})

describe('defending', () => {
  it.each(['medium', 'hard'])('%s clears a ball sitting in front of its own goal', (level) => {
    readyTurn()
    isolate('team2_def1', 'team1_atk1')
    place('team2_gk', PITCH.halfW - 1.2, -5)
    place('ball', PITCH.halfW - 4, 0.5)
    place('team1_atk1', PITCH.halfW - 8, 0.5) // their striker lined up behind it
    place('team2_def1', PITCH.halfW - 6, 4)
    const d = computeSmartDecision(AI, level, null, seeded(7))
    const verdict = play(d)
    expect(verdict?.scorer).not.toBe('team1') // no own goal
    expect(store().phase).not.toBe(PHASE.FOUL)
    // The ball ends up further from our goal than it started
    const b = pos('ball')
    expect(Math.hypot(b.x - PITCH.halfW, b.y)).toBeGreaterThan(4.5)
  })
})

describe('set pieces', () => {
  it.each(['easy', 'medium', 'hard'])('%s only uses the free-kick taker', (level) => {
    setupFreeKick({ x: -4, y: 3 }, AI)
    readyTurn({ freeKickCapId: store().freeKickCapId })
    expect(store().freeKickCapId).toBe('team2_atk1')
    for (const seed of [1, 2, 3]) {
      const d = computeSmartDecision(AI, level, store().freeKickCapId, seeded(seed))
      expect(d.capId).toBe('team2_atk1')
    }
  })

  it.each(['easy', 'medium', 'hard'])('%s only uses the penalty taker', (level) => {
    setupPenalty(AI)
    readyTurn({ freeKickCapId: store().freeKickCapId })
    const d = computeSmartDecision(AI, level, store().freeKickCapId, seeded(9))
    expect(d.capId).toBe(store().freeKickCapId)
    expect(performFlick(d.capId, d.velocity)).toBeNull()
  })
})

describe('thinking time', () => {
  it('hard decides in under 150 ms', () => {
    // Fake timers freeze performance.now — the planner's budget needs a real clock
    vi.useRealTimers()
    const times = []
    const scenarios = [
      () => resetToKickoff(AI),
      () => { resetToKickoff('team1'); place('ball', 3, -2) },
      () => { resetToKickoff('team1'); place('ball', -8, 4) },
      () => { resetToKickoff('team1'); place('ball', 10, 1) },
      () => { setupFreeKick({ x: -6, y: -1 }, AI) },
    ]
    for (const setup of scenarios) {
      setup()
      readyTurn({ freeKickCapId: store().freeKickCapId })
      const t0 = performance.now()
      const d = computeSmartDecision(AI, 'hard', store().freeKickCapId, seeded(3))
      times.push(performance.now() - t0)
      expect(d, `scenario ${times.length}`).toBeTruthy()
      useMatchStore.setState({ freeKickCapId: null })
    }
    console.log('hard decision ms:', times.map((t) => t.toFixed(1)).join(', '))
    expect(Math.max(...times)).toBeLessThan(150)
  })
})
