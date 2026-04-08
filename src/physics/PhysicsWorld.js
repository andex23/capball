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
 * - 10 caps (5 per team: gk, def1, def2, atk1, atk2)
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
import { playFoulWhistle, playBallHit, playWallHit } from '../audio/SoundManager'
import { useMatchStore } from '../state/MatchStore'

const { Engine, World, Bodies, Body, Events } = Matter

const PEN_AREA_W = PITCH.penAreaW
const PEN_AREA_H = PITCH.penAreaH

// Collision categories
const CAT_DEFAULT = 0x0001
const CAT_GOAL_BLOCKER = 0x0002

let engine = null
let bodies = {}

/** Get direction for a team based on side selection. -1 = left, +1 = right */
function getTeamDir(team) {
  const side = useMatchStore.getState().team1Side || 'left'
  if (side === 'left') return team === 'team1' ? -1 : 1
  return team === 'team1' ? 1 : -1
}

function getTeam1Side() {
  return useMatchStore.getState().team1Side || 'left'
}

/* ═══════════════════════════════════════════════════════════
   1. WORLD CREATION
   ═══════════════════════════════════════════════════════════ */

export function createPhysicsWorld() {
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

  const { halfW, halfH, goalWidth, wallThickness: wt } = PITCH
  const goalHalf = goalWidth / 2
  const goalDepth = 1.8

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
  const leftGoalTop = Bodies.rectangle(-halfW - goalDepth / 2, -goalHalf - wallThick / 2, goalDepth + wallThick, wallThick, wallOpts)
  const leftGoalBottom = Bodies.rectangle(-halfW - goalDepth / 2, goalHalf + wallThick / 2, goalDepth + wallThick, wallThick, wallOpts)
  const rightGoalBack = Bodies.rectangle(halfW + goalDepth + backThick / 2, 0, backThick, goalWidth + 2, wallOpts)
  const rightGoalTop = Bodies.rectangle(halfW + goalDepth / 2, -goalHalf - wallThick / 2, goalDepth + wallThick, wallThick, wallOpts)
  const rightGoalBottom = Bodies.rectangle(halfW + goalDepth / 2, goalHalf + wallThick / 2, goalDepth + wallThick, wallThick, wallOpts)

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

  World.add(engine.world, [
    topWall, bottomWall,
    leftTop, leftBottom, rightTop, rightBottom,
    leftGoalBack, leftGoalTop, leftGoalBottom,
    rightGoalBack, rightGoalTop, rightGoalBottom,
    leftGoalBlocker, rightGoalBlocker,
  ])

  // ── Create dynamic bodies ──
  bodies = {}
  createTeamBodies('team1')
  createTeamBodies('team2')
  createBallBody()

  // ── Per-step friction & velocity cap ──
  const subSteps = PHYSICS.subSteps || 8
  const capFrictionPerStep = PHYSICS.linearFriction / subSteps
  const ballFrictionPerStep = (PHYSICS.linearFriction * 0.5) / subSteps // ball has half the friction of caps
  const maxSpeed = PHYSICS.maxFlickVelocity * 1.5

  // ── EVENT: First-contact tracking for foul detection ──
  Events.on(engine, 'collisionStart', (event) => {
    const store = useMatchStore.getState()
    const { phase, lastFlickedCapId, firstCollisionTracked, activeTeam } = store
    if (phase !== 'RESOLVE' || !lastFlickedCapId || firstCollisionTracked) return

    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label]
      if (!labels.includes(lastFlickedCapId)) continue

      const other = labels[0] === lastFlickedCapId ? labels[1] : labels[0]
      useMatchStore.setState({ firstCollisionTracked: true })

      // Ball first = legal play
      if (other === 'ball') return

      // Teammate first = miskick (wasted turn, no foul)
      const flickedTeam = lastFlickedCapId.split('_')[0]
      const otherTeam = other.split('_')[0]
      if (otherTeam === flickedTeam) return

      // Opponent cap first = FOUL
      if (other.startsWith('team1_') || other.startsWith('team2_')) {
        const foulBody = pair.bodyA.label === other ? pair.bodyA : pair.bodyB
        const foulSpot = { x: foulBody.position.x, y: foulBody.position.y }
        const fouledTeam = otherTeam

        // Is foul inside the fouling team's own penalty box? (activeTeam committed the foul)
        const foulTeamDir = getTeamDir(activeTeam)
        const inPenaltyBox = foulTeamDir === -1
          ? (foulSpot.x < -PITCH.halfW + PEN_AREA_W && Math.abs(foulSpot.y) < PEN_AREA_H / 2)
          : (foulSpot.x > PITCH.halfW - PEN_AREA_W && Math.abs(foulSpot.y) < PEN_AREA_H / 2)

        playFoulWhistle()
        setTimeout(() => {
          stopAll()
          store.callFoul(foulSpot, fouledTeam, inPenaltyBox)
        }, 300)
      }
      return
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
      const hasCap = a.startsWith('team') || b.startsWith('team')
      if (hasBall && hasCap) { playBallHit(); lastSoundTime = now; return }
      if (hasBall || hasCap) { playWallHit(); lastSoundTime = now; return }
    }
  })

  // ── EVENT: Per-step friction + velocity cap ──
  Events.on(engine, 'beforeUpdate', () => {
    for (const key in bodies) {
      const body = bodies[key]
      let vx = body.velocity.x
      let vy = body.velocity.y
      let speed = Math.sqrt(vx * vx + vy * vy)

      // Hard velocity cap — prevents tunneling through walls
      if (speed > maxSpeed) {
        const s = maxSpeed / speed
        vx *= s
        vy *= s
        speed = maxSpeed
      }

      // Linear friction — constant deceleration per step
      const friction = key === 'ball' ? ballFrictionPerStep : capFrictionPerStep

      if (speed <= friction) {
        // Below threshold — stop completely
        Body.setVelocity(body, { x: 0, y: 0 })
      } else {
        // Scale down velocity
        const scale = (speed - friction) / speed
        Body.setVelocity(body, { x: vx * scale, y: vy * scale })
      }
    }
  })

  return engine
}

/* ═══════════════════════════════════════════════════════════
   2. BODY CREATION
   ═══════════════════════════════════════════════════════════ */

function createCapBody(id, x, y, radius, mass, isBall) {
  const body = Bodies.circle(x, y, radius, {
    friction: 0,
    frictionStatic: 0,
    frictionAir: isBall ? 0 : 0.001, // ball has zero air drag, caps have minimal
    restitution: isBall ? 0.95 : PHYSICS.restitution, // ball very bouncy off walls
    label: id,
    slop: 0.001,  // very tight — prevents sinking into walls
    collisionFilter: isBall
      ? { category: CAT_DEFAULT, mask: CAT_DEFAULT }
      : { category: CAT_DEFAULT, mask: CAT_DEFAULT | CAT_GOAL_BLOCKER },
  })
  Body.setMass(body, mass)
  Body.setInertia(body, Infinity) // no rotation — pure translation
  World.add(engine.world, body)
  bodies[id] = body
  return body
}

function createTeamBodies(team) {
  const formations = useMatchStore.getState().formations
  const formationKey = formations?.[team] || 'default'
  const pos = getFormationPositions(team, formationKey, getTeam1Side())
  createCapBody(`${team}_gk`, pos.gk.x, pos.gk.y, GK_RADIUS, PHYSICS.gkMass, false)
  createCapBody(`${team}_def1`, pos.def1.x, pos.def1.y, CAP_RADIUS, PHYSICS.playerMass, false)
  createCapBody(`${team}_def2`, pos.def2.x, pos.def2.y, CAP_RADIUS, PHYSICS.playerMass, false)
  createCapBody(`${team}_atk1`, pos.atk1.x, pos.atk1.y, CAP_RADIUS, PHYSICS.playerMass, false)
  createCapBody(`${team}_atk2`, pos.atk2.x, pos.atk2.y, CAP_RADIUS, PHYSICS.playerMass, false)
}

function createBallBody() {
  createCapBody('ball', 0, 0, BALL_RADIUS, PHYSICS.ballMass, true)
}

/* ═══════════════════════════════════════════════════════════
   3. GETTERS & ACTIONS
   ═══════════════════════════════════════════════════════════ */

export function getEngine() { return engine }
export function getBodies() { return bodies }
export function getBody(id) { return bodies[id] }

/** Apply shot impulse to a cap */
export function applyFlick(capId, velocity) {
  const body = bodies[capId]
  if (!body) return
  // Clamp to max flick velocity
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)
  if (speed > PHYSICS.maxFlickVelocity) {
    const s = PHYSICS.maxFlickVelocity / speed
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
  const { halfW, halfH, goalWidth } = PITCH
  const goalHalf = goalWidth / 2
  const goalDepth = 1.8
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
    const radius = isBall ? BALL_RADIUS : (isGk ? GK_RADIUS : CAP_RADIUS)

    // ── GK CONFINEMENT (always active — no physical walls for this) ──
    if (isGk) {
      const r = GK_RADIUS
      const team = id.startsWith('team1') ? 'team1' : 'team2'
      const homeDir = getTeamDir(team)
      const onLeft = homeDir === -1
      const xMin = onLeft ? (-halfW + r) : (halfW - PEN_AREA_W + r)
      const xMax = onLeft ? (-halfW + PEN_AREA_W - r) : (halfW - r)
      const yMin = -penHalfH + r
      const yMax = penHalfH - r

      let cx = x, cy = y, nvx = vx, nvy = vy, fix = false
      if (x < xMin) { cx = xMin + 0.1; if (vx < 0) nvx = Math.abs(vx) * bounce; fix = true }
      if (x > xMax) { cx = xMax - 0.1; if (vx > 0) nvx = -Math.abs(vx) * bounce; fix = true }
      if (y < yMin) { cy = yMin + 0.1; if (vy < 0) nvy = Math.abs(vy) * bounce; fix = true }
      if (y > yMax) { cy = yMax - 0.1; if (vy > 0) nvy = -Math.abs(vy) * bounce; fix = true }
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

/** Push apart any overlapping bodies after set piece placement */
function deOverlapBodies() {
  const ids = Object.keys(bodies)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = bodies[ids[i]]
        const b = bodies[ids[j]]
        if (!a || !b) continue
        const rA = ids[i] === 'ball' ? BALL_RADIUS : (ids[i].endsWith('_gk') ? GK_RADIUS : CAP_RADIUS)
        const rB = ids[j] === 'ball' ? BALL_RADIUS : (ids[j].endsWith('_gk') ? GK_RADIUS : CAP_RADIUS)
        const minDist = rA + rB + 0.3
        const dx = b.position.x - a.position.x
        const dy = b.position.y - a.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) / 2 + 0.1
          const nx = dx / dist
          const ny = dy / dist
          // Don't move the ball during set piece setup
          if (ids[i] !== 'ball') Body.setPosition(a, { x: a.position.x - nx * push, y: a.position.y - ny * push })
          if (ids[j] !== 'ball') Body.setPosition(b, { x: b.position.x + nx * push, y: b.position.y + ny * push })
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
 * - CLEAR ZONE around the ball (6 unit radius) — only the kicker allowed inside
 * - Kicker behind ball, facing opponent goal
 * - Wall: between ball and goal, minimum 5 units from ball
 *   - Far from box: 3 wall caps
 *   - Near box: 2 wall caps
 *   - Very near box (edge): 1 wall cap
 * - ALL other caps pushed to their own half, far from ball
 * - After placement: force-clear any cap that's too close to the ball
 */
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
  let wallCount = 3
  if (spaceToGoal < 12) wallCount = 2
  if (spaceToGoal < 8) wallCount = 1

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
  // Kicker placed BEHIND ball (opposite direction), 2.5 units back on the angle line
  safePlace(`${fouledTeam}_atk1`, bx - nxToGoal * 2.5, by - nyToGoal * 2.5)
  // Wall direction uses the same angle
  const dirBallToGoal = Math.sign(dxToGoal)

  // ── ALL other attacking caps: FAR on own half ──
  safePlace(`${fouledTeam}_atk2`, atkHome * halfW * 0.5, by > 0 ? -halfH * 0.35 : halfH * 0.35)
  safePlace(`${fouledTeam}_def1`, atkHome * halfW * 0.6, -halfH * 0.4)
  safePlace(`${fouledTeam}_def2`, atkHome * halfW * 0.6, halfH * 0.4)
  safePlace(`${fouledTeam}_gk`, atkHome * (halfW - 1.2), 0)

  // ── WALL: between ball and the goal being attacked, minimum 5 units from ball ──
  let wallX = bx + dirBallToGoal * 5.5
  wallX = Math.max(-halfW + 2.5, Math.min(halfW - 2.5, wallX))

  const defFieldCaps = [`${defTeam}_def1`, `${defTeam}_def2`, `${defTeam}_atk1`, `${defTeam}_atk2`]
  const wallSpacing = 2.5

  // Place wall caps
  for (let i = 0; i < wallCount && i < defFieldCaps.length; i++) {
    const wy = by + (i - (wallCount - 1) / 2) * wallSpacing
    safePlace(defFieldCaps[i], wallX, wy)
  }

  // Remaining defending field caps: far on their own half, spread out
  for (let i = wallCount; i < defFieldCaps.length; i++) {
    const spreadY = (i % 2 === 0 ? -1 : 1) * halfH * (0.25 + (i - wallCount) * 0.15)
    safePlace(defFieldCaps[i], defHome * halfW * 0.5, spreadY)
  }

  // Defending GK on goal line
  safePlace(`${defTeam}_gk`, defHome * (halfW - 1.2), 0)

  // ── CLEAR ZONE: force any cap within 4 units of ball (except kicker) away ──
  const clearRadius = 4
  const kickerId = `${fouledTeam}_atk1`
  for (const [id, body] of Object.entries(bodies)) {
    if (id === 'ball' || id === kickerId) continue
    const dx = body.position.x - bx
    const dy = body.position.y - by
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < clearRadius) {
      // Push this cap away from the ball along the vector from ball to cap
      const pushDist = clearRadius + 1
      if (dist > 0.1) {
        safePlace(id, bx + (dx / dist) * pushDist, by + (dy / dist) * pushDist)
      } else {
        // Overlapping ball — push toward own half
        const team = id.startsWith('team1') ? 'team1' : 'team2'
        safePlace(id, bx + getTeamDir(team) * pushDist, by)
      }
    }
  }

  deOverlapBodies()

  useMatchStore.setState({ freeKickCapId: kickerId })
}

export function setupPenalty(fouledTeam) {
  const { halfW, halfH } = PITCH
  const defTeam = fouledTeam === 'team1' ? 'team2' : 'team1'
  const atkGkDir = getTeamDir(fouledTeam)
  const defGkDir = getTeamDir(defTeam)

  stopAll()

  // Ball at penalty spot (4.5 units from the DEFENDING goal line)
  const penX = defGkDir * (halfW - 4.5)
  placeBallAt(penX, 0)

  // Kicker behind ball (toward center)
  safePlace(`${fouledTeam}_atk1`, penX + atkGkDir * 3, 0)

  // Defending GK on goal line
  safePlace(`${defTeam}_gk`, defGkDir * (halfW - 1.2), 0)

  // All 8 remaining caps: spread in a line along the halfway line
  const others = [
    `${fouledTeam}_atk2`, `${fouledTeam}_def1`, `${fouledTeam}_def2`, `${fouledTeam}_gk`,
    `${defTeam}_def1`, `${defTeam}_def2`, `${defTeam}_atk1`, `${defTeam}_atk2`,
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

export function placePenalty(fouledTeam) { setupPenalty(fouledTeam) }

/* ═══════════════════════════════════════════════════════════
   7. KICKOFF POSITIONING
   ═══════════════════════════════════════════════════════════ */

export function resetToKickoff(kickingTeam) {
  const { halfW, halfH } = PITCH
  const nonKickingTeam = kickingTeam === 'team1' ? 'team2' : 'team1'

  // kHome = direction toward kicking team's OWN goal (where their GK is)
  // kAttack = direction toward opponent's goal (where kicker wants to shoot)
  const kHome = getTeamDir(kickingTeam)
  const kAttack = -kHome
  const nHome = getTeamDir(nonKickingTeam)

  stopAll()
  placeBallAt(0, 0)

  // === KICKING TEAM ===
  // Kicker: RIGHT NEXT TO the ball, touching it, slightly offset so visible
  const ka1 = bodies[`${kickingTeam}_atk1`]
  if (ka1) Body.setPosition(ka1, { x: kHome * 0.9, y: -0.9 })

  // Second attacker: on kicking team's own half, outside center circle
  const ka2 = bodies[`${kickingTeam}_atk2`]
  if (ka2) Body.setPosition(ka2, { x: kHome * 5, y: -halfH * 0.3 })

  // Defenders: on own half
  const kd1 = bodies[`${kickingTeam}_def1`]
  if (kd1) Body.setPosition(kd1, { x: kHome * halfW * 0.42, y: -halfH * 0.45 })
  const kd2 = bodies[`${kickingTeam}_def2`]
  if (kd2) Body.setPosition(kd2, { x: kHome * halfW * 0.42, y: halfH * 0.45 })

  // GK: on own goal line
  const kg = bodies[`${kickingTeam}_gk`]
  if (kg) Body.setPosition(kg, { x: kHome * (halfW - 1.2), y: 0 })

  // === NON-KICKING TEAM ===
  // ALL on their own half, OUTSIDE center circle
  const na1 = bodies[`${nonKickingTeam}_atk1`]
  if (na1) Body.setPosition(na1, { x: nHome * 5, y: -halfH * 0.3 })
  const na2 = bodies[`${nonKickingTeam}_atk2`]
  if (na2) Body.setPosition(na2, { x: nHome * 5, y: halfH * 0.3 })

  const nd1 = bodies[`${nonKickingTeam}_def1`]
  if (nd1) Body.setPosition(nd1, { x: nHome * halfW * 0.45, y: -halfH * 0.45 })
  const nd2 = bodies[`${nonKickingTeam}_def2`]
  if (nd2) Body.setPosition(nd2, { x: nHome * halfW * 0.45, y: halfH * 0.45 })

  // GK: on own goal line
  const ng = bodies[`${nonKickingTeam}_gk`]
  if (ng) Body.setPosition(ng, { x: nHome * (halfW - 1.2), y: 0 })
}

export function resetToFormation() {
  const activeTeam = useMatchStore.getState().activeTeam || 'team1'
  resetToKickoff(activeTeam)
}

/* ═══════════════════════════════════════════════════════════
   8. PHYSICS STEP
   ═══════════════════════════════════════════════════════════ */

export function stepPhysics(delta) {
  if (!engine) return
  Engine.update(engine, delta)
}
