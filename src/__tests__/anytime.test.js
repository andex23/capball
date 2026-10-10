import { describe, it, expect } from 'vitest'
import { createAnytimeState, resolveAnytimeTurn, anytimeConfig } from '../game/anytime.js'
import { PITCH, BALL_RADIUS } from '../data/TeamData.js'

const config = anytimeConfig({ turnsPerPlayer: 10 })
const gentle = state => ({ capId: state.freeKickCapId || `${state.activeTeam}_atk2`, velocity: { x: 0.02, y: 0 } })
describe('server-resolved saved turns', () => {
  it('resumes from JSON without changing input, with identical outcomes', () => {
    const original = createAnytimeState(config)
    const saved = JSON.stringify(original)
    const next = resolveAnytimeTurn(original, config, gentle(original))
    expect(JSON.stringify(original)).toBe(saved)
    expect(next.turns).toEqual({ team1: 1, team2: 0 })
    expect(next.activeTeam).toBe('team2')
    expect(resolveAnytimeTurn(JSON.parse(saved), config, gentle(original))).toEqual(next)
    expect(next.lastTurn.frames.length).toBeGreaterThan(1)
    expect(Object.keys(next.bodies)).toHaveLength(13)
  })
  it('rejects invalid shots, opponent caps, and goalkeeper outside range', () => {
    const state = createAnytimeState(config)
    expect(() => resolveAnytimeTurn(state, config, { capId: 'team2_mid', velocity: { x: 1, y: 0 } })).toThrow('not-your-cap')
    expect(() => resolveAnytimeTurn(state, config, { capId: 'team1_mid', velocity: { x: Infinity, y: 0 } })).toThrow('bad-velocity')
    expect(() => resolveAnytimeTurn(state, config, { capId: 'team1_gk', velocity: { x: 1, y: 0 } })).toThrow('keeper-out-of-range')
    state.freeKickCapId = 'team1_mid'
    expect(() => resolveAnytimeTurn(state, config, gentle({ ...state, freeKickCapId: null }))).toThrow('set-piece-taker-only')
  })
  it('ends a casual draw only after both players have their full allocation', () => {
    let state = createAnytimeState(config)
    for (let i = 0; i < 19; i++) state = resolveAnytimeTurn(state, config, gentle(state))
    expect(state.complete).toBe(false)
    state = resolveAnytimeTurn(state, config, gentle(state))
    expect(state.turns).toEqual({ team1: 10, team2: 10 })
    expect(state.complete).toBe(true)
    expect(state.winner).toBeNull()
    expect(() => resolveAnytimeTurn(state, config, gentle(state))).toThrow('match-finished')
  })
  it('opens penalties for a drawn cup tie and finishes a decided shootout', () => {
    const cup = { ...config, knockout: true }
    let state = createAnytimeState(cup)
    state.turns = { team1: 10, team2: 9 }; state.activeTeam = 'team2'
    state = resolveAnytimeTurn(state, cup, gentle(state))
    expect(state.shootout).toBe(true)
    expect(state.penaltyKick).toBe(true)
    state.penaltyKicks = { team1: 4, team2: 4 }; state.penaltyScores = { team1: 4, team2: 0 }
    state = resolveAnytimeTurn(state, cup, gentle(state))
    expect(state.complete).toBe(true)
    expect(state.winner).toBe('team1')
  })
  it('requires the whole ball over the line and permits open-play goals', () => {
    let state = createAnytimeState(config)
    state.kickoffGuard = false
    state.bodies.ball = [PITCH.halfW + BALL_RADIUS - 0.05, 0]
    state.bodies.team2_gk = [13, 5]
    let next = resolveAnytimeTurn(state, config, gentle(state))
    expect(next.score.team1).toBe(0)
    state.bodies.ball = [PITCH.halfW + BALL_RADIUS + 0.05, 0]
    next = resolveAnytimeTurn(state, config, gentle(state))
    expect(next.score.team1).toBe(1)
    expect(next.lastTurn.decision.outcome).toBe('goal')
    expect(next.kickoffGuard).toBe(true)
    state.goalKickGuard = true
    next = resolveAnytimeTurn(state, config, gentle(state))
    expect(next.score.team1).toBe(0)
    expect(next.lastTurn.decision.reason).toBe('goal_kick_violation')
  })
})
