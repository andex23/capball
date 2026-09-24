import Matter from 'matter-js'
import { createSimulationWorld, radiusOf } from '../physics/PhysicsWorld'
import { PITCH, PHYSICS, BALL_RADIUS } from '../data/TeamData'
import { teamHomeDir, teamOf, otherTeam, isGoalkeeper, classifyContact, judgeGoal, isInPenaltyArea } from '../game/rules'

/**
 * CPU SHOT PLANNER
 *
 * Pure-ish decision making for the computer opponent: it reads a position
 * snapshot, never the live engine, so it can be unit tested directly.
 *
 * - generateCandidates: caps × ball directions (goal, flanks, clearances,
 *   cushion banks) and contact angles × power levels, plus "block" moves that
 *   park a cap between the ball and our goal, and "position" moves when an
 *   opponent screens the ball.
 * - firstHit: swept-circle ray cast — what would the flicked cap touch first?
 *   Anything other than the ball (opponent = foul) is filtered out up front.
 * - heuristicScore: cheap geometry (medium picks straight from this).
 * - simulateFlick/scoreOutcome: hard replays candidates in a private matter-js
 *   world (createSimulationWorld) and scores what actually happens.
 */

const { Body, Events } = Matter

const FRAME_MS = 1000 / 60
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
// Measured deceleration per 60 Hz frame in velocity units (see PhysicsWorld friction).
const CAP_DECEL = PHYSICS.linearFriction * 1.03
const BALL_DECEL = PHYSICS.linearFriction * 0.5 * 1.03
// A heavy cap hitting the light ball head-on roughly doubles its speed.
const BALL_SPEED_GAIN = 1.7
const MIN_CUT = 0.3 // cos of the steepest glancing contact we try
const BODY_MARGIN = 0.12 // keep this much daylight when passing another cap
// Another cap touched within this distance of the ball counts as touched first:
// both contacts can land in the same physics step and either may win.
const CONTACT_TIE = 0.3
const BLOCK_RUNOUT = 4 // a block's path must stay clear this far past its spot
const POSITION_RUNOUT = 2 // same for repositioning (power undershoots by ~10%)
const DEG = Math.PI / 180

/* ═══════════════════════════════════════════════════════════
   1. CONTEXT & GEOMETRY
   ═══════════════════════════════════════════════════════════ */

/** { id: {x, y, vx, vy} } from a map of matter bodies */
export function readPositions(bodies) {
  const out = {}
  for (const [id, b] of Object.entries(bodies || {})) {
    out[id] = { x: b.position.x, y: b.position.y, vx: 0, vy: 0 }
  }
  return out
}

/**
 * Everything the planner needs to know about the current turn.
 * @param positions  readPositions() output (must include 'ball')
 */
export function makeContext({ positions, team, team1Side = 'left', kickoffGuard = false, penaltyShootout = false, requiredCapId = null }) {
  const homeDir = teamHomeDir(team, team1Side)
  return {
    positions, team, opp: otherTeam(team), team1Side, kickoffGuard, penaltyShootout, requiredCapId,
    homeDir,
    attackDir: -homeDir,
    ownGoal: { x: homeDir * PITCH.halfW, y: 0 },
    theirGoal: { x: -homeDir * PITCH.halfW, y: 0 },
  }
}

const hyp = Math.hypot
const unit = (x, y) => { const l = hyp(x, y) || 1; return { x: x / l, y: y / l } }
const rotate = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) })
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/**
 * First body the flicked cap would touch moving from its position along dir.
 * Walls are ignored (cushion bounces never decide the contact anyway).
 * @returns {{ id, t, kind: 'ball'|'teammate'|'foul' } | null}
 */
export function firstHit(positions, capId, dir, maxDist = Infinity) {
  const c = positions[capId]
  if (!c) return null
  const d = unit(dir.x, dir.y)
  const rc = radiusOf(capId)
  let best = null
  for (const [id, o] of Object.entries(positions)) {
    if (id === capId) continue
    const R = rc + radiusOf(id) + (id === 'ball' ? 0 : BODY_MARGIN)
    const ox = o.x - c.x
    const oy = o.y - c.y
    const along = ox * d.x + oy * d.y
    const perp2 = ox * ox + oy * oy - along * along
    if (along <= 0 || perp2 >= R * R) continue
    const t = along - Math.sqrt(R * R - perp2) - (id === 'ball' ? 0 : CONTACT_TIE)
    if (t > maxDist) continue
    if (!best || t < best.t) best = { id, t }
  }
  if (best) best.kind = classifyContact(capId, best.id)
  return best
}

/** Flick direction that sends the ball along u, or null if the cap can't get behind it. */
function aimFor(positions, capId, u) {
  const c = positions[capId]
  const b = positions.ball
  const reach = radiusOf(capId) + BALL_RADIUS
  const px = b.x - u.x * reach
  const py = b.y - u.y * reach
  // The cap can't get between the ball and a cushion
  const lim = radiusOf(capId) + 0.05 // cap fully on the pitch, not grazing the cushion
  if (Math.abs(px) > PITCH.halfW - lim || Math.abs(py) > PITCH.halfH - lim) return null
  const dist = hyp(px - c.x, py - c.y)
  if (dist < 0.05) return null
  const dir = { x: (px - c.x) / dist, y: (py - c.y) / dist }
  const cut = dir.x * u.x + dir.y * u.y
  if (cut < MIN_CUT) return null
  return { dir, dist, cut }
}

/** Cap flick speed that leaves the ball rolling about ballDist after contact. */
function powerFor(capDist, ballDist, cut) {
  const vBall = Math.sqrt(2 * BALL_DECEL * Math.max(ballDist, 1))
  const vContact = vBall / (BALL_SPEED_GAIN * Math.max(cut, MIN_CUT))
  return Math.sqrt(vContact * vContact + 2 * CAP_DECEL * capDist)
}

/**
 * Where a ball from p along u crosses a goal line, unfolding one cushion bounce.
 * @returns {{ y, bounced } | null} null if it never reaches that end
 */
function crossing(p, u, goalX) {
  if (Math.abs(u.x) < 1e-6 || Math.sign(goalX - p.x) !== Math.sign(u.x)) return null
  const t = (goalX - p.x) / u.x
  let y = p.y + t * u.y
  const H = PITCH.halfH - BALL_RADIUS
  let bounced = false
  if (Math.abs(y) > H) { y = Math.sign(y) * (2 * H - Math.abs(y)); bounced = true }
  if (Math.abs(y) > H) return null // more than one bounce — no idea
  return { y, bounced, t }
}

/** Caps (other than the shooter) within reach of the straight ball line p→q. */
function blockersOnLine(positions, shooterId, p, q) {
  let n = 0
  const dx = q.x - p.x
  const dy = q.y - p.y
  const len2 = dx * dx + dy * dy || 1
  for (const [id, o] of Object.entries(positions)) {
    if (id === 'ball' || id === shooterId) continue
    const t = clamp01(((o.x - p.x) * dx + (o.y - p.y) * dy) / len2)
    const d = hyp(o.x - (p.x + t * dx), o.y - (p.y + t * dy))
    if (d < radiusOf(id) + BALL_RADIUS) n++
  }
  return n
}

/** 0..1: how close the ball is to our own goal (1 = on the line). */
export function dangerLevel(ctx, p = ctx.positions.ball) {
  const d = hyp(p.x - ctx.ownGoal.x, p.y - ctx.ownGoal.y)
  return clamp01(1 - (d - 3) / 9)
}

/** Caps allowed to take this flick. The keeper only plays when the ball is in its box. */
export function eligibleCaps(ctx) {
  const { positions, team, requiredCapId } = ctx
  if (requiredCapId) return positions[requiredCapId] ? [requiredCapId] : []
  const ball = positions.ball
  return ['atk1', 'atk2', 'def1', 'def2', 'gk']
    .map((r) => `${team}_${r}`)
    .filter((id) => positions[id])
    .filter((id) => !isGoalkeeper(id) || isInPenaltyArea(ball.x, ball.y, ctx.homeDir))
}

/* ═══════════════════════════════════════════════════════════
   2. CANDIDATES
   ═══════════════════════════════════════════════════════════ */

/** Ball directions worth trying from the current ball position. */
function ballDirections(ctx, { banks }) {
  const b = ctx.positions.ball
  const gx = ctx.theirGoal.x + ctx.attackDir * 0.6
  const post = PITCH.goalWidth / 2 - BALL_RADIUS - 0.5
  const dirs = [
    { u: unit(gx - b.x, -b.y), tag: 'goal' },
    { u: unit(gx - b.x, post - b.y), tag: 'goal' },
    { u: unit(gx - b.x, -post - b.y), tag: 'goal' },
  ]
  if (banks) {
    const H = PITCH.halfH - BALL_RADIUS
    for (const s of [-1, 1]) dirs.push({ u: unit(gx - b.x, s * 2 * H - b.y), tag: 'bank' })
  }
  // A fan around the attacking direction: progress, flanks and clearances
  const fwd = { x: ctx.attackDir, y: 0 }
  for (const a of [0, 25, -25, 50, -50, 75, -75]) dirs.push({ u: rotate(fwd, a * DEG), tag: 'field' })
  return dirs
}

/**
 * Candidate flicks: { capId, velocity, kind, u, cut, capDist, hit }.
 * Paths whose first contact isn't the ball are dropped, so a foul or a
 * miskick can never be chosen from this list.
 *
 * @param opts.powers  multipliers applied to the "just enough" power
 * @param opts.banks   include cushion bank shots
 * @param opts.blocks  include no-contact moves (blocks under pressure, repositioning when screened)
 * @param opts.offsets sideways aim offsets across the ball (contact angles)
 */
export function generateCandidates(ctx, { powers = [1.5], banks = false, blocks = false, offsets = [-0.6, 0, 0.6], maxPower = PHYSICS.maxFlickVelocity } = {}) {
  const { positions } = ctx
  const ball = positions.ball
  if (!ball) return []
  const out = []
  const dirs = ballDirections(ctx, { banks })

  for (const capId of eligibleCaps(ctx)) {
    for (const { u, tag } of dirs) {
      // The keeper may only clear, never shoot
      if (isGoalkeeper(capId) && (tag !== 'field' || u.x * ctx.attackDir < 0.2)) continue
      const aim = aimFor(positions, capId, u)
      if (!aim) continue
      const hit = firstHit(positions, capId, aim.dir)
      if (!hit || hit.id !== 'ball') continue

      // How far the ball should roll: to the goal for shots, a long way for clearances
      const goalDist = hyp(ctx.theirGoal.x - ball.x, ctx.theirGoal.y - ball.y)
      const ballDist = tag === 'field' ? 10 : goalDist + 3
      const base = powerFor(aim.dist, ballDist, aim.cut)
      for (const m of powers) {
        const power = Math.min(base * m, maxPower)
        out.push({
          capId, kind: tag, u, cut: aim.cut, capDist: aim.dist, power, hit,
          velocity: { x: aim.dir.x * power, y: aim.dir.y * power },
        })
      }
    }
  }

  // Contact angles: aim across the ball with a sideways offset. Always
  // reachable, so a ball jammed against a cushion can still be played.
  for (const capId of eligibleCaps(ctx)) {
    for (const k of offsets) {
      const aim = aimAcross(positions, capId, k)
      if (!aim) continue
      if (isGoalkeeper(capId) && aim.u.x * ctx.attackDir < 0.2) continue
      const hit = firstHit(positions, capId, aim.dir)
      if (!hit || hit.id !== 'ball') continue
      const base = powerFor(aim.dist, 10, aim.cut)
      for (const m of powers) {
        const power = Math.min(base * m, maxPower)
        out.push({
          capId, kind: 'angle', u: aim.u, cut: aim.cut, capDist: aim.dist, power, hit,
          velocity: { x: aim.dir.x * power, y: aim.dir.y * power },
        })
      }
    }
  }

  if (blocks && !ctx.requiredCapId) {
    // Nothing can reach the ball cleanly: reposition rather than foul or pass
    if (!out.length) out.push(...positionCandidates(ctx))
    out.push(...blockCandidates(ctx))
  }
  return out
}

/** Aim at the ball with a sideways offset k (-1..1 of the combined radius). */
function aimAcross(positions, capId, k) {
  const c = positions[capId]
  const b = positions.ball
  const R = radiusOf(capId) + BALL_RADIUS
  const dx = b.x - c.x
  const dy = b.y - c.y
  const d = hyp(dx, dy)
  if (d <= R) return null
  const off = k * R
  const dir = rotate({ x: dx / d, y: dy / d }, Math.asin(off / d))
  // Where the cap centre is at contact, and which way that sends the ball
  const along = dx * dir.x + dy * dir.y
  const perp2 = dx * dx + dy * dy - along * along
  const t = along - Math.sqrt(Math.max(0, R * R - perp2))
  const px = c.x + dir.x * t
  const py = c.y + dir.y * t
  const lim = radiusOf(capId) + 0.05 // cap fully on the pitch, not grazing the cushion
  if (Math.abs(px) > PITCH.halfW - lim || Math.abs(py) > PITCH.halfH - lim) return null
  const u = unit(b.x - px, b.y - py)
  const cut = dir.x * u.x + dir.y * u.y
  if (cut < MIN_CUT) return null
  return { dir, u, dist: t, cut }
}

/** Park an outfield cap on the line between the ball and our goal, touching nothing. */
function blockCandidates(ctx) {
  const { positions } = ctx
  const ball = positions.ball
  if (dangerLevel(ctx) < 0.3) return []
  const toGoal = unit(ctx.ownGoal.x - ball.x, ctx.ownGoal.y - ball.y)
  const span = hyp(ctx.ownGoal.x - ball.x, ctx.ownGoal.y - ball.y)
  const spots = [3, 5].filter((k) => k <= span - 2)
    .map((k) => ({ x: ball.x + toGoal.x * k, y: ball.y + toGoal.y * k }))
  return moveCandidates(ctx, spots, 'block')
}

/**
 * No clean contact on the ball at all (an opponent screens it): walk a cap
 * round to a spot behind the ball, ready to shoot next turn.
 */
function positionCandidates(ctx) {
  const ball = ctx.positions.ball
  const back = unit(ball.x - ctx.theirGoal.x, ball.y - ctx.theirGoal.y)
  const spots = []
  for (const r of [3, 5]) {
    for (const a of [0, 40, -40, 80, -80]) {
      const v = rotate(back, a * DEG)
      const p = { x: ball.x + v.x * r, y: ball.y + v.y * r }
      if (Math.abs(p.x) < PITCH.halfW - 1 && Math.abs(p.y) < PITCH.halfH - 1) spots.push(p)
    }
  }
  return moveCandidates(ctx, spots, 'position', POSITION_RUNOUT)
}

/** Flicks that slide an outfield cap to a spot without touching anything. */
function moveCandidates(ctx, spots, kind, runout = BLOCK_RUNOUT) {
  const { positions } = ctx
  const out = []
  for (const capId of eligibleCaps(ctx)) {
    if (isGoalkeeper(capId)) continue
    const c = positions[capId]
    for (const spot of spots) {
      const dist = hyp(spot.x - c.x, spot.y - c.y)
      if (dist < 1) continue
      const dir = { x: (spot.x - c.x) / dist, y: (spot.y - c.y) / dist }
      // Must reach the spot without touching anything, even if it overshoots
      if (firstHit(positions, capId, dir, dist + runout)) continue
      const power = Math.sqrt(2 * CAP_DECEL * dist) * 0.95
      out.push({ capId, kind, target: spot, capDist: dist, runout, power, velocity: { x: dir.x * power, y: dir.y * power } })
    }
  }
  return out
}

/* ═══════════════════════════════════════════════════════════
   3. HEURISTIC SCORE (medium, and hard's ranking)
   ═══════════════════════════════════════════════════════════ */

export function heuristicScore(ctx, c) {
  const { positions } = ctx
  const ball = positions.ball
  const danger = dangerLevel(ctx)
  let s = 0

  if (c.kind === 'block') {
    // Only worth it when we're under pressure and nothing better is on
    return -4 + danger * 6 - c.capDist * 0.2
  }
  if (c.kind === 'position') return -5 - c.capDist * 0.2

  // Where does the ball go?
  const theirLine = ctx.theirGoal.x
  const ownLine = ctx.ownGoal.x
  const shot = crossing(ball, c.u, theirLine)
  const mouth = PITCH.goalWidth / 2 - BALL_RADIUS
  if (shot && Math.abs(shot.y) < mouth && !ctx.kickoffGuard) {
    const blocked = shot.bounced ? 0 : blockersOnLine(positions, c.capId, ball, { x: theirLine, y: shot.y })
    s += (shot.bounced ? 7 : 12) - blocked * 7 - Math.abs(shot.y) * 0.5
  }
  const own = crossing(ball, c.u, ownLine)
  if (own && Math.abs(own.y) < mouth + 1.5) s -= 40 // never play toward our own net

  // Rough resting spot of the ball, measured goal-to-goal
  const travel = Math.min(14, (c.power * c.power) / (2 * CAP_DECEL) * 0.25)
  const end = {
    x: Math.max(-PITCH.halfW, Math.min(PITCH.halfW, ball.x + c.u.x * travel)),
    y: Math.max(-PITCH.halfH, Math.min(PITCH.halfH, ball.y + c.u.y * travel)),
  }
  const territory = (p) => hyp(p.x - ownLine, p.y) - hyp(p.x - theirLine, p.y)
  s += (territory(end) - territory(ball)) * (0.25 + danger * 0.35)

  // Clearing: under pressure, anything that moves the ball away from our goal is gold
  if (danger > 0) s += danger * 8 * (c.u.x * ctx.attackDir)

  // Execution: thin cuts and long runs are less reliable
  s -= (1 - c.cut) * 5
  s -= c.capDist * 0.25
  if (isGoalkeeper(c.capId)) s -= 2
  return s
}

/* ═══════════════════════════════════════════════════════════
   4. SIMULATION (hard)
   ═══════════════════════════════════════════════════════════ */

/**
 * Play one flick in a private world for up to maxFrames 60 Hz frames, or
 * until the deadline (a crowded scrum can be many times slower than open play).
 * @returns {{ first, foulAt, verdict, frames, positions }}
 *   first: 'ball' | 'teammate' | 'foul' | null
 */
export function simulateFlick(ctx, capId, velocity, { maxFrames = 150, deadline = Infinity, sim = null } = {}) {
  if (sim) sim.world.reset(ctx.positions)
  else sim = createPlannerWorld(ctx)
  const { world, track } = sim
  const cap = world.bodies[capId]
  const ball = world.bodies.ball
  if (!cap || !ball) return null

  const speed = hyp(velocity.x, velocity.y)
  const s = speed > PHYSICS.maxFlickVelocity ? PHYSICS.maxFlickVelocity / speed : 1
  Body.setVelocity(cap, { x: velocity.x * s, y: velocity.y * s })
  track.capId = capId
  track.first = null
  track.foulAt = null

  let verdict = null
  let frames = 0
  let prev = { x: ball.position.x, y: ball.position.y }
  let ballVel = { x: 0, y: 0 }
  while (frames < maxFrames) {
    world.step(FRAME_MS)
    frames++
    ballVel = { x: ball.position.x - prev.x, y: ball.position.y - prev.y }
    prev = { x: ball.position.x, y: ball.position.y }
    if (track.first === 'foul' && !ctx.penaltyShootout) break
    verdict = judgeGoal({
      x: ball.position.x, y: ball.position.y, team1Side: ctx.team1Side,
      kickoffGuard: ctx.kickoffGuard, lastFlickedCapId: capId,
    })
    if (verdict) break
    if (frames > 5 && settled(world.bodies)) break
    if (frames % 10 === 0 && now() > deadline) break
  }

  const positions = readPositions(world.bodies)
  // Ball still rolling at the horizon: project where it will stop (no bounces)
  const v = hyp(ballVel.x, ballVel.y)
  if (!verdict && v > 0.05) {
    const roll = Math.min((v * v) / (2 * BALL_DECEL), 12)
    positions.ball.x = Math.max(-PITCH.halfW + 0.5, Math.min(PITCH.halfW - 0.5, positions.ball.x + (ballVel.x / v) * roll))
    positions.ball.y = Math.max(-PITCH.halfH + 0.5, Math.min(PITCH.halfH - 0.5, positions.ball.y + (ballVel.y / v) * roll))
  }
  return { first: track.first, foulAt: track.foulAt, verdict, frames, positions }
}

/**
 * A private world for the planner, reusable across candidates, that records
 * the first thing the flicked cap (track.capId) touches.
 */
export function createPlannerWorld(ctx) {
  const world = createSimulationWorld(ctx.positions, { team1Side: ctx.team1Side })
  const track = { capId: null, first: null, foulAt: null }
  Events.on(world.engine, 'collisionStart', (event) => {
    if (!track.capId || track.first) return
    for (const pair of event.pairs) {
      const a = pair.bodyA.label
      const b = pair.bodyB.label
      if (a !== track.capId && b !== track.capId) continue
      const other = a === track.capId ? pair.bodyB : pair.bodyA
      const kind = classifyContact(track.capId, other.label)
      if (kind === 'wall') continue // cushion bounces don't decide anything
      track.first = kind
      if (kind === 'foul') track.foulAt = { x: other.position.x, y: other.position.y }
      return
    }
  })
  return { world, track }
}

function settled(bodies) {
  for (const id in bodies) {
    const v = bodies[id].velocity
    if (hyp(v.x, v.y) > PHYSICS.settleSpeed) return false
  }
  return true
}

/** Higher is better for ctx.team. */
export function scoreOutcome(ctx, out) {
  if (!out) return -Infinity
  if (out.first === 'foul' && !ctx.penaltyShootout) {
    // A foul in our own box is a penalty
    return isInPenaltyArea(out.foulAt.x, out.foulAt.y, ctx.homeDir) ? -900 : -600
  }
  if (out.verdict) {
    if (out.verdict.outcome !== 'goal') return -60 // disallowed: ball back to the centre, turn lost
    if (out.verdict.scorer === ctx.team) return 1000 - out.frames * 0.2
    return -1000
  }

  const { positions } = out
  const b = positions.ball
  const dOwn = hyp(b.x - ctx.ownGoal.x, b.y)
  const dThem = hyp(b.x - ctx.theirGoal.x, b.y)
  let s = (dOwn - dThem) * 1.2

  // They play next: how well placed is their best cap to shoot at our goal?
  s -= shotThreat(positions, ctx.opp, ctx.ownGoal, b) * 45
  // ...and how well placed are we for the turn after
  s += shotThreat(positions, ctx.team, ctx.theirGoal, b) * 12
  if (isInPenaltyArea(b.x, b.y, -ctx.homeDir)) s += 4

  if (out.first !== 'ball') s -= 6 // wasted turn
  return s
}

/** 0..1: best shooting chance for team's outfield caps at goal from ball b. */
function shotThreat(positions, team, goal, b) {
  const toGoal = unit(goal.x - b.x, goal.y - b.y)
  const goalDist = hyp(goal.x - b.x, goal.y - b.y)
  let best = 0
  for (const [id, p] of Object.entries(positions)) {
    if (teamOf(id) !== team || isGoalkeeper(id)) continue
    const dx = b.x - p.x
    const dy = b.y - p.y
    const d = hyp(dx, dy) || 1
    const align = (dx * toGoal.x + dy * toGoal.y) / d
    if (align <= 0) continue
    let t = align * clamp01(1 - d / 12) * clamp01(1.2 - goalDist / 26)
    // Caps standing in the lane make the shot much harder
    if (t > best) t *= Math.pow(0.5, blockersOnLine(positions, id, b, goal))
    if (t > best) best = t
  }
  return best
}

/* ═══════════════════════════════════════════════════════════
   5. CHOOSERS
   ═══════════════════════════════════════════════════════════ */

function jitter(c, noise, rng) {
  if (!noise) return c
  const a = (rng() - 0.5) * noise
  return { ...c, velocity: rotate(c.velocity, a) }
}

/**
 * Medium: best heuristic candidate, with aim noise that is re-checked so it
 * can't turn a clean shot into a foul.
 */
export function chooseHeuristic(ctx, { aimNoise = 0.2, powerMult = 1, rng = Math.random } = {}) {
  const cands = generateCandidates(ctx, {
    powers: [1.6], blocks: true, maxPower: PHYSICS.maxFlickVelocity * powerMult,
  })
  if (!cands.length) return null
  let best = null
  for (const c of cands) {
    const score = heuristicScore(ctx, c) + (rng() - 0.5) * 1.5
    if (!best || score > best.score) best = { ...c, score }
  }
  for (let noise = aimNoise; noise > 0.01; noise /= 2) {
    const j = jitter(best, noise, rng)
    if (safeFlick(ctx, j)) return j
  }
  return best
}

/** The noisy flick still hits what the clean one was meant to hit (ball, or nothing for blocks). */
function safeFlick(ctx, c) {
  const move = c.kind === 'block' || c.kind === 'position'
  const hit = firstHit(ctx.positions, c.capId, c.velocity, move ? c.capDist + c.runout : Infinity)
  return move ? !hit : hit?.id === 'ball'
}

/**
 * Hard: rank candidates by heuristic, then play as many as the time budget
 * allows in a private physics world and keep the best real outcome.
 *
 * @returns {{ capId, velocity, score, simulated, ms }} or null
 */
export function chooseBySimulation(ctx, { budgetMs = 70, maxSims = 40, aimNoise = 0.03, rng = Math.random, maxFrames = 150 } = {}) {
  const start = now()
  const cands = generateCandidates(ctx, { powers: [1.1, 1.7, 2.6], banks: true, blocks: true })
  if (!cands.length) return null

  // Bake a little execution noise into each candidate *before* simulating, so
  // the outcome we score is the flick we'll actually play.
  const ranked = cands
    .map((c) => ({ ...jitter(c, aimNoise, rng), h: heuristicScore(ctx, c) }))
    .filter((c) => safeFlick(ctx, c))
    .sort((a, b) => b.h - a.h)
  if (!ranked.length) return null

  // Keep the list varied: at most a few variants of any one cap
  const perCap = {}
  const pool = []
  for (const c of ranked) {
    perCap[c.capId] = (perCap[c.capId] || 0) + 1
    if (perCap[c.capId] <= Math.ceil(maxSims / 3)) pool.push(c)
    if (pool.length >= maxSims) break
  }

  let best = null
  let simulated = 0
  let slowest = 0
  const sim = createPlannerWorld(ctx)
  for (const c of pool) {
    const elapsed = now() - start
    // Stop before a simulation would blow the budget
    if (simulated > 0 && elapsed + slowest > budgetMs) break
    const t0 = now()
    const out = simulateFlick(ctx, c.capId, c.velocity, { maxFrames, deadline: start + budgetMs, sim })
    const dt = now() - t0
    slowest = Math.max(slowest, dt)
    simulated++
    // Heuristic breaks near-ties; a pinch of randomness keeps it from being robotic
    const score = scoreOutcome(ctx, out) + c.h * 0.05 + (rng() - 0.5) * 0.5
    if (!best || score > best.score) best = { ...c, score, outcome: out }
    if (best.score >= 900) break // a goal — no need to look further
  }

  // Nothing simulated came out better than the first ranked guess
  const pick = best || pool[0]
  return { capId: pick.capId, velocity: pick.velocity, kind: pick.kind, score: pick.score, simulated, ms: now() - start }
}
