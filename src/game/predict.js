/**
 * Aim preview maths: where a flicked cap goes, what it touches first and — if
 * that's the ball — where the ball runs afterwards.
 *
 * Pure functions (no three.js, store or engine) so they can be unit tested.
 * Coordinates and units are Matter.js's, as in PhysicsWorld: (x, y) on the
 * pitch, velocity = distance per 16.67 ms base frame. The model follows what
 * the engine actually does, not ideal billiards:
 *
 * - Friction is a constant deceleration: linearFriction per base frame for
 *   caps, half that for the ball (PhysicsWorld applies it per sub-step, with
 *   subSteps sub-steps per base frame). Speeds are capped at 1.5x max flick.
 * - Matter's "circles" are regular decagons that never rotate (inertia is
 *   Infinity), so every contact normal is one of 10 fixed directions 36° apart.
 * - Matter only applies restitution when the closing speed along the normal
 *   is at least RESTING_SPEED; slower contacts are dead (a slow ball slides
 *   along the cushion instead of bouncing).
 *
 * Nothing here allocates per call: results go into an object made once with
 * createPrediction(), so it can run every frame while aiming.
 */

import { PITCH, PHYSICS, CAP_RADIUS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { isGoalkeeper, teamOf, teamHomeDir } from './rules'

/** Sides of the polygon Matter uses for every circle body of our sizes (Bodies.circle: max(10, radius)). */
export const BODY_SIDES = 10
/** Matter.Resolver._restingThresh — below this closing speed a contact doesn't bounce. */
const RESTING_SPEED = 2
/** Ball restitution set in PhysicsWorld's createCapBody (a pair uses the higher of the two). */
const BALL_RESTITUTION = 0.95
/** Measured: a slow cap→ball contact (resting branch) behaves like restitution ~0.08. */
const SLOW_CONTACT_BOUNCE = 0.08

const MAX_SPEED = PHYSICS.maxFlickVelocity * 1.5
const CAP_DECEL = PHYSICS.linearFriction
const BALL_DECEL = PHYSICS.linearFriction * 0.5
const CAP_WALL_E = PHYSICS.restitution
const BALL_WALL_E = Math.max(PHYSICS.restitution, BALL_RESTITUTION)
const CAP_BALL_E = Math.max(PHYSICS.restitution, BALL_RESTITUTION)

/** Cushions shown on the ball's path (it ends at the next one). */
export const BALL_BOUNCES = 2
/** Cushions the cap may bank off before we stop looking for its first contact. */
const CAP_BOUNCES = 2
const CAP_MAX_LEN = 60
const BALL_MAX_LEN = 45
const MAX_POINTS = 8
const EPS = 1e-9

// Face normals of the (unrotated) decagon: Matter puts vertices at 18° + 36°k,
// so the faces point along 0°, 36°, 72°, ...
const NX = new Float64Array(BODY_SIDES)
const NY = new Float64Array(BODY_SIDES)
for (let k = 0; k < BODY_SIDES; k++) {
  NX[k] = Math.cos((2 * Math.PI * k) / BODY_SIDES)
  NY[k] = Math.sin((2 * Math.PI * k) / BODY_SIDES)
}
const APOTHEM = Math.cos(Math.PI / BODY_SIDES)

// Scratch results (module level so nothing is allocated per call)
const sweepHit = { nx: 0, ny: 0 }
const wallHit = { nx: 0, ny: 0 }

/**
 * Distance a body moving from (x, y) along unit (ux, uy) travels before it
 * touches a resting body at (cx, cy), or -1 if it never does. Two decagons with
 * the same orientation touch exactly when their centre offset reaches the edge
 * of a decagon of circumradius rSum, so this is a ray-vs-convex-polygon test.
 * The contact normal (from the resting body towards the mover) is left in sweepHit.
 */
function sweep(x, y, ux, uy, cx, cy, rSum) {
  const qx = x - cx
  const qy = y - cy
  const a = rSum * APOTHEM
  let tIn = -Infinity, tOut = Infinity, kIn = -1
  let kNear = 0, dNear = -Infinity
  for (let k = 0; k < BODY_SIDES; k++) {
    const d = qx * NX[k] + qy * NY[k] - a // > 0: outside this face
    const dn = ux * NX[k] + uy * NY[k]
    if (d > dNear) { dNear = d; kNear = k }
    if (Math.abs(dn) < EPS) {
      if (d > 0) return -1
      continue
    }
    const t = -d / dn
    if (dn < 0) {
      if (t > tIn) { tIn = t; kIn = k }
    } else if (t < tOut) {
      tOut = t
    }
  }
  if (tIn > tOut || tOut < 0) return -1
  if (tIn < 0) {
    // Already touching: only counts if moving into it (Matter picks the least-overlap face)
    if (ux * NX[kNear] + uy * NY[kNear] >= 0) return -1
    kIn = kNear
    tIn = 0
  }
  sweepHit.nx = NX[kIn]
  sweepHit.ny = NY[kIn]
  return tIn
}

/** Face of the Minkowski decagon nearest to offset (qx, qy) — least overlap — into sweepHit. */
function nearestFace(qx, qy) {
  let best = -Infinity
  for (let k = 0; k < BODY_SIDES; k++) {
    const d = qx * NX[k] + qy * NY[k]
    if (d > best) { best = d; sweepHit.nx = NX[k]; sweepHit.ny = NY[k] }
  }
}

/**
 * How deep a body launched at speed v0 has pushed into another by the first
 * sub-step at which they overlap, given it first touches after `dist`.
 * Matter moves (v - k·f)/subSteps per sub-step (friction f applied first, 60 Hz
 * frames) and only then notices the overlap.
 */
function subStepDepth(v0, decel, dist) {
  const S = PHYSICS.subSteps
  const f = decel / S
  // Distance after k sub-steps: (k·v0 − f·k(k+1)/2) / S. Smallest k reaching dist:
  const b = v0 - f / 2
  const disc = b * b - 2 * f * S * dist
  if (disc < 0) return 0
  const k = Math.max(1, Math.ceil((2 * S * dist) / (b + Math.sqrt(disc)) - 1e-9))
  return Math.max(0, (k * v0 - (f * k * (k + 1)) / 2) / S - dist)
}

/** Distance to the edge of a box of allowed centre positions; inward normal left in wallHit. */
function boxExit(x, y, ux, uy, minX, maxX, minY, maxY) {
  let t = Infinity
  if (ux > EPS) { t = (maxX - x) / ux; wallHit.nx = -1; wallHit.ny = 0 }
  else if (ux < -EPS) { t = (minX - x) / ux; wallHit.nx = 1; wallHit.ny = 0 }
  if (uy > EPS) {
    const ty = (maxY - y) / uy
    if (ty < t) { t = ty; wallHit.nx = 0; wallHit.ny = -1 }
  } else if (uy < -EPS) {
    const ty = (minY - y) / uy
    if (ty < t) { t = ty; wallHit.nx = 0; wallHit.ny = 1 }
  }
  return t < 0 ? 0 : t
}

/** Speed left after sliding `dist` from speed v with constant deceleration. */
function slowed(v, decel, dist) {
  const v2 = v * v - 2 * decel * dist
  return v2 > 0 ? Math.sqrt(v2) : 0
}

function push(path, i, x, y) {
  path[i * 2] = x
  path[i * 2 + 1] = y
  return i + 1
}

/** Output buffer for predictShot. Make one and reuse it. */
export function createPrediction() {
  return {
    /** First thing the cap touches: 'ball' | 'foul' (opponent cap) | 'teammate' | 'none' */
    contact: 'none',
    /** The touching point of that first contact */
    contactX: 0,
    contactY: 0,
    /** Contact normal, pointing from the touched body towards the cap */
    normalX: 0,
    normalY: 0,
    /** Cap centre polyline [x0, y0, x1, y1, ...]: start, cushions, position at contact/stop */
    capPath: new Float64Array(MAX_POINTS * 2),
    capPoints: 0,
    /** Ball polyline after contact: ball centre, cushions, end */
    ballPath: new Float64Array(MAX_POINTS * 2),
    ballPoints: 0,
    /** Ball speed just after the hit */
    ballSpeed: 0,
    /** How the ball path ends: 'goal' | 'cap' | 'cushion' | 'stop' | 'far' | 'none' */
    end: 'none',
    /** Goal the ball goes into: -1 left, +1 right, 0 none */
    goalDir: 0,
    /** Cushions the ball bounces off before the end */
    bounces: 0,
  }
}

/** Plain input object for predictShot (make once, fill each frame). */
export function createShot(maxBodies = 10) {
  const bodies = []
  for (let i = 0; i < maxBodies; i++) bodies.push({ x: 0, y: 0, r: CAP_RADIUS, contact: 'foul' })
  return {
    x: 0, y: 0, r: CAP_RADIUS, mass: PHYSICS.playerMass, // flicked cap
    vx: 0, vy: 0,                                         // flick velocity, as passed to performFlick
    ballX: 0, ballY: 0,
    bodies, bodyCount: 0,                                  // other caps: { x, y, r, contact: 'foul' | 'teammate' }
    minX: 0, maxX: 0, minY: 0, maxY: 0,                    // where the cap's centre can go (capBounds)
  }
}

/**
 * Where a cap's centre may go: the pitch minus its radius, or for a keeper its
 * own penalty area (mirrors clampAllBodies). Writes minX/maxX/minY/maxY into out.
 */
export function capBounds(capId, team1Side, out) {
  const { halfW, halfH } = PITCH
  const r = isGoalkeeper(capId) ? GK_RADIUS : CAP_RADIUS
  out.minX = -halfW + r
  out.maxX = halfW - r
  out.minY = -halfH + r
  out.maxY = halfH - r
  if (isGoalkeeper(capId)) {
    const home = teamHomeDir(teamOf(capId), team1Side)
    if (home === -1) out.maxX = -halfW + PITCH.penAreaW - r
    else out.minX = halfW - PITCH.penAreaW + r
    out.minY = -PITCH.penAreaH / 2 + r
    out.maxY = PITCH.penAreaH / 2 - r
  }
  return out
}

/**
 * Predict a flick: trace the cap (banking off cushions) to its first contact;
 * if that's the ball, work out the ball's velocity from the hit and trace it
 * until a goal, a cap, the (BALL_BOUNCES + 1)th cushion, or it stops.
 */
export function predictShot(shot, out = createPrediction()) {
  out.contact = 'none'
  out.end = 'none'
  out.goalDir = 0
  out.bounces = 0
  out.ballPoints = 0
  out.ballSpeed = 0

  let x = shot.x, y = shot.y
  let vx = shot.vx, vy = shot.vy
  let speed = Math.hypot(vx, vy)
  // applyFlick clamps to max power
  if (speed > PHYSICS.maxFlickVelocity) {
    vx *= PHYSICS.maxFlickVelocity / speed
    vy *= PHYSICS.maxFlickVelocity / speed
    speed = PHYSICS.maxFlickVelocity
  }
  const v0 = speed
  let n = push(out.capPath, 0, x, y)
  let bounces = 0, travelled = 0
  const bodies = shot.bodies
  const bodyCount = shot.bodyCount ?? bodies.length

  // ── Cap: first contact ──
  while (speed > EPS && n < MAX_POINTS) {
    const ux = vx / speed, uy = vy / speed
    const tStop = (speed * speed) / (2 * CAP_DECEL)
    let t = Math.min(tStop, CAP_MAX_LEN - travelled)
    let kind = 'stop', nx = 0, ny = 0, ox = 0, oy = 0, or = 0

    const tb = sweep(x, y, ux, uy, shot.ballX, shot.ballY, shot.r + BALL_RADIUS)
    if (tb >= 0 && tb < t) {
      t = tb; kind = 'ball'; nx = sweepHit.nx; ny = sweepHit.ny
      ox = shot.ballX; oy = shot.ballY; or = BALL_RADIUS
    }
    for (let i = 0; i < bodyCount; i++) {
      const b = bodies[i]
      const tc = sweep(x, y, ux, uy, b.x, b.y, shot.r + b.r)
      if (tc >= 0 && tc < t) {
        t = tc; kind = b.contact; nx = sweepHit.nx; ny = sweepHit.ny
        ox = b.x; oy = b.y; or = b.r
      }
    }
    const tw = boxExit(x, y, ux, uy, shot.minX, shot.maxX, shot.minY, shot.maxY)
    if (tw < t) { t = tw; kind = 'wall'; nx = wallHit.nx; ny = wallHit.ny }

    x += ux * t
    y += uy * t
    travelled += t
    speed = slowed(speed, CAP_DECEL, t)
    vx = ux * speed
    vy = uy * speed
    n = push(out.capPath, n, x, y)

    if (kind === 'wall') {
      // Cushions don't count as a contact (classifyContact 'wall'): bounce and keep looking
      if (++bounces > CAP_BOUNCES) break
      const vn = vx * nx + vy * ny
      const k = -vn >= RESTING_SPEED ? 1 + CAP_WALL_E : 1
      vx -= k * vn * nx
      vy -= k * vn * ny
      speed = Math.hypot(vx, vy)
      continue
    }
    if (kind === 'stop') break

    out.contactX = ox + nx * or
    out.contactY = oy + ny * or
    if (kind === 'ball') {
      // Matter resolves the hit a sub-step late, off the face of least overlap
      // by then — near a decagon corner that's the neighbouring face. Straight
      // off the flick the sub-step timing is known; after a cushion use half a step.
      const depth = bounces === 0
        ? subStepDepth(v0, CAP_DECEL, travelled)
        : speed / (2 * PHYSICS.subSteps)
      nearestFace(x + ux * depth - ox, y + uy * depth - oy)
      nx = sweepHit.nx
      ny = sweepHit.ny
    }
    out.contact = kind
    out.normalX = nx
    out.normalY = ny
    if (kind === 'ball') {
      // Frictionless hit: the ball takes an impulse along the contact normal only
      const closing = -(vx * nx + vy * ny)
      const e = closing >= RESTING_SPEED ? CAP_BALL_E : SLOW_CONTACT_BOUNCE
      const ballSpeed = Math.min(((1 + e) * shot.mass) / (shot.mass + PHYSICS.ballMass) * closing, MAX_SPEED)
      out.ballSpeed = ballSpeed
      traceBall(shot, -nx * ballSpeed, -ny * ballSpeed, out)
    }
    break
  }
  out.capPoints = n
  return out
}

/** Ball from its resting spot with velocity (vx, vy): cushions, goal mouths, caps. */
function traceBall(shot, vx, vy, out) {
  const { halfW, halfH } = PITCH
  const goalHalf = PITCH.goalWidth / 2
  const lim = halfW - BALL_RADIUS
  const limY = halfH - BALL_RADIUS
  const bodies = shot.bodies
  const bodyCount = shot.bodyCount ?? bodies.length

  let x = shot.ballX, y = shot.ballY
  let speed = Math.hypot(vx, vy)
  let n = push(out.ballPath, 0, x, y)
  let travelled = 0
  out.end = 'stop'

  while (speed > EPS && n < MAX_POINTS) {
    const ux = vx / speed, uy = vy / speed
    const tStop = (speed * speed) / (2 * BALL_DECEL)
    const room = BALL_MAX_LEN - travelled
    let t = Math.min(tStop, room)
    let kind = tStop <= room ? 'stop' : 'far', nx = 0, ny = 0

    for (let i = 0; i < bodyCount; i++) {
      const b = bodies[i]
      const tc = sweep(x, y, ux, uy, b.x, b.y, BALL_RADIUS + b.r)
      if (tc >= 0 && tc < t) { t = tc; kind = 'cap' }
    }
    let tw = boxExit(x, y, ux, uy, -lim, lim, -limY, limY)
    let wall = 'wall'
    if (wallHit.nx !== 0 && Math.abs(y + uy * tw) < goalHalf) {
      // Through the goal mouth: the goal counts once the centre crosses the line
      tw = ((ux > 0 ? halfW : -halfW) - x) / ux
      wall = 'goal'
    }
    if (tw < t) { t = tw; kind = wall; nx = wallHit.nx; ny = wallHit.ny }

    x += ux * t
    y += uy * t
    travelled += t
    speed = slowed(speed, BALL_DECEL, t)
    vx = ux * speed
    vy = uy * speed
    n = push(out.ballPath, n, x, y)

    if (kind === 'goal') {
      out.end = 'goal'
      out.goalDir = ux > 0 ? 1 : -1
      break
    }
    if (kind === 'wall') {
      if (out.bounces >= BALL_BOUNCES) { out.end = 'cushion'; break }
      out.bounces++
      const vn = vx * nx + vy * ny
      const k = -vn >= RESTING_SPEED ? 1 + BALL_WALL_E : 1 // too slow to bounce: slides along it
      vx -= k * vn * nx
      vy -= k * vn * ny
      speed = Math.hypot(vx, vy)
      out.end = 'stop'
      continue
    }
    out.end = kind
    break
  }
  out.ballPoints = n
}

/**
 * Whose goal a predicted ball goes into, from the flicking cap's side:
 * 'score' (opponent's goal), 'own' or null.
 */
export function goalFor(prediction, capId, team1Side = 'left') {
  if (prediction.end !== 'goal' || !prediction.goalDir) return null
  return prediction.goalDir === teamHomeDir(teamOf(capId), team1Side) ? 'own' : 'score'
}
