import { describe, it, expect } from 'vitest'
import { createSimulationWorld } from '../physics/PhysicsWorld'
import { PITCH, PHYSICS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { makeContext, generateCandidates, heuristicScore, chooseHeuristic, keeperSpot } from '../ai/planner'

/** Run a private world until everything stops; returns final positions. */
function run(snapshot, frames = 600) {
  const w = createSimulationWorld(snapshot)
  for (let f = 0; f < frames; f++) w.step(1000 / 60)
  const out = {}
  for (const [id, b] of Object.entries(w.bodies)) out[id] = { x: b.position.x, y: b.position.y }
  return out
}

describe('goalkeeper', () => {
  it('stands firm when a shot hits him', () => {
    // team1 keeper on his line (team1 defends the left goal); ball fired straight at him
    const start = { x: -13.8, y: 0 }
    const end = run({ team1_gk: start, ball: { x: -6, y: 0, vx: -PHYSICS.maxFlickVelocity, vy: 0 } })
    const moved = Math.hypot(end.team1_gk.x - start.x, end.team1_gk.y - start.y)
    expect(moved).toBeLessThan(0.6)
    // ...and the ball didn't go in
    expect(end.ball.x).toBeGreaterThan(-PITCH.halfW)
  })

  it('stays near his box after punching a clearance', () => {
    const end = run({ team1_gk: { x: -13.5, y: 0, vx: PHYSICS.maxFlickVelocity, vy: 0 }, ball: { x: -11, y: 0 } })
    // The ball is cleared well up the pitch…
    expect(end.ball.x).toBeGreaterThan(-2)
    // …but the keeper doesn't charge after it and leave the goal empty
    expect(end.team1_gk.x).toBeLessThan(-PITCH.halfW + PITCH.penAreaW + 1)
  })

  it('is big enough to cover a good part of the goal', () => {
    expect((GK_RADIUS * 2 + BALL_RADIUS * 2) / PITCH.goalWidth).toBeGreaterThan(0.5)
  })

  describe('CPU keeper', () => {
    // team2 defends the right goal when team1Side is left
    const base = {
      team2_gk: { x: 12.2, y: 3.6 }, // out of position, high up the right side
      team2_def1: { x: 0, y: -8 }, team2_def2: { x: 2, y: 8 },
      team2_atk1: { x: -6, y: -8 }, team2_atk2: { x: -6, y: 8 },
      team1_atk1: { x: 7, y: -1.5 }, team1_atk2: { x: 4, y: 4 },
      team1_def1: { x: -8, y: 3 }, team1_def2: { x: -8, y: -3 }, team1_gk: { x: -13.8, y: 0 },
      ball: { x: 9, y: -2.2 },
    }
    const ctx = () => makeContext({ positions: structuredClone(base), team: 'team2', team1Side: 'left' })

    it('knows where to stand: on the line from ball to goal, inside the posts', () => {
      const spot = keeperSpot(ctx())
      expect(spot.x).toBeGreaterThan(PITCH.halfW - 3)
      expect(spot.x).toBeLessThan(PITCH.halfW)
      expect(Math.abs(spot.y)).toBeLessThan(PITCH.goalWidth / 2)
      expect(spot.y).toBeLessThan(0) // towards the ball's side
    })

    it('offers a keeper move when he is out of position under pressure, and rates it', () => {
      const c = ctx()
      const moves = generateCandidates(c, { blocks: true }).filter((m) => m.kind === 'keeper')
      expect(moves.length).toBe(1)
      expect(heuristicScore(c, moves[0])).toBeGreaterThan(0)
    })

    it('never offers a keeper move when the ball is far from his box', () => {
      const far = structuredClone(base)
      far.ball = { x: -4, y: 0 }
      const c = makeContext({ positions: far, team: 'team2', team1Side: 'left' })
      expect(generateCandidates(c, { blocks: true }).some((m) => m.capId === 'team2_gk')).toBe(false)
    })

    it('a medium CPU picks something sensible: clears the ball or sets the keeper', () => {
      const pick = chooseHeuristic(ctx(), { rng: () => 0.5 })
      expect(pick).toBeTruthy()
      if (pick.kind !== 'keeper') {
        // otherwise it must be sending the ball away from its own goal
        expect(pick.u.x).toBeLessThan(0.2)
      }
    })
  })
})
