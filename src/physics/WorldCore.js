import Matter from 'matter-js'
import { PITCH, CAP_RADIUS, GK_RADIUS, BALL_RADIUS, PHYSICS } from '../data/TeamData.js'
import { teamHomeDir } from '../game/rules.js'

const { Engine, World, Bodies, Body, Events } = Matter
const PEN_AREA_W = PITCH.penAreaW
const PEN_AREA_H = PITCH.penAreaH
const CAT_DEFAULT = 0x0001

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

export function radiusOf(id) {
  if (id === 'ball') return BALL_RADIUS
  return id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS
}

/** Static pitch boundary and goal nets (shared by every world). */
export function createWallBodies() {
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

  // Goal frame/net contacts are not pitch-cushion bank shots.
  for (const wall of [topWall, bottomWall, leftTop, leftBottom, rightTop, rightBottom]) {
    wall.label = 'pitch_cushion'
  }

  return [
    topWall, bottomWall,
    leftTop, leftBottom, rightTop, rightBottom,
    leftGoalBack, leftGoalTop, leftGoalBottom,
    rightGoalBack, rightGoalTop, rightGoalBottom,
  ]
}

// ── Per-step friction & velocity cap ──
const SUB_STEPS = PHYSICS.subSteps || 8
const CAP_FRICTION_PER_STEP = PHYSICS.linearFriction / SUB_STEPS
const BALL_FRICTION_PER_STEP = (PHYSICS.linearFriction * PHYSICS.ballFrictionRatio) / SUB_STEPS
const MAX_SPEED = PHYSICS.maxFlickVelocity * 1.5

/** Linear friction + hard speed cap for one sub-step, applied to a map of dynamic bodies. */
export function applyStepFriction(bodies) {
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
export function attachKeeperGrip(eng, bodyMap) {
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

/** A cap or the ball, not yet added to any world. Radius and mass follow from the id. */
export function makeDynamicBody(id, x, y) {
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
    collisionFilter: { category: CAT_DEFAULT, mask: CAT_DEFAULT },
  })
  Body.setMass(body, mass)
  Body.setInertia(body, Infinity) // no rotation — pure translation
  return body
}

/** GK confinement + tunnelling rescue for any map of dynamic bodies. */
export function clampBodyMap(bodies, team1Side, diveStop = null) {
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
    const inGoalLane = Math.abs(y) < (isBall ? goalHalf + BALL_RADIUS : goalHalf - radius)

    let xLimit
    if (inGoalLane) {
      xLimit = backWallX - radius
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

  function step(frameMs = 16, shouldStop = null) {
    for (let i = 0; i < SUB_STEPS; i++) {
      Engine.update(simEngine, frameMs / SUB_STEPS)
      if (shouldStop?.()) break
    }
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

