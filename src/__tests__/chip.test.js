import { describe, it, expect, beforeEach } from 'vitest'
import Matter from 'matter-js'
import { createSimulationWorld, chipHeight, CHIP } from '../physics/WorldCore'
import { chipError, CHIPS_PER_HALF } from '../game/chip'
import { useMatchStore } from '../state/MatchStore'
import { makeContext, simulateFlick, scoreOutcome, chooseChip } from '../ai/planner'

/** Chip a ball at x=bx (towards the right-hand goal, team2's) with a cap 1.4 behind it, over a two-cap wall. */
function chip(bx, power, { keeperX = 14.3, reflex = 0.5, by = 0, armed = true } = {}) {
  const snap = { team1_atk1: [bx - 1.4, by], ball: [bx, by], team2_def1: [bx + 3.6, by - 0.8], team2_def2: [bx + 3.6, by + 0.8], team2_gk: [keeperX, 0] }
  const w = createSimulationWorld(snap, { team1Side: 'left', reflex: { team1: reflex, team2: reflex } })
  if (armed) w.chip.arm('team1_atk1')
  Matter.Body.setVelocity(w.bodies.team1_atk1, { x: 3.2 * power, y: 0 })
  let peak = 0
  for (let f = 0; f < 300; f++) {
    w.step(1000 / 60)
    peak = Math.max(peak, w.chip.height())
    if (w.chip.outcome()) return { ...w.chip.outcome(), peak }
    if (w.bodies.ball.position.x > 15) return { kind: 'goal', peak }
    const v = w.bodies.ball.velocity
    if (f > 3 && Math.hypot(v.x, v.y) < 0.01) return { kind: 'stopped', x: w.bodies.ball.position.x, peak }
  }
  return { kind: 'timeout', peak }
}

describe('chip flight', () => {
  it('rises and comes down in a parabola', () => {
    expect(chipHeight(0, 4, 2)).toBe(0)
    expect(chipHeight(2, 4, 2)).toBeCloseTo(2)
    expect(chipHeight(4, 4, 2)).toBe(0)
  })
  it('goes over a wall that stops a driven shot', () => {
    const driven = chip(6, 0.6, { armed: false })
    expect(driven.kind).toBe('stopped')
    expect(driven.x).toBeLessThan(9.6) // into the wall
    expect(chip(6, 0.6).peak).toBeGreaterThan(CHIP.capClear)
  })
  it('a well-judged chip beats the keeper; too much goes over the bar', () => {
    expect(chip(6, 0.6).kind).toBe('goal')
    expect(chip(6, 0.75).kind).toBe('overBar')
    expect(chip(3, 0.9).kind).toBe('overBar')
  })
  it('a floated chip from close in is the keeper’s', () => {
    expect(chip(9, 0.45).kind).toBe('caught')
    expect(chip(6, 0.45, { keeperX: 11.5 }).kind).toBe('caught')
  })
  it('a better keeper tips more over', () => {
    let tipped = 0
    for (let y = -2; y <= 2; y += 0.25) if (chip(6, 0.6, { reflex: 1, by: y * 0.3 }).kind === 'tipped') tipped++
    let weak = 0
    for (let y = -2; y <= 2; y += 0.25) if (chip(6, 0.6, { reflex: 0, by: y * 0.3 }).kind === 'tipped') weak++
    expect(weak).toBe(0)
    expect(tipped).toBeGreaterThan(0)
  })
  it('an unarmed flick never leaves the ground', () => {
    expect(chip(6, 0.6, { armed: false }).peak).toBe(0)
  })
})

describe('chip rules', () => {
  const base = { activeTeam: 'team1', team1Side: 'left', chipsLeft: { team1: 3, team2: 3 } }
  const ball = { x: 6, y: 0 }
  const cap = { x: 4.6, y: 0 }
  it('only in the half you attack, close to the ball, with chips left, never a keeper', () => {
    expect(chipError(base, 'team1_atk1', ball, cap)).toBeNull()
    expect(chipError(base, 'team1_atk1', { x: -3, y: 0 }, { x: -4.4, y: 0 })).toBe('own-half')
    expect(chipError(base, 'team1_atk1', ball, { x: 1, y: 0 })).toBe('too-far')
    expect(chipError({ ...base, chipsLeft: { team1: 0, team2: 3 } }, 'team1_atk1', ball, cap)).toBe('none-left')
    expect(chipError(base, 'team1_gk', ball, cap)).toBe('keeper')
    expect(chipError(base, 'team2_atk1', ball, cap)).toBe('not-your-cap')
    expect(chipError({ ...base, challenge: {} }, 'team1_atk1', ball, cap)).toBe('not-here')
    expect(chipError({ ...base, penaltyShootout: true }, 'team1_atk1', ball, cap)).toBe('not-here')
  })
})

describe('chip state', () => {
  const initial = useMatchStore.getState()
  beforeEach(() => useMatchStore.setState(initial, true))
  it('double-tap arms and disarms; a flick uses it up; each half starts with three', () => {
    useMatchStore.setState({ activeTeam: 'team1', team1Side: 'left' })
    const s = () => useMatchStore.getState()
    expect(s().toggleChip('team1_atk1', { x: 6, y: 0 }, { x: 4.6, y: 0 })).toBe(true)
    expect(s().chipArmed).toBe('team1_atk1')
    expect(s().toggleChip('team1_atk1')).toBe(false)
    expect(s().chipArmed).toBeNull()
    s().useChip('team1')
    expect(s().chipsLeft.team1).toBe(CHIPS_PER_HALF - 1)
    s().startSecondHalf()
    expect(s().chipsLeft).toEqual({ team1: CHIPS_PER_HALF, team2: CHIPS_PER_HALF })
  })
})

describe('the computer and chips', () => {
  const positions = {
    team2_atk1: { x: -4.6, y: 0 }, ball: { x: -6, y: 0 },
    team1_def1: { x: -9.6, y: -0.8 }, team1_def2: { x: -9.6, y: 0.8 }, team1_gk: { x: -14.3, y: 0 },
  }
  const ctx = makeContext({ positions, team: 'team2', team1Side: 'left', reflex: { team1: 0.5, team2: 0.5 } })
  it('scores an over-the-bar chip as a giveaway', () => {
    expect(scoreOutcome(ctx, { chipEnd: 'overBar' })).toBeLessThan(0)
  })
  it('finds a chip over a wall', () => {
    const pick = chooseChip(ctx, { canChip: () => true, rng: () => 0.5, budgetMs: 2000 })
    expect(pick).toMatchObject({ capId: 'team2_atk1', chip: true })
    const out = simulateFlick(ctx, pick.capId, pick.velocity, { chip: true })
    expect(out.verdict?.outcome).toBe('goal')
  })
  it('doesn’t chip when the way to goal is open', () => {
    const open = makeContext({ positions: { team2_atk1: { x: -4.6, y: 0 }, ball: { x: -6, y: 0 }, team1_gk: { x: -14.3, y: 3 } }, team: 'team2', team1Side: 'left' })
    expect(chooseChip(open, { canChip: () => true })).toBeNull()
  })
})
