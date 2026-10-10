import Matter from 'matter-js'
import { PITCH, PHYSICS, BALL_RADIUS, FORMATIONS, getFormationPositions } from '../data/TeamData.js'
import { createSimulationWorld } from '../physics/WorldCore.js'
import { createLayouts } from '../physics/Layouts.js'
import { sanitizeTeam } from './tournament.js'
import { teamOf, teamHomeDir, otherTeam, classifyContact, judgeGoal, keeperCanPlay, isInPenaltyArea, ballInCorner, cornerRestart, shootoutStatus, matchWinner } from './rules.js'

export const TURN_COUNTS = [10, 20, 30]
export const TURN_DEADLINES = [0, 24, 48]
export const ANYTIME_VERSION = 1
const STEP_MS = 1000 / 60
const MAX_FRAMES = 216 // at most twelve seconds of displayed play
const ROLES = ['gk', 'def1', 'def2', 'mid', 'atk1', 'atk2']
const round = n => Math.round(n * 10000) / 10000
const positions = world => Object.fromEntries(Object.entries(world.bodies).map(([id, b]) => [id, [round(b.position.x), round(b.position.y)]]))

export function anytimeConfig(input = {}) {
  return {
    turnsPerPlayer: TURN_COUNTS.includes(input.turnsPerPlayer) ? input.turnsPerPlayer : 20,
    deadlineHours: TURN_DEADLINES.includes(input.deadlineHours) ? input.deadlineHours : 0,
    knockout: input.knockout === true,
    teams: Object.fromEntries(['team1', 'team2'].map((team, i) => [team, sanitizeTeam(input.teams?.[team], i)])),
    formations: Object.fromEntries(['team1', 'team2'].map(team => [team, Object.hasOwn(FORMATIONS, input.formations?.[team]) ? input.formations[team] : 'default'])),
  }
}

function worldFor(state, config) {
  const world = createSimulationWorld(state.bodies, { team1Side: 'left' })
  const layoutState = { team1Side: 'left', formations: config.formations }
  const layouts = createLayouts(world.bodies, () => layoutState, patch => Object.assign(layoutState, patch))
  return { world, layouts, layoutState }
}

export function createAnytimeState(configInput) {
  const config = anytimeConfig(configInput)
  const bodies = { ball: [0, 0] }
  for (const team of ['team1', 'team2']) {
    const formation = getFormationPositions(team, config.formations[team], 'left')
    for (const role of ROLES) bodies[`${team}_${role}`] = [formation[role].x, formation[role].y]
  }
  const { world, layouts } = worldFor({ bodies }, config)
  layouts.resetToKickoff('team1')
  const state = {
    v: ANYTIME_VERSION, bodies: positions(world), activeTeam: 'team1', score: { team1: 0, team2: 0 },
    turns: { team1: 0, team2: 0 }, kickoffGuard: true, goalKickGuard: false,
    freeKickCapId: null, penaltyKick: false, shootout: false,
    penaltyKicks: { team1: 0, team2: 0 }, penaltyScores: { team1: 0, team2: 0 },
    complete: false, winner: null, lastTurn: null,
  }
  Matter.Engine.clear(world.engine)
  return state
}

/** Only cap and velocity are supplied by a player. All outcomes come from saved state. */
export function resolveAnytimeTurn(saved, configInput, move) {
  const config = anytimeConfig(configInput)
  if (!saved || saved.v !== ANYTIME_VERSION || saved.complete) throw new Error('match-finished')
  const state = structuredClone(saved)
  const team = state.activeTeam
  const capId = move?.capId
  if (typeof capId !== 'string' || teamOf(capId) !== team || !ROLES.includes(capId.slice(6))) throw new Error('not-your-cap')
  if (state.freeKickCapId && state.freeKickCapId !== capId) throw new Error('set-piece-taker-only')
  const v = move?.velocity
  const speed = Math.hypot(v?.x, v?.y)
  if (!Number.isFinite(v?.x) || !Number.isFinite(v?.y) || !Number.isFinite(speed) || speed < 0.01) throw new Error('bad-velocity')
  const ballStart = state.bodies.ball
  if (capId.endsWith('_gk') && capId !== state.freeKickCapId && !keeperCanPlay(ballStart[0], ballStart[1], teamHomeDir(team))) throw new Error('keeper-out-of-range')
  const { world, layouts, layoutState } = worldFor(state, config)
  const evidence = {}
  let first = null, foulSpot = null, banked = false, goalKickGuard = state.goalKickGuard, lastTouch = saved.lastTouch || null
  Matter.Events.on(world.engine, 'collisionStart', event => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.label, b = pair.bodyB.label
      if (a === capId || b === capId) {
        const other = a === capId ? pair.bodyB : pair.bodyA
        if (other.label === 'pitch_cushion') evidence.capHitEdge = true
        const kind = classifyContact(capId, other.label)
        if (!first && kind !== 'wall') {
          first = kind
          if (kind === 'foul') foulSpot = { ...other.position }
        }
      }
      if (a !== 'ball' && b !== 'ball') continue
      const other = a === 'ball' ? pair.bodyB : pair.bodyA
      if (teamOf(other.label)) {
        if (banked) evidence.capAfterBank = true
        banked = false
        lastTouch = teamOf(other.label)
        if (other.label !== capId) goalKickGuard = false
      } else if (other.label === 'pitch_cushion') {
        const { x, y } = world.bodies.ball.position
        const post = Math.abs(x) >= PITCH.halfW - BALL_RADIUS && Math.abs(y) <= PITCH.goalWidth / 2 + BALL_RADIUS
        if (post) evidence.postContact = true
        if (Math.abs(x) <= PITCH.halfW && !post) { banked = true; evidence.capAfterBank = false }
      }
    }
  })
  const scale = Math.min(1, PHYSICS.maxFlickVelocity / speed)
  Matter.Body.setVelocity(world.bodies[capId], { x: v.x * scale, y: v.y * scale })
  const frames = [positions(world)]
  let verdict = null
  try {
    for (let frame = 0; frame < MAX_FRAMES; frame++) {
      world.step(STEP_MS, () => {
        if (first === 'foul' && !state.shootout) return true
        const { x, y } = world.bodies.ball.position
        verdict = judgeGoal({ x, y, team1Side: 'left', kickoffGuard: state.kickoffGuard, goalKickGuard, lastFlickedCapId: capId, banked })
        return !!verdict
      })
      if (frame % 3 === 2) frames.push(positions(world))
      if (first === 'foul' && !state.shootout) break
      if (verdict) break
      if (frame > 6 && Object.values(world.bodies).every(b => Math.hypot(b.velocity.x, b.velocity.y) < PHYSICS.settleSpeed)) break
    }
    frames.push(positions(world))
    for (const body of Object.values(world.bodies)) Matter.Body.setVelocity(body, { x: 0, y: 0 })
    const decision = verdict ? { outcome: verdict.outcome === 'goal' ? 'goal' : 'no_goal', reason: verdict.outcome, evidence } : null
    state.lastTurn = { capId, team, frames, frameSeconds: 3 * STEP_MS / 1000 / PHYSICS.timeScale, decision, kind: verdict?.outcome || (first === 'foul' ? 'foul' : 'turn') }
    state.kickoffGuard = false
    state.goalKickGuard = false
    state.freeKickCapId = null
    state.penaltyKick = false
    state.activeTeam = otherTeam(team)

    if (state.shootout) {
      state.penaltyKicks[team]++
      if (verdict?.outcome === 'goal' && verdict.scorer === team) state.penaltyScores[team]++
      const status = shootoutStatus(state.penaltyKicks, state.penaltyScores)
      if (status.decided) { state.complete = true; state.winner = status.winner }
      else { layouts.setupPenalty(state.activeTeam, { shootout: true }); state.freeKickCapId = layoutState.freeKickCapId; state.penaltyKick = true }
    } else {
      state.turns[team]++
      if (first === 'foul') {
        const defendingDir = teamHomeDir(team)
        if (isInPenaltyArea(foulSpot.x, foulSpot.y, defendingDir)) { layouts.setupPenalty(state.activeTeam); state.penaltyKick = true }
        else layouts.setupFreeKick(foulSpot, state.activeTeam)
        state.freeKickCapId = layoutState.freeKickCapId
      } else if (verdict?.outcome === 'goal') {
        state.score[verdict.scorer]++
        state.activeTeam = otherTeam(verdict.scorer)
        layouts.resetToKickoff(state.activeTeam)
        state.kickoffGuard = true
      } else if (verdict?.outcome === 'bank_shot') {
        state.activeTeam = otherTeam(verdict.scorer)
        layouts.setupGoalKick(state.activeTeam, Math.sign(world.bodies.ball.position.x) || 1, Math.sign(world.bodies.ball.position.y) || 1)
        state.goalKickGuard = true
        state.freeKickCapId = layoutState.freeKickCapId
      } else if (verdict) { layouts.placeBallAt(0, 0); layouts.deOverlapBodies() }
      else {
        const corner = ballInCorner(world.bodies.ball.position.x, world.bodies.ball.position.y)
        if (corner) {
          const restart = cornerRestart(corner.ex, lastTouch)
          state.activeTeam = restart.team
          if (restart.kind === 'corner') layouts.setupCorner(restart.team, corner.ex, corner.ey)
          else { layouts.setupGoalKick(restart.team, corner.ex, corner.ey); state.goalKickGuard = true }
          state.freeKickCapId = layoutState.freeKickCapId
        }
      }
      if (state.turns.team1 >= config.turnsPerPlayer && state.turns.team2 >= config.turnsPerPlayer) {
        const winner = matchWinner(state.score)
        if (winner || !config.knockout) { state.complete = true; state.winner = winner }
        else {
          state.shootout = true; state.activeTeam = 'team1'; state.kickoffGuard = false; state.goalKickGuard = false
          layouts.setupPenalty('team1', { shootout: true }); state.freeKickCapId = layoutState.freeKickCapId; state.penaltyKick = true
        }
      } else if (state.turns[state.activeTeam] >= config.turnsPerPlayer) {
        // Own goals or repeated restarts must not give one player extra turns.
        state.activeTeam = otherTeam(state.activeTeam)
        layouts.resetToKickoff(state.activeTeam)
        state.freeKickCapId = null; state.goalKickGuard = false; state.kickoffGuard = true; state.penaltyKick = false
      }
    }
    state.lastTouch = lastTouch
    state.bodies = positions(world)
    return state
  } finally { Matter.Engine.clear(world.engine) }
}

export function forfeitAnytime(saved, loser, reason = 'resigned') {
  if (!['team1', 'team2'].includes(loser)) throw new Error('not-a-player')
  return { ...saved, complete: true, winner: otherTeam(loser), forfeited: loser, finishReason: reason }
}
