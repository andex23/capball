/**
 * CAPBALL Physics System
 * ─────────────────────────────────────────────────────────
 * Clean, crisp, deterministic tabletop football physics.
 *
 * Design:
 * - Matter.js 2D engine, zero gravity
 * - Circle bodies for caps and ball
 * - Static rectangle bodies for walls
 * - Fixed substep updates for stability
 * - Linear damping per-step (not per-frame) for consistent friction
 * - Wall bounce via restitution + safety reflection clamp
 * - First-contact tracking for foul detection
 * - Sound effects on collisions
 *
 * Objects:
 * - 12 caps (6 per team: gk, def1, def2, mid, atk1, atk2)
 * - 1 ball
 * - Static walls (pitch boundary, goal areas, goal blockers)
 *
 * Key rules:
 * - Caps are heavy, ball is light
 * - Ball bounces more elastically than caps
 * - Everything gradually stops via linear friction
 * - Turn ends only when ALL bodies below settle threshold for N ms
 * - First collision of flicked cap determines legal/foul/miskick
 * ─────────────────────────────────────────────────────────
 */

import Matter from 'matter-js'
import { PITCH, CAP_RADIUS, GK_RADIUS, BALL_RADIUS, PHYSICS, getFormationPositions } from '../data/TeamData'
import { playFoulWhistle, playBallHit, playCapHit, playWallHit } from '../audio/SoundManager'
import { useMatchStore, PHASE, later } from '../state/MatchStore'
import { teamHomeDir, teamOf, classifyContact, isInPenaltyArea, otherTeam } from '../game/rules'

const { Engine, World, Bodies, Body, Events } = Matter

// Matter.js is built for pixel-sized worlds: below this closing speed it
// treats a contact as "resting" and kills the bounce. Our pitch is ~30 units
// long, so the stock value (2) made slow caps and balls die on the cushions.
if (Number.isFinite(PHYSICS.restingSpeed)) Matter.Resolver._restingThresh = PHYSICS.restingSpeed

// Matter approximates small circles with 10-sided polygons, so a cap and the
// ball used to meet face-to-face: glancing hits went off at the wrong angle
// (up to 18° out). Bodies are now 32-gons, and for two round bodies the
// contact normal, depth and penetration are replaced by the exact
// circle-circle values — the ball leaves along the line between the centres.
export const CIRCLE_SIDES = 32
if (!Matter.Collision.__capballCircles) {
  const polygonCollides = Matter.Collision.collides
  Matter.Collision.collides = function circleAwareCollides(bodyA, bodyB, pairs) {
    const c = polygonCollides(bodyA, bodyB, pairs)
    if (!c) return c
    const A = c.bodyA
    const B = c.bodyB
    const ra = A.circleRadius
    const rb = B.circleRadius
    if (!ra || !rb) return c
    // q: from B's centre to A's; w: how far A moved relative to B this step
    const qx = A.position.x - B.position.x
    const qy = A.position.y - B.position.y
    const d = Math.sqrt(qx * qx + qy * qy)
    if (d < 1e-9) return c
    const R = ra + rb
    const depth = Math.max(0, R - d)
    // Overlap is only noticed a step late, by which time the centres have
    // slid past the true point of contact. Step back along the relative
    // motion to where they first touched and take the normal from there.
    const wx = (A.position.x - A.positionPrev.x) - (B.position.x - B.positionPrev.x)
    const wy = (A.position.y - A.positionPrev.y) - (B.position.y - B.positionPrev.y)
    const ww = wx * wx + wy * wy
    let nx = qx / d
    let ny = qy / d
    if (ww > 1e-12) {
      const qw = qx * wx + qy * wy
      const disc = qw * qw - ww * (d * d - R * R)
      const back = disc >= 0 ? (qw + Math.sqrt(disc)) / ww : -1
      if (back > 0 && back <= 1) {
        nx = (qx - wx * back) / R
        ny = (qy - wy * back) / R
      }
    }
    // Matter's convention: the normal points from B towards A
    c.normal.x = nx
    c.normal.y = ny
    c.tangent.x = -ny
    c.tangent.y = nx
    c.depth = depth
    c.penetration.x = nx * depth
    c.penetration.y = ny * depth
    return c
  }
  Matter.Collision.__capballCircles = true
}

const PEN_AREA_W = PITCH.penAreaW
const PEN_AREA_H = PITCH.penAreaH

// Collision categories
const CAT_DEFAULT = 0x0001
const CAT_GOAL_BLOCKER = 0x0002

let engine = null
let bodies = {}
let lastBallTeam = null // 'team1' | 'team2' | null — last side to touch the ball
// Has the ball come off a cushion since a cap last touched it? A goal that
// goes in off the wall doesn't count (rules.judgeGoal → 'bank_shot').
let ballBanked = false
export const getBallBanked = () => ballBanked

/** Direction of a team's own goal for the current half. -1 = left, +1 = right */
function getTeamDir(team) {
  return teamHomeDir(team, useMatchStore.getState().team1Side || 'left')
}

export function radiusOf(id) {
  if (id === 'ball') return BALL_RADIUS
  return id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS
}

function getTeam1Side() {
  return useMatchStore.getState().team1Side || 'left'
}

/** Static pitch boundary, goal nets and goal-mouth cap blockers (shared by every world). */
function createWallBodies() {
  const { halfW, halfH, goalWidth, goalDepth } = PITCH
  const goalHalf = goalWidth / 2

  // ── Static walls — thick for reliable collision ──
  const wallThick = 3 // thick walls prevent tunneling
  const wallOpts = { isStatic: true, restitution: PHYSICS.restitution, friction: 0, frictionStatic: 0 }

  // Top & bottom walls
  const topWall = Bodies.rectangle(0, -halfH - wallThick / 2, PITCH.width + wallThick * 4, wallThick, wallOpts)
  const bottomWall = Bodies.rectangle(0, halfH + wallThick / 2, PITCH.width + wallThick * 4, wallThick, wallOpts)

  // Left side walls (with goal gap)
  const sideH = (halfH * 2 - goalWidth) / 2
  const leftTop = Bodies.rectangle(-halfW - wallThick / 2, -halfH + sideH / 2, wallThick, sideH, wallOpts)
  const leftBottom = Bodies.rectangle(-halfW - wallThick / 2, halfH - sideH / 2, wallThick, sideH, wallOpts)

  // Right side walls
  const rightTop = Bodies.rectangle(halfW + wallThick / 2, -halfH + sideH / 2, wallThick, sideH, wallOpts)
  const rightBottom = Bodies.rectangle(halfW + wallThick / 2, halfH - sideH / 2, wallThick, sideH, wallOpts)

  // Goal back walls — thick to prevent tunneling
  const backThick = 3
  const leftGoalBack = Bodies.rectangle(-halfW - goalDepth - backThick / 2, 0, backThick, goalWidth + 2, wallOpts)
  // Side nets: from the goal line backwards only. (They used to be centred on
  // the net, which pushed half their thickness 1.5 units out onto the pitch
  // beside each post: an invisible block that stopped corners and shots along
  // the end line.)
  const sideLen = goalDepth + wallThick
  const leftGoalTop = Bodies.rectangle(-halfW - sideLen / 2, -goalHalf - wallThick / 2, sideLen, wallThick, wallOpts)
  const leftGoalBottom = Bodies.rectangle(-halfW - sideLen / 2, goalHalf + wallThick / 2, sideLen, wallThick, wallOpts)
  const rightGoalBack = Bodies.rectangle(halfW + goalDepth + backThick / 2, 0, backThick, goalWidth + 2, wallOpts)
  const rightGoalTop = Bodies.rectangle(halfW + sideLen / 2, -goalHalf - wallThick / 2, sideLen, wallThick, wallOpts)
  const rightGoalBottom = Bodies.rectangle(halfW + sideLen / 2, goalHalf + wallThick / 2, sideLen, wallThick, wallOpts)

  // Goal blockers — invisible walls that block CAPS but allow BALL through
  const blockerOpts = {
    isStatic: true,
    restitution: PHYSICS.restitution,
    friction: 0,
    frictionStatic: 0,
    collisionFilter: { category: CAT_GOAL_BLOCKER, mask: CAT_DEFAULT },
  }
  const leftGoalBlocker = Bodies.rectangle(-halfW - wallThick / 2, 0, wallThick, goalWidth, blockerOpts)
  const rightGoalBlocker = Bodies.rectangle(halfW + wallThick / 2, 0, wallThick, goalWidth, blockerOpts)

  return [
    topWall, bottomWall,
    leftTop, leftBottom, rightTop, rightBottom,
    leftGoalBack, leftGoalTop, leftGoalBottom,
    rightGoalBack, rightGoalTop, rightGoalBottom,
    leftGoalBlocker, rightGoalBlocker,
  ]
}

// ── Per-step friction & velocity cap ──
const SUB_STEPS = PHYSICS.subSteps || 8
const CAP_FRICTION_PER_STEP = PHYSICS.linearFriction / SUB_STEPS
const BALL_FRICTION_PER_STEP = (PHYSICS.linearFriction * PHYSICS.ballFrictionRatio) / SUB_STEPS
const MAX_SPEED = PHYSICS.maxFlickVelocity * 1.5

/** Linear friction + hard speed cap for one sub-step, applied to a map of dynamic bodies. */
function applyStepFriction(bodies) {
  for (const key in bodies) {
    const body = bodies[key]
    let vx = body.velocity.x
    let vy = body.velocity.y
    let speed = Math.sqrt(vx * vx + vy * vy)

    // Hard velocity cap — prevents tunneling through walls
    if (speed > MAX_SPEED) {
      const s = MAX_SPEED / speed
      vx *= s
      vy *= s
      speed = MAX_SPEED
    }

    // Linear friction — constant deceleration per step
    const friction = key === 'ball' ? BALL_FRICTION_PER_STEP : CAP_FRICTION_PER_STEP

    if (speed <= friction) {
      // Below threshold — stop completely
      Body.setVelocity(body, { x: 0, y: 0 })
    } else {
      // Scale down velocity
      const scale = (speed - friction) / speed
      Body.setVelocity(body, { x: vx * scale, y: vy * scale })
    }
  }
}

/* Keeper grip: a goalkeeper meeting the ball stands firm. Whether he's struck
   by a shot or punches a clearance himself, he loses most of his own speed
   at the contact, so he isn't knocked about by shots and doesn't charge off
   up the pitch after the ball and leave the goal empty. The ball still
   takes the full impulse (the damping happens after the contact resolves).
   Shared by the live engine and the planner's private worlds. */
export const KEEPER_GRIP = 0.25
function attachKeeperGrip(eng, bodyMap) {
  const gripped = new Set()
  Events.on(eng, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.label
      const b = pair.bodyB.label
      if (a === 'ball' && b?.endsWith?.('_gk')) gripped.add(b)
      else if (b === 'ball' && a?.endsWith?.('_gk')) gripped.add(a)
    }
  })
  Events.on(eng, 'afterUpdate', () => {
    if (!gripped.size) return
    for (const id of gripped) {
      const k = bodyMap()[id]
      if (k) Body.setVelocity(k, { x: k.velocity.x * KEEPER_GRIP, y: k.velocity.y * KEEPER_GRIP })
    }
    gripped.clear()
  })
}

/* ═══════════════════════════════════════════════════════════
   1. WORLD CREATION
   ═══════════════════════════════════════════════════════════ */

export function createPhysicsWorld() {
  diveStop = null
  // Destroy previous engine if exists
  if (engine) {
    World.clear(engine.world)
    Engine.clear(engine)
  }

  engine = Engine.create({
    positionIterations: 20,   // high iterations = reliable collision resolution
    velocityIterations: 20,   // prevents objects sinking into walls
  })
  engine.gravity.x = 0
  engine.gravity.y = 0

  World.add(engine.world, createWallBodies())

  // ── Create dynamic bodies ──
  bodies = {}
  createTeamBodies('team1')
  createTeamBodies('team2')
  createBallBody()

  // ── EVENT: First-contact tracking for foul detection ──
  Events.on(engine, 'collisionStart', (event) => {
    const store = useMatchStore.getState()
    const { phase, lastFlickedCapId, firstCollisionTracked, activeTeam, penaltyShootout } = store
    if (phase !== PHASE.RESOLVE || !lastFlickedCapId || firstCollisionTracked) return

    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label]
      if (!labels.includes(lastFlickedCapId)) continue

      const other = labels[0] === lastFlickedCapId ? labels[1] : labels[0]
      const contact = classifyContact(lastFlickedCapId, other)
      // Cushion bounces don't decide anything — keep watching.
      if (contact === 'wall') continue

      store.setFirstCollisionTracked(true)
      if (contact === 'ball') { store.bumpStat(activeTeam, 'shots'); return }
      if (contact !== 'foul' || penaltyShootout) return

      // Opponent cap hit before the ball = foul
      const foulBody = pair.bodyA.label === other ? pair.bodyA : pair.bodyB
      const foulSpot = { x: foulBody.position.x, y: foulBody.position.y }
      const inPenaltyBox = isInPenaltyArea(foulSpot.x, foulSpot.y, getTeamDir(activeTeam))

      playFoulWhistle()
      later(() => {
        // The half may have ended (or a goal gone in) in the meantime.
        const s = useMatchStore.getState()
        if (s.phase !== PHASE.RESOLVE || s.lastFlickedCapId !== lastFlickedCapId) return
        stopAll()
        s.callFoul(foulSpot, teamOf(other), inPenaltyBox)
      }, 300)
      return
    }
  })

  // ── EVENT: Who touched the ball last (decides corner kick vs goal kick) ──
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.label
      const b = pair.bodyB.label
      if (a !== 'ball' && b !== 'ball') continue
      const team = teamOf(a === 'ball' ? b : a)
      if (team) { lastBallTeam = team; ballBanked = false } else ballBanked = true
    }
  })

  // ── EVENT: Sound effects on collisions ──
  let lastSoundTime = 0
  Events.on(engine, 'collisionStart', (event) => {
    const now = Date.now()
    if (now - lastSoundTime < 60) return
    for (const pair of event.pairs) {
      const a = pair.bodyA.label || ''
      const b = pair.bodyB.label || ''
      const hasBall = a === 'ball' || b === 'ball'
      const capCount = (a.startsWith('team') ? 1 : 0) + (b.startsWith('team') ? 1 : 0)
      // How hard they met: closing speed, 0..1 of a full-power flick
      const va = pair.bodyA.velocity
      const vb = pair.bodyB.velocity
      const hit = Math.min(1, Math.hypot(va.x - vb.x, va.y - vb.y) / PHYSICS.maxFlickVelocity)
      if (hit < 0.04) continue // a gentle touch makes no sound
      if (hasBall && capCount) playBallHit(hit)
      else if (capCount === 2) playCapHit(hit)
      else playWallHit(hit)
      lastSoundTime = now
      return
    }
  })

  // ── EVENT: Per-step friction + velocity cap ──
  Events.on(engine, 'beforeUpdate', () => applyStepFriction(bodies))
  attachKeeperGrip(engine, () => bodies)

  return engine
}

/* ═══════════════════════════════════════════════════════════
   2. BODY CREATION
   ═══════════════════════════════════════════════════════════ */

/** A cap or the ball, not yet added to any world. Radius and mass follow from the id. */
function makeDynamicBody(id, x, y) {
  const isBall = id === 'ball'
  const mass = isBall ? PHYSICS.ballMass : (id.endsWith('_gk') ? PHYSICS.gkMass : PHYSICS.playerMass)
  const r = radiusOf(id)
  const body = Bodies.polygon(x, y, CIRCLE_SIDES, r, {
    circleRadius: r,
    friction: 0,
    frictionStatic: 0,
    frictionAir: isBall ? 0 : 0.001, // ball has zero air drag, caps have minimal
    restitution: isBall ? PHYSICS.ballRestitution : PHYSICS.restitution,
    label: id,
    slop: 0.001,  // very tight — prevents sinking into walls
    collisionFilter: isBall
      ? { category: CAT_DEFAULT, mask: CAT_DEFAULT }
      : { category: CAT_DEFAULT, mask: CAT_DEFAULT | CAT_GOAL_BLOCKER },
  })
  Body.setMass(body, mass)
  Body.setInertia(body, Infinity) // no rotation — pure translation
  return body
}

function createCapBody(id, x, y) {
  const body = makeDynamicBody(id, x, y)
  World.add(engine.world, body)
  bodies[id] = body
  return body
}

function createTeamBodies(team) {
  const formations = useMatchStore.getState().formations
  const formationKey = formations?.[team] || 'default'
  const pos = getFormationPositions(team, formationKey, getTeam1Side())
  createCapBody(`${team}_gk`, pos.gk.x, pos.gk.y)
  createCapBody(`${team}_def1`, pos.def1.x, pos.def1.y)
  createCapBody(`${team}_def2`, pos.def2.x, pos.def2.y)
  createCapBody(`${team}_mid`, pos.mid.x, pos.mid.y)
  createCapBody(`${team}_atk1`, pos.atk1.x, pos.atk1.y)
  createCapBody(`${team}_atk2`, pos.atk2.x, pos.atk2.y)
}

function createBallBody() {
  createCapBody('ball', 0, 0)
}

/* ═══════════════════════════════════════════════════════════
   3. GETTERS & ACTIONS
   ═══════════════════════════════════════════════════════════ */

export function getEngine() { return engine }
export function getBodies() { return bodies }
export function getBody(id) { return bodies[id] }

/** Apply shot impulse to a cap */
export function applyFlick(capId, velocity, maxSpeed = PHYSICS.maxFlickVelocity) {
  const body = bodies[capId]
  if (!body) return
  // Clamp to max flick velocity
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)
  if (speed > maxSpeed) {
    const s = maxSpeed / speed
    velocity = { x: velocity.x * s, y: velocity.y * s }
  }
  Body.setVelocity(body, velocity)
}

/** Check if all bodies are below settle threshold */
export function allBodiesSettled() {
  const threshold = PHYSICS.settleSpeed
  for (const key in bodies) {
    const body = bodies[key]
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2)
    if (speed > threshold) return false
  }
  return true
}

export function stopBall() {
  const ball = bodies.ball
  if (ball) { Body.setVelocity(ball, { x: 0, y: 0 }); Body.setAngularVelocity(ball, 0) }
}

export function resetBallToCenter() {
  const ball = bodies.ball
  if (ball) { Body.setPosition(ball, { x: 0, y: 0 }); Body.setVelocity(ball, { x: 0, y: 0 }) }
}

export function stopAllBodies() {
  for (const key in bodies) {
    Body.setVelocity(bodies[key], { x: 0, y: 0 })
    Body.setAngularVelocity(bodies[key], 0)
  }
}

function stopAll() { stopAllBodies() }

/* ═══════════════════════════════════════════════════════════
   4. SAFETY CLAMP

   Matter.js walls handle ALL normal bouncing via restitution.
   This clamp ONLY handles:
   - GK confinement to penalty area (no physical walls for this)
   - Extreme tunneling rescue (body went >1 unit past wall boundary)

   For the ball and normal caps: DO NOT interfere with normal
   wall-contact bounces. Only rescue if they've fully escaped.
   ═══════════════════════════════════════════════════════════ */

export function clampAllBodies() {
  clampBodyMap(bodies, getTeam1Side())
}

/** GK confinement + tunnelling rescue for any map of dynamic bodies. */
function clampBodyMap(bodies, team1Side) {
  const { halfW, halfH, goalWidth, goalDepth } = PITCH
  const goalHalf = goalWidth / 2
  const backWallX = halfW + goalDepth
  const penHalfH = PEN_AREA_H / 2
  const bounce = PHYSICS.restitution

  // Tunneling threshold — only intervene if body is this far past the wall
  const tunnelThreshold = 1.0

  for (const [id, body] of Object.entries(bodies)) {
    const x = body.position.x
    const y = body.position.y
    const vx = body.velocity.x
    const vy = body.velocity.y

    const isBall = id === 'ball'
    const isGk = id.endsWith('_gk')
    const radius = radiusOf(id)

    // ── GK CONFINEMENT (always active — no physical walls for this) ──
    if (isGk) {
      const r = GK_RADIUS
      const team = id.startsWith('team1') ? 'team1' : 'team2'
      const homeDir = teamHomeDir(team, team1Side)
      const onLeft = homeDir === -1
      const xMin = onLeft ? (-halfW + r) : (halfW - PEN_AREA_W + r)
      const xMax = onLeft ? (-halfW + PEN_AREA_W - r) : (halfW - r)
      let yMin = -penHalfH + r
      let yMax = penHalfH - r
      if (diveStop?.id === id) { yMin = Math.max(yMin, -diveStop.maxAbsY); yMax = Math.min(yMax, diveStop.maxAbsY) }

      let cx = x, cy = y, nvx = vx, nvy = vy, fix = false
      if (x < xMin) { cx = xMin + 0.1; if (vx < 0) nvx = Math.abs(vx) * bounce; fix = true }
      if (x > xMax) { cx = xMax - 0.1; if (vx > 0) nvx = -Math.abs(vx) * bounce; fix = true }
      const dived = diveStop?.id === id
      if (y < yMin) { cy = yMin + (dived ? 0 : 0.1); nvy = dived ? 0 : (vy < 0 ? Math.abs(vy) * bounce : vy); fix = true }
      if (y > yMax) { cy = yMax - (dived ? 0 : 0.1); nvy = dived ? 0 : (vy > 0 ? -Math.abs(vy) * bounce : vy); fix = true }
      if (fix) {
        Body.setPosition(body, { x: cx, y: cy })
        Body.setVelocity(body, { x: nvx, y: nvy })
      }
      continue // GK done, skip normal clamp
    }

    // ── BALL & CAPS: rescue from tunneling ──
    const inGoalLane = isBall && Math.abs(y) < goalHalf + BALL_RADIUS

    let xLimit
    if (inGoalLane) {
      xLimit = backWallX - BALL_RADIUS
    } else {
      xLimit = halfW - radius
    }
    const yLimit = halfH - radius

    // If past the wall: nudge back inside
    // If WAY past (tunneled): also reflect velocity
    if (Math.abs(x) > xLimit) {
      const overshoot = Math.abs(x) - xLimit
      Body.setPosition(body, { x: Math.sign(x) * (xLimit - 0.1), y })
      if (overshoot > tunnelThreshold) {
        // Tunneled — reflect velocity
        Body.setVelocity(body, { x: -Math.sign(x) * Math.abs(vx) * bounce, y: vy })
      }
      // Small overshoot: just reposition, Matter.js wall will handle the bounce
    }

    if (Math.abs(y) > yLimit) {
      const overshoot = Math.abs(y) - yLimit
      Body.setPosition(body, { x: body.position.x, y: Math.sign(y) * (yLimit - 0.1) })
      if (overshoot > tunnelThreshold) {
        Body.setVelocity(body, { x: body.velocity.x, y: -Math.sign(y) * Math.abs(vy) * bounce })
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   5. BALL PLACEMENT HELPERS
   ═══════════════════════════════════════════════════════════ */

export function placeBallAt(x, y) {
  ballBanked = false
  const ball = bodies.ball
  if (ball) {
    Body.setPosition(ball, { x, y })
    Body.setVelocity(ball, { x: 0, y: 0 })
  }
}

/** Place a body at (x,y), clamped inside pitch */
function safePlace(id, x, y) {
  const b = bodies[id]
  if (!b) return
  const isGk = id.endsWith('_gk')
  const r = isGk ? GK_RADIUS : CAP_RADIUS
  const pos = clampInPitch(x, y, r)
  Body.setPosition(b, pos)
  Body.setVelocity(b, { x: 0, y: 0 })
}

/** Push apart any overlapping bodies after set piece placement (the ball stays put) */
export function deOverlapBodies() {
  const ids = Object.keys(bodies)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = bodies[ids[i]]
        const b = bodies[ids[j]]
        if (!a || !b) continue
        const rA = radiusOf(ids[i])
        const rB = radiusOf(ids[j])
        const minDist = rA + rB + 0.3
        const dx = b.position.x - a.position.x
        const dy = b.position.y - a.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) / 2 + 0.1
          const nx = dx / dist
          const ny = dy / dist
          // Don't move the ball during set piece setup
          // If one side is the ball, the cap takes the whole push
          const pa = ids[j] === 'ball' ? push * 2 : push
          const pb = ids[i] === 'ball' ? push * 2 : push
          if (ids[i] !== 'ball') Body.setPosition(a, clampInPitch(a.position.x - nx * pa, a.position.y - ny * pa, rA))
          if (ids[j] !== 'ball') Body.setPosition(b, clampInPitch(b.position.x + nx * pb, b.position.y + ny * pb, rB))
        }
      }
    }
  }
}

function clampInPitch(x, y, r = CAP_RADIUS) {
  const { halfW, halfH } = PITCH
  const m = r + 0.5
  return {
    x: Math.max(-halfW + m, Math.min(halfW - m, x)),
    y: Math.max(-halfH + m, Math.min(halfH - m, y)),
  }
}

/* ═══════════════════════════════════════════════════════════
   6. SET PIECE POSITIONING
   ═══════════════════════════════════════════════════════════ */

/**
 * SMART FREE KICK SETUP
 *
 * Rules:
 * - Kicker behind ball, facing opponent goal
 * - Wall: stands on the line from the ball to the goal it protects, square to
 *   that line, FREE_KICK_WALL_DISTANCE back from the ball (closer only when the
 *   goal itself is nearer than that, never under FREE_KICK_WALL_MIN)
 *   - Near the goal (within FREE_KICK_TWO_CAP_WALL_WITHIN of the line): 2 wall caps
 *   - Further out: 1 wall cap
 * - ALL other caps pushed to their own half, far from ball
 * - After placement: no cap but the kicker may stand closer to the ball than the wall
 */
// How far the defending wall stands back from a free kick (world units; the
// pitch is 30 long). Closer than this felt like the wall was on top of the ball.
export const FREE_KICK_WALL_DISTANCE = 6
// Never closer than this, even right by the goal
export const FREE_KICK_WALL_MIN = 3.6
// A free kick this close to the defending goal line gets a two-cap wall
export const FREE_KICK_TWO_CAP_WALL_WITHIN = 6.5
// Opponents stand this far off a corner kick / goal kick
const CORNER_CLEARANCE = 4.5
const GOAL_KICK_CLEARANCE = 6
// The kicker's own teammates just keep out of the kicker's way
const TEAMMATE_CLEARANCE = 4

const FREE_KICK_RUN_UP = 1.7
// Free-kick set-up: the wall stands this share of the way to goal and, like the
// keeper (shade < 0 = towards the near post), guards the near post — leaving the
// far corner for a well-struck kick (about a quarter of the goal from central spots)
export const FK_TUNE = { wallFrac: 0.45, gkShade: -0.6, twoWithin: FREE_KICK_TWO_CAP_WALL_WITHIN }

export function setupFreeKick(foulSpot, fouledTeam) {
  const { halfW, halfH } = PITCH
  const defTeam = fouledTeam === 'team1' ? 'team2' : 'team1'
  const atkHome = getTeamDir(fouledTeam)
  const defHome = getTeamDir(defTeam)

  stopAll()

  // Ball clamped inside safe area
  const bx = Math.max(-halfW + 3, Math.min(halfW - 3, foulSpot.x))
  const by = Math.max(-halfH + 3, Math.min(halfH - 3, foulSpot.y))
  placeBallAt(bx, by)

  // How much space is there between ball and the defending goal line?
  const spaceToGoal = Math.abs(defHome * halfW - bx)
  // Decide wall size: more space = more wall caps
  // Close to goal is when a wall matters: two caps there, one further out
  // (only four outfield caps a side, and the keeper never joins the wall)
  const wallCount = spaceToGoal < FK_TUNE.twoWithin ? 2 : 1

  // ── KICKER: on the line from ball to goal center, BEHIND the ball ──
  // Calculate angle from ball to the center of the goal being attacked
  const goalCenterX = defHome * halfW  // goal line x
  const goalCenterY = 0                // center of goal mouth
  const dxToGoal = goalCenterX - bx
  const dyToGoal = goalCenterY - by
  const distToGoal = Math.sqrt(dxToGoal * dxToGoal + dyToGoal * dyToGoal)
  // Normalized direction FROM ball TO goal
  const nxToGoal = distToGoal > 0.1 ? dxToGoal / distToGoal : Math.sign(dxToGoal)
  const nyToGoal = distToGoal > 0.1 ? dyToGoal / distToGoal : 0
  // Kicker placed BEHIND ball, a short run-up back on the angle line (close
  // enough that the aim is controllable, like lining up a real set piece)
  safePlace(`${fouledTeam}_atk1`, bx - nxToGoal * FREE_KICK_RUN_UP, by - nyToGoal * FREE_KICK_RUN_UP)

  // ── ALL other attacking caps: FAR on own half ──
  safePlace(`${fouledTeam}_atk2`, atkHome * halfW * 0.5, by > 0 ? -halfH * 0.35 : halfH * 0.35)
  safePlace(`${fouledTeam}_def1`, atkHome * halfW * 0.6, -halfH * 0.4)
  safePlace(`${fouledTeam}_def2`, atkHome * halfW * 0.6, halfH * 0.4)
  safePlace(`${fouledTeam}_mid`, atkHome * halfW * 0.3, 0)
  safePlace(`${fouledTeam}_gk`, atkHome * (halfW - 1.2), 0)
  // A free kick right outside your own box: the taker can end up on top of
  // your keeper, and the pitch edge stops them being pushed apart along x.
  // Slide the keeper along its line instead.
  const taker = bodies[`${fouledTeam}_atk1`]?.position
  const ownGk = bodies[`${fouledTeam}_gk`]?.position
  if (taker && ownGk && Math.hypot(taker.x - ownGk.x, taker.y - ownGk.y) < GK_RADIUS + CAP_RADIUS + 0.4) {
    const side = taker.y >= 0 ? -1 : 1
    safePlace(`${fouledTeam}_gk`, ownGk.x, taker.y + side * (GK_RADIUS + CAP_RADIUS + 0.6))
  }

  // ── WALL: on the ball→goal line, a proper distance back from the ball ──
  // Stand off the full distance when there's room; close to the goal, stop a
  // little in front of the keeper instead of on top of the goal line
  // Like a real wall it guards the NEAR post (the keeper leans that way too),
  // so a well-placed shot round the wall or into the far corner can go in
  const nearSide = Math.abs(by) > 1 ? Math.sign(by) : 1
  const postY = nearSide * PITCH.goalWidth * 0.3
  const wdx = goalCenterX - bx, wdy = postY - by
  const wlen = Math.hypot(wdx, wdy) || 1
  const wnx = wdx / wlen, wny = wdy / wlen
  // About halfway to goal, as a real wall stands: room to bend it over or round
  const wallDist = Math.max(FREE_KICK_WALL_MIN, Math.min(FREE_KICK_WALL_DISTANCE, distToGoal * FK_TUNE.wallFrac))
  const wallCx = bx + wnx * wallDist
  const wallCy = by + wny * wallDist
  // Wall caps line up square to the line of the kick, shoulder to shoulder
  const perpX = -wny
  const perpY = wnx


  const defFieldCaps = [`${defTeam}_def1`, `${defTeam}_def2`, `${defTeam}_mid`, `${defTeam}_atk1`, `${defTeam}_atk2`]
  const wallSpacing = 2.2

  // Place wall caps
  for (let i = 0; i < wallCount && i < defFieldCaps.length; i++) {
    const off = (i - (wallCount - 1) / 2) * wallSpacing
    safePlace(defFieldCaps[i], wallCx + perpX * off, wallCy + perpY * off)
  }

  // Remaining defending field caps: back behind the ball (towards halfway),
  // spread across the pitch — out of the shooting lane but ready for a rebound
  const backX = Math.max(-halfW + 2, Math.min(halfW - 2, bx - defHome * 5))
  for (let i = wallCount; i < defFieldCaps.length; i++) {
    const k = i - wallCount
    const spreadY = (k % 2 === 0 ? -1 : 1) * halfH * (0.3 + Math.floor(k / 2) * 0.35)
    safePlace(defFieldCaps[i], backX - defHome * Math.floor(k / 2) * 1.5, spreadY)
  }

  // Defending GK on goal line — slid along it if the ball sits right in front of him
  const gkX = defHome * (halfW - 1.2)
  const gkGap = GK_RADIUS + BALL_RADIUS + 0.3
  const gkDx = Math.abs(gkX - bx)
  const gkY = gkDx >= gkGap ? 0 : by + (by >= 0 ? -1 : 1) * Math.sqrt(gkGap * gkGap - gkDx * gkDx)
  safePlace(`${defTeam}_gk`, gkX, Math.abs(gkY) < 0.01 ? 0 : gkY)
  // Right back on his line when there's room (safePlace keeps him off the
  // wall), leaning to the near post: standing out would cover far too much
  const fkGk = bodies[`${defTeam}_gk`]
  if (fkGk && Math.abs(gkY) < 0.01) {
    // (a two-cap wall right by goal covers the near post, so he takes the far side)
    Body.setPosition(fkGk, { x: defHome * (halfW - GK_RADIUS - 0.05), y: wallCount === 2 ? -nearSide * 1.5 : -nearSide * FK_TUNE.gkShade })
    Body.setVelocity(fkGk, { x: 0, y: 0 })
  }

  // ── CLEAR ZONE: no opponent stands nearer the ball than the wall does ──
  // (a wall cap squeezed in by the touchline gets moved back out too). The
  // kicker's teammates only have to give the kicker some room, and keepers
  // stay on their goal line, as in real football.
  const kickerId = `${fouledTeam}_atk1`
  for (const [id, body] of Object.entries(bodies)) {
    if (id === 'ball' || id === kickerId || id.endsWith('_gk')) continue
    const radius = id.startsWith(defTeam) ? Math.max(wallDist - 0.5, FREE_KICK_WALL_MIN) : TEAMMATE_CLEARANCE
    const dx = body.position.x - bx
    const dy = body.position.y - by
    const dist = Math.hypot(dx, dy)
    if (dist >= radius) continue
    // Straight away from the ball first; if the edge of the pitch stops that,
    // try sideways and then back toward the cap's own goal
    const away = dist > 0.1 ? { x: dx / dist, y: dy / dist } : { x: getTeamDir(id.startsWith('team1') ? 'team1' : 'team2'), y: 0 }
    const home = { x: getTeamDir(id.startsWith('team1') ? 'team1' : 'team2'), y: 0 }
    const tries = [away, { x: -away.y, y: away.x }, { x: away.y, y: -away.x }, home, { x: -home.x, y: 0 }]
    const step = radius + 1
    let spot = null
    // …and never on top of a cap that's already been moved there
    const free = (p) => Object.entries(bodies).every(([other, ob]) => other === id || other === 'ball' ||
      Math.hypot(ob.position.x - p.x, ob.position.y - p.y) >= radiusOf(other) + CAP_RADIUS + 0.05)
    for (const extra of [0, 1.6, -1.6, 3.2, -3.2]) {
      for (const dir of tries) {
        const p = clampInPitch(bx + dir.x * step - dir.y * extra, by + dir.y * step + dir.x * extra, CAP_RADIUS)
        if (Math.hypot(p.x - bx, p.y - by) >= radius && free(p)) { spot = p; break }
      }
      if (spot) break
    }
    if (spot) safePlace(id, spot.x, spot.y)
  }

  deOverlapBodies()

  useMatchStore.setState({ freeKickCapId: kickerId })
}

/** Push every cap in `ids` at least `radius` away from (bx, by), sliding along the walls if needed. */
function clearAround(bx, by, ids, radius) {
  for (const id of ids) {
    const body = bodies[id]
    if (!body) continue
    const dx = body.position.x - bx
    const dy = body.position.y - by
    const dist = Math.hypot(dx, dy)
    if (dist >= radius) continue
    const away = dist > 0.1 ? { x: dx / dist, y: dy / dist } : { x: -Math.sign(bx) || 1, y: 0 }
    const toCentre = { x: -Math.sign(bx) || 1, y: -Math.sign(by) || 1 }
    const len = Math.hypot(toCentre.x, toCentre.y)
    const tries = [away, { x: -away.y, y: away.x }, { x: away.y, y: -away.x }, { x: toCentre.x / len, y: toCentre.y / len }]
    for (const dir of tries) {
      const p = clampInPitch(bx + dir.x * (radius + 0.6), by + dir.y * (radius + 0.6), radiusOf(id))
      if (Math.hypot(p.x - bx, p.y - by) >= radius) { safePlace(id, p.x, p.y); break }
    }
  }
}

/**
 * CORNER KICK for `team`, from the corner at (ex, ey). The ball sits on the
 * end line a little up from the corner, the taker just behind it against the
 * side wall; opponents stand off, everyone else stays where they were.
 */
export function setupCorner(team, ex, ey) {
  const { halfW, halfH } = PITCH
  stopAll()
  const bx = ex * (halfW - 1.3)
  const by = ey * (halfH - 2.8)
  placeBallAt(bx, by)
  const taker = `${team}_atk1`
  safePlace(taker, bx, ey * (halfH - 1.25))
  const others = Object.keys(bodies).filter((id) => id !== 'ball' && id !== taker && !id.endsWith('_gk'))
  clearAround(bx, by, others.filter((id) => !id.startsWith(`${team}_`)), CORNER_CLEARANCE)
  clearAround(bx, by, others.filter((id) => id.startsWith(`${team}_`)), TEAMMATE_CLEARANCE - 1)
  deOverlapBodies()
  useMatchStore.setState({ freeKickCapId: taker })
}

/**
 * GOAL KICK for `team` (the defenders), after the ball got stuck in a corner
 * at their end. The keeper takes it from inside the six-yard area, on the
 * side the ball went out; attackers leave the penalty area.
 */
export function setupGoalKick(team, ex, ey) {
  const { halfW } = PITCH
  stopAll()
  const bx = ex * (halfW - 3.2)
  const by = ey * 2
  placeBallAt(bx, by)
  const taker = `${team}_gk`
  safePlace(taker, ex * (halfW - 1.5), by)
  const opponents = Object.keys(bodies).filter((id) => id.startsWith(otherTeam(team)) && !id.endsWith('_gk'))
  clearAround(bx, by, opponents, GOAL_KICK_CLEARANCE)
  const mates = Object.keys(bodies).filter((id) => id.startsWith(`${team}_`) && id !== taker)
  clearAround(bx, by, mates, TEAMMATE_CLEARANCE - 1)
  deOverlapBodies()
  useMatchStore.setState({ freeKickCapId: taker })
}

/** Team that touched the ball last (null after a kick-off until someone does). */
export function getLastBallTeam() {
  return lastBallTeam
}

const PENALTY_RUN_UP = 1.5

// How fast a keeper throws himself sideways on a penalty: about the width of
// half the goal before he stops
const KEEPER_DIVE_SPEED = 1.8

/** Throw a keeper across his line: dive -1 / 1 (pitch y), 0 stays put. */
// A diving keeper stops at the post, covering his corner, instead of sliding on past it
let diveStop = null // { id, maxAbsY } for the current penalty

/** The penalty's over: the keeper may use his whole box again. */
export function clearKeeperDive() { diveStop = null }

export function diveKeeper(keeperTeam, dive) {
  const gk = bodies[`${keeperTeam}_gk`]
  if (!gk || !dive) return
  diveStop = { id: `${keeperTeam}_gk`, maxAbsY: PITCH.goalWidth / 2 - 0.35 }
  Body.setVelocity(gk, { x: 0, y: dive * KEEPER_DIVE_SPEED })
}

export function setupPenalty(fouledTeam) {
  diveStop = null
  const { halfW } = PITCH
  const defTeam = otherTeam(fouledTeam)
  const atkGkDir = getTeamDir(fouledTeam)
  const defGkDir = getTeamDir(defTeam)

  stopAll()

  // Ball on the penalty spot, the keeper right back on his line and the
  // kicker a short run-up behind: enough room to pick a corner past the keeper
  const penX = defGkDir * (halfW - PITCH.penSpotDist)
  placeBallAt(penX, 0)

  // Kicker behind ball (toward center)
  safePlace(`${fouledTeam}_atk1`, penX + atkGkDir * PENALTY_RUN_UP, 0)

  // Both keepers on their own goal lines (they're confined to their boxes anyway)
  // The keeper stands in the middle of his line; he dives (or not) as the ball is struck
  // (right on the line: safePlace keeps a margin off the walls, which would push him out)
  const keeper = bodies[`${defTeam}_gk`]
  if (keeper) {
    Body.setPosition(keeper, { x: defGkDir * (halfW - GK_RADIUS - 0.02), y: 0 })
    Body.setVelocity(keeper, { x: 0, y: 0 })
  }
  safePlace(`${fouledTeam}_gk`, atkGkDir * (halfW - 1.2), 0)

  // The 7 remaining outfield caps: spread in a line along the halfway line
  const others = [
    `${fouledTeam}_atk2`, `${fouledTeam}_mid`, `${fouledTeam}_def1`, `${fouledTeam}_def2`,
    `${defTeam}_def1`, `${defTeam}_def2`, `${defTeam}_mid`, `${defTeam}_atk1`, `${defTeam}_atk2`,
  ]
  const spacing = 2.2
  const startY = -((others.length - 1) * spacing) / 2
  others.forEach((id, i) => {
    safePlace(id, 0, startY + i * spacing)
  })

  deOverlapBodies()

  // Only the kicker can take the penalty
  useMatchStore.setState({ freeKickCapId: `${fouledTeam}_atk1` })
}

/* ═══════════════════════════════════════════════════════════
   7. KICKOFF POSITIONING
   ═══════════════════════════════════════════════════════════ */

/**
 * Kick-off layout: every cap starts in its team's chosen formation, then the
 * laws are enforced — everyone in their own half, the defending team outside
 * the centre circle, and the kicker next to the ball.
 */
export function resetToKickoff(kickingTeam) {
  diveStop = null
  const { formations, team1Side } = useMatchStore.getState()
  stopAll()
  lastBallTeam = null
  ballBanked = false
  placeBallAt(0, 0)

  for (const team of ['team1', 'team2']) {
    const home = getTeamDir(team)
    const pos = getFormationPositions(team, formations?.[team] || 'default', team1Side || 'left')
    for (const role of Object.keys(pos)) {
      const id = `${team}_${role}`
      const r = radiusOf(id)
      let { x, y } = pos[role]
      // Own half only
      if (Math.sign(x) !== home || Math.abs(x) < r + 0.2) x = home * (r + 0.2)
      // Defending team stays out of the centre circle
      if (team !== kickingTeam) {
        const d = Math.hypot(x, y)
        const minD = PITCH.centerCircleR + r + 0.2
        if (d < minD) {
          const nx = d > 0.01 ? x / d : home
          const ny = d > 0.01 ? y / d : 0
          x = nx * minD
          y = ny * minD
          if (Math.sign(x) !== home) x = home * Math.abs(x)
        }
      }
      safePlace(id, x, y)
    }
  }

  // Kicker right next to the ball, slightly offset so it's visible
  const home = getTeamDir(kickingTeam)
  safePlace(`${kickingTeam}_atk1`, home * 0.9, -0.9)
  deOverlapBodies()
}

/* ═══════════════════════════════════════════════════════════
   8. PHYSICS STEP
   ═══════════════════════════════════════════════════════════ */

export function stepPhysics(delta) {
  if (!engine) return
  Engine.update(engine, delta)
}

/**
 * A private, headless copy of the pitch for look-ahead (the AI planner).
 * Same walls, radii, masses, restitution, per-step friction and clamping as
 * the match world, but no store, sound or foul side effects and nothing
 * shared with the live engine.
 *
 * @param snapshot  { id: {x, y, vx?, vy?} | [x, y] } — only these bodies exist
 * @param opts.team1Side  'left' | 'right' (decides the keepers' boxes)
 * @returns {{ engine, bodies, step(frameMs?: number): void, reset(snapshot): void }}
 *   step() advances one rendered frame exactly like PhysicsSync does;
 *   reset() puts every body back on a snapshot, at rest, to replay another flick.
 */
export function createSimulationWorld(snapshot, { team1Side = 'left' } = {}) {
  const simEngine = Engine.create({ positionIterations: 20, velocityIterations: 20 })
  simEngine.gravity.x = 0
  simEngine.gravity.y = 0
  World.add(simEngine.world, createWallBodies())

  const simBodies = {}
  for (const [id, s] of Object.entries(snapshot || {})) {
    const p = Array.isArray(s) ? { x: s[0], y: s[1] } : s
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const body = makeDynamicBody(id, p.x, p.y)
    if (p.vx || p.vy) Body.setVelocity(body, { x: p.vx || 0, y: p.vy || 0 })
    World.add(simEngine.world, body)
    simBodies[id] = body
  }
  Events.on(simEngine, 'beforeUpdate', () => applyStepFriction(simBodies))
  attachKeeperGrip(simEngine, () => simBodies)

  function step(frameMs = 16) {
    for (let i = 0; i < SUB_STEPS; i++) Engine.update(simEngine, frameMs / SUB_STEPS)
    clampBodyMap(simBodies, team1Side)
  }

  // Put every body back on a snapshot so one world can replay many flicks
  // (much less garbage than a fresh engine each time).
  function reset(snap) {
    for (const [id, body] of Object.entries(simBodies)) {
      const s = snap?.[id]
      const p = Array.isArray(s) ? { x: s[0], y: s[1] } : (s || {})
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) Body.setPosition(body, { x: p.x, y: p.y })
      Body.setVelocity(body, { x: p.vx || 0, y: p.vy || 0 })
    }
    Matter.Pairs.clear(simEngine.pairs) // forget contacts from the last run
  }
  return { engine: simEngine, bodies: simBodies, step, reset }
}

/* ═══════════════════════════════════════════════════════════
   9. ONLINE SNAPSHOTS (host → guest)
   ═══════════════════════════════════════════════════════════ */

const round3 = (n) => Math.round(n * 1000) / 1000

/** Compact positions of every dynamic body: { id: [x, y] } */
export function snapshotBodies() {
  const snap = {}
  for (const [id, b] of Object.entries(bodies)) snap[id] = [round3(b.position.x), round3(b.position.y)]
  return snap
}

/** Move bodies to host-authoritative positions. Unknown ids and bad numbers are ignored. */
export function applyBodySnapshot(snap) {
  if (!snap || typeof snap !== 'object') return
  for (const [id, b] of Object.entries(bodies)) {
    const p = snap[id]
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue
    // Velocity is only used for visuals on the guest (ball trail); the guest never steps physics.
    const vx = (p[0] - b.position.x) / 3
    const vy = (p[1] - b.position.y) / 3
    Body.setPosition(b, { x: p[0], y: p[1] })
    Body.setVelocity(b, { x: vx, y: vy })
  }
}
