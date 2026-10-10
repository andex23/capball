/**
 * COUNTER BALL Physics System
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
import { createLayouts } from './Layouts'
export { FREE_KICK_WALL_DISTANCE, FREE_KICK_WALL_MIN, FREE_KICK_TWO_CAP_WALL_WITHIN, FK_TUNE } from './Layouts'
import { createWallBodies, makeDynamicBody, applyStepFriction, attachKeeperGrip, clampBodyMap } from './WorldCore'
export { CIRCLE_SIDES, KEEPER_GRIP, radiusOf, createSimulationWorld } from './WorldCore'
import { PITCH, CAP_RADIUS, GK_RADIUS, BALL_RADIUS, PHYSICS, getFormationPositions } from '../data/TeamData'
import { playFoulWhistle, playBallHit, playCapHit, playWallHit } from '../audio/SoundManager'
import { shotCall } from '../game/shots'
import { useMatchStore, PHASE, later } from '../state/MatchStore'
import { teamHomeDir, teamOf, classifyContact, isInPenaltyArea } from '../game/rules'

const { Engine, World, Body, Events } = Matter

let layouts = null
let engine = null
let bodies = {}
let lastBallTeam = null // 'team1' | 'team2' | null — last side to touch the ball
// Has the ball come off a cushion since a cap last touched it? A goal that
// goes in off the wall doesn't count (rules.judgeGoal → 'bank_shot').
let ballBanked = false
export const getBallBanked = () => ballBanked
let goalEvidence = {}
export const getGoalEvidence = () => ({ ...goalEvidence })


function getTeamDir(team) { return teamHomeDir(team, getTeam1Side()) }

function getTeam1Side() {
  return useMatchStore.getState().team1Side || 'left'
}

/* ═══════════════════════════════════════════════════════════
   1. WORLD CREATION
   ═══════════════════════════════════════════════════════════ */

export function createPhysicsWorld() {
  layouts?.clearKeeperDive()
  goalEvidence = {}
  lastBallTeam = null
  ballBanked = false
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
  layouts = createLayouts(bodies, useMatchStore.getState, useMatchStore.setState, {
    onBallPlaced: () => { ballBanked = false; goalEvidence = {} },
    onKickoff: () => { lastBallTeam = null; ballBanked = false },
  })

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
        stopAllBodies()
        s.callFoul(foulSpot, teamOf(other), inPenaltyBox)
      }, 300)
      return
    }
  })

  // ── EVENT: Near misses — off the post, just wide, saved, blocked ──
  Events.on(engine, 'collisionStart', (event) => {
    const s = useMatchStore.getState()
    if (s.phase !== PHASE.RESOLVE || s.shotCalled || !s.lastFlickedCapId || s.challenge || s.penaltyShootout) return
    const shooterTeam = teamOf(s.lastFlickedCapId)
    if (!shooterTeam) return
    for (const pair of event.pairs) {
      const a = pair.bodyA, b = pair.bodyB
      const ballBody = a.label === 'ball' ? a : b.label === 'ball' ? b : null
      if (!ballBody) continue
      const other = ballBody === a ? b : a
      const team = teamOf(other.label)
      const kind = other.isStatic ? 'wall' : !team ? null : other.label.endsWith('_gk') ? 'keeper' : 'cap'
      if (!kind) continue
      const call = shotCall({
        ball: { x: ballBody.position.x, y: ballBody.position.y, vx: ballBody.velocity.x, vy: ballBody.velocity.y },
        other: { kind, team },
        attackDir: -getTeamDir(shooterTeam),
        shooterTeam,
      })
      if (!call) continue
      // Only once the shooter has actually struck the ball (not a cap nudging a still ball)
      if (lastBallTeam !== shooterTeam && call !== 'post' && call !== 'wide') continue
      s.callShot(call, s.lastFlickedCapId, kind === 'wall' ? null : other.label)
      return
    }
  })

  // ── EVENT: Who touched the ball last (decides corner kick vs goal kick) ──
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.label
      const b = pair.bodyB.label
      const flicked = useMatchStore.getState().lastFlickedCapId
      if ((a === flicked && b === 'pitch_cushion') || (b === flicked && a === 'pitch_cushion')) {
        goalEvidence.capHitEdge = true
      }
      if (a !== 'ball' && b !== 'ball') continue
      const other = a === 'ball' ? pair.bodyB : pair.bodyA
      const team = teamOf(other.label)
      if (team) {
        if (other.label !== flicked && useMatchStore.getState().goalKickGuard) useMatchStore.setState({ goalKickGuard: false })
        if (ballBanked) goalEvidence.capAfterBank = true
        lastBallTeam = team
        ballBanked = false
      }
      else if (other.label === 'pitch_cushion') {
        const { x, y } = bodies.ball.position
        // The inside tip of an end cushion is the goalpost, not a bank off
        // the pitch edge. Contacts beyond the goal line cannot undo entry.
        const atPost = Math.abs(x) >= PITCH.halfW - BALL_RADIUS
          && Math.abs(y) <= PITCH.goalWidth / 2 + BALL_RADIUS
        if (atPost) goalEvidence.postContact = true
        if (Math.abs(x) <= PITCH.halfW && !atPost) {
          ballBanked = true
          goalEvidence.capAfterBank = false
          goalEvidence.edgeContact = { x, y }
        }
      }
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
  goalEvidence = {}
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
  clampBodyMap(bodies, getTeam1Side(), layouts?.getDiveStop())
}

/* ═══════════════════════════════════════════════════════════
   5. BALL PLACEMENT HELPERS
   ═══════════════════════════════════════════════════════════ */

export const placeBallAt = (...args) => layouts?.placeBallAt(...args)
export const deOverlapBodies = (...args) => layouts?.deOverlapBodies(...args)
export const setupFreeKick = (...args) => layouts?.setupFreeKick(...args)
export const setupCorner = (...args) => layouts?.setupCorner(...args)
export const setupGoalKick = (...args) => layouts?.setupGoalKick(...args)
export const clearKeeperDive = (...args) => layouts?.clearKeeperDive(...args)
export const diveKeeper = (...args) => layouts?.diveKeeper(...args)
export const setupPenalty = (...args) => layouts?.setupPenalty(...args)
export const resetToKickoff = (...args) => layouts?.resetToKickoff(...args)
export const getLastBallTeam = () => lastBallTeam

/* ═══════════════════════════════════════════════════════════
   8. PHYSICS STEP
   ═══════════════════════════════════════════════════════════ */

export function stepPhysics(delta) {
  if (!engine) return
  Engine.update(engine, delta)
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
