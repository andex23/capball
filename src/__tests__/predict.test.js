import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Matter from 'matter-js'
import { createPhysicsWorld, getBodies, clampAllBodies, stepPhysics, radiusOf, createSimulationWorld } from '../physics/PhysicsWorld'
import { useMatchStore, PHASE, clearMatchTimers } from '../state/MatchStore'
import { performFlick } from '../game/flick'
import { predictShot, createShot, createPrediction, capBounds, goalFor } from '../game/predict'
import { classifyContact } from '../game/rules'
import { PITCH, PHYSICS, CAP_RADIUS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'

const deg = (x, y) => (Math.atan2(y, x) * 180) / Math.PI
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
/** Direction (degrees) of path segment i of a flat [x0, y0, x1, y1, ...] polyline */
const segAngle = (path, i) => deg(path[i * 2 + 2] - path[i * 2], path[i * 2 + 3] - path[i * 2 + 1])

/** A shot on an otherwise empty pitch; `others` = [{ x, y, contact, r? }] */
function shot({ capId = 'team1_atk1', x, y, vx, vy, ballX = 0, ballY = 0, others = [] }) {
  const s = createShot()
  const gk = capId.endsWith('_gk')
  s.x = x; s.y = y; s.vx = vx; s.vy = vy
  s.r = gk ? GK_RADIUS : CAP_RADIUS
  s.mass = gk ? PHYSICS.gkMass : PHYSICS.playerMass
  s.ballX = ballX; s.ballY = ballY
  others.forEach((o, i) => Object.assign(s.bodies[i], { r: CAP_RADIUS, ...o }))
  s.bodyCount = others.length
  capBounds(capId, 'left', s)
  return predictShot(s)
}

describe('predictShot', () => {
  it('caps and the ball meet as true circles: the ball leaves along the line of centres at first touch', () => {
    for (const offset of [0, 0.3, 0.7, 1.0]) {
      const w = createSimulationWorld({ team1_atk1: { x: -10, y: 0, vx: 1.5, vy: 0 }, ball: { x: -6, y: offset } })
      let dir = null
      for (let f = 0; f < 60 && dir === null; f++) {
        w.step(1000 / 60)
        const v = w.bodies.ball.velocity
        if (Math.hypot(v.x, v.y) > 0.01) dir = deg(v.x, v.y)
      }
      const ideal = deg(Math.sqrt((CAP_RADIUS + BALL_RADIUS) ** 2 - offset ** 2), offset)
      expect(angleDiff(dir, ideal)).toBeLessThan(0.5)
    }
  })

  it('straight-on hit sends the ball along the flick direction', () => {
    const p = shot({ x: -3, y: 4, vx: 3, vy: 0, ballX: 0, ballY: 4 })
    expect(p.contact).toBe('ball')
    // Cap path stops where it touches the ball
    expect(p.capPoints).toBe(2)
    expect(p.capPath[2]).toBeGreaterThan(-3)
    expect(p.capPath[2]).toBeLessThan(-CAP_RADIUS)
    expect(p.contactX).toBeCloseTo(-BALL_RADIUS, 5)
    // Ball runs straight on (+x), faster than the cap (light ball, elastic hit)
    expect(segAngle(p.ballPath, 0)).toBeCloseTo(0, 5)
    expect(p.ballSpeed).toBeGreaterThan(3)
  })

  it('oblique hit deflects the ball along the contact normal', () => {
    // Cap passes above the ball's centre line → ball goes off below it
    const p = shot({ x: -3, y: 0.5, vx: 3, vy: 0 })
    expect(p.contact).toBe('ball')
    const a = segAngle(p.ballPath, 0)
    expect(a).toBeLessThan(-10)
    // Along the (inward) contact normal: the line from the cap's centre at contact to the ball's
    expect(angleDiff(a, deg(-p.normalX, -p.normalY))).toBeLessThan(1e-6)
    const cx = p.capPath[2], cy = p.capPath[3]
    expect(angleDiff(a, deg(-cx, -cy))).toBeLessThan(1e-6)
    expect(Math.hypot(cx, cy)).toBeCloseTo(CAP_RADIUS + BALL_RADIUS, 6)
    // A glancing hit gives the ball less speed than a full one
    const full = shot({ x: -3, y: 0, vx: 3, vy: 0 })
    expect(p.ballSpeed).toBeLessThan(full.ballSpeed)
  })

  it('reflects the ball off a cushion', () => {
    // Straight at the right-hand cushion, well above the goal mouth
    const p = shot({ x: 5, y: 7, vx: 4, vy: 0, ballX: 8, ballY: 7 })
    expect(p.ballPoints).toBeGreaterThanOrEqual(3)
    expect(p.ballPath[2]).toBeCloseTo(PITCH.halfW - BALL_RADIUS, 5)
    expect(p.ballPath[4]).toBeLessThan(p.ballPath[2]) // comes back
    expect(p.bounces).toBeGreaterThanOrEqual(1)

    // At an angle: angle of incidence = angle of reflection (off the top cushion)
    const q = shot({ x: -3, y: 1, vx: 3, vy: 0 }) // a thin hit: the ball heads steeply up the pitch
    const theta = Math.asin(1 / (CAP_RADIUS + BALL_RADIUS))
    expect(q.ballPath[3]).toBeCloseTo(-(PITCH.halfH - BALL_RADIUS), 5)
    expect(segAngle(q.ballPath, 0)).toBeCloseTo(-(theta * 180) / Math.PI, 3)
    // Only the normal component loses energy (the ball's restitution), so it comes off flatter
    expect(segAngle(q.ballPath, 1)).toBeCloseTo(deg(Math.cos(theta), PHYSICS.ballRestitution * Math.sin(theta)), 3)
  })

  it('a slow ball dies on the cushion and slides along it', () => {
    // A soft touch: closing speed at the cushion is under Matter's resting threshold
    const p = shot({ x: -2.8, y: 9, vx: 0.64, vy: 0, ballX: -1.4, ballY: 9.25 })
    expect(p.contact).toBe('ball')
    const i = 1 // first cushion point
    expect(p.ballPath[i * 2 + 1]).toBeCloseTo(PITCH.halfH - BALL_RADIUS, 5)
    expect(p.ballPath[i * 2 + 3]).toBeCloseTo(PITCH.halfH - BALL_RADIUS, 5) // stays on the cushion
  })

  it('a path into the goal mouth ends on the goal line with a goal flag', () => {
    const p = shot({ x: 8, y: 0.1, vx: 3, vy: 0, ballX: 10, ballY: 0 })
    expect(p.end).toBe('goal')
    expect(p.goalDir).toBe(1)
    expect(p.ballPath[(p.ballPoints - 1) * 2]).toBeCloseTo(PITCH.halfW, 5)
    // team1 defends the left goal when team1Side is 'left'
    expect(goalFor(p, 'team1_atk1', 'left')).toBe('score')
    expect(goalFor(p, 'team2_atk1', 'left')).toBe('own')
    expect(goalFor(p, 'team1_atk1', 'right')).toBe('own')

    // Wide of the mouth it's just a cushion
    const wide = shot({ x: 8, y: 5, vx: 4, vy: 0, ballX: 10, ballY: 5 })
    expect(wide.end).not.toBe('goal')
    expect(goalFor(wide, 'team1_atk1')).toBeNull()
  })

  it('an opponent cap in the way is a foul at the point of contact, with no ball path', () => {
    const p = shot({ x: -4, y: 0, vx: 4, vy: 0, others: [{ x: -1.5, y: 0.2, contact: classifyContact('team1_atk1', 'team2_def1') }] })
    expect(p.contact).toBe('foul')
    expect(p.ballPoints).toBe(0)
    expect(p.contactX).toBeGreaterThan(-4)
    expect(p.contactX).toBeLessThan(-1.5)
    expect(Math.hypot(p.contactX + 1.5, p.contactY - 0.2)).toBeCloseTo(CAP_RADIUS, 5)
    // A teammate in the way wastes the turn instead
    const t = shot({ x: -4, y: 0, vx: 4, vy: 0, others: [{ x: -1.5, y: 0.2, contact: classifyContact('team1_atk1', 'team1_def1') }] })
    expect(t.contact).toBe('teammate')
    // A cap just off the line is missed
    const m = shot({ x: -4, y: 0, vx: 4, vy: 0, others: [{ x: -2, y: 2.5, contact: 'foul' }] })
    expect(m.contact).toBe('ball')
  })

  it('the ball path stops at a cap it runs into', () => {
    const p = shot({ x: -3, y: 0, vx: 4, vy: 0, others: [{ x: 6, y: 0, contact: 'foul' }] })
    expect(p.end).toBe('cap')
    expect(p.ballPath[2]).toBeLessThan(6)
  })

  it('the cap can bank off a cushion before reaching the ball', () => {
    const p = shot({ x: -4, y: 7, vx: 3, vy: 3, ballX: 2, ballY: 7 })
    expect(p.contact).toBe('ball')
    expect(p.capPoints).toBe(3)
    expect(p.capPath[3]).toBeCloseTo(PITCH.halfH - CAP_RADIUS, 5)
  })

  it('keeps a goalkeeper in its penalty area', () => {
    const b = capBounds('team1_gk', 'left', {})
    expect(b.maxX).toBeCloseTo(-PITCH.halfW + PITCH.penAreaW - GK_RADIUS)
    expect(capBounds('team1_gk', 'right', {}).minX).toBeCloseTo(PITCH.halfW - PITCH.penAreaW + GK_RADIUS)
  })

  it('reuses its output buffer', () => {
    const s = createShot()
    const out = createPrediction()
    Object.assign(s, { x: -3, y: 0, vx: 3, vy: 0, bodyCount: 0 })
    capBounds('team1_atk1', 'left', s)
    expect(predictShot(s, out)).toBe(out)
    s.vx = -0.5 // gently away from the ball: nothing
    predictShot(s, out)
    expect(out.contact).toBe('none')
    expect(out.ballPoints).toBe(0)
  })
})

/* ── Against the real engine ── */

const initial = useMatchStore.getState()

function place(id, x, y) {
  Matter.Body.setPosition(getBodies()[id], { x, y })
  Matter.Body.setVelocity(getBodies()[id], { x: 0, y: 0 })
}

function frame() {
  // Same step as PhysicsSync at 60 fps
  for (let i = 0; i < PHYSICS.subSteps; i++) stepPhysics(1000 / 60 / PHYSICS.subSteps)
  clampAllBodies()
}

/** The prediction for a flick of capId from the live physics bodies */
function predictFromWorld(capId, velocity) {
  const bodies = getBodies()
  const s = createShot()
  const cap = bodies[capId]
  s.x = cap.position.x; s.y = cap.position.y
  s.vx = velocity.x; s.vy = velocity.y
  s.r = radiusOf(capId)
  s.mass = capId.endsWith('_gk') ? PHYSICS.gkMass : PHYSICS.playerMass
  s.ballX = bodies.ball.position.x; s.ballY = bodies.ball.position.y
  let n = 0
  for (const id in bodies) {
    if (id === 'ball' || id === capId) continue
    const b = s.bodies[n++]
    b.x = bodies[id].position.x; b.y = bodies[id].position.y
    b.r = radiusOf(id)
    b.contact = classifyContact(capId, id)
  }
  s.bodyCount = n
  capBounds(capId, 'left', s)
  return predictShot(s)
}

describe('prediction vs matter-js', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearMatchTimers()
    useMatchStore.setState(initial, true)
    createPhysicsWorld()
    useMatchStore.setState({ phase: PHASE.SELECT, activeTeam: 'team1', team1Side: 'left', kickoffGuard: false })
    // Park everyone else along the bottom cushion, keepers at home
    let x = -10
    for (const id of Object.keys(getBodies())) {
      if (id === 'ball' || id.endsWith('_gk')) continue
      place(id, x, -8.8)
      x += 2.5
    }
    place('team1_gk', -PITCH.halfW + 1.2, 0)
    place('team2_gk', PITCH.halfW - 1.2, 5)
  })
  afterEach(() => {
    clearMatchTimers()
    vi.useRealTimers()
  })

  const cases = [
    // cap offset from the ball, flick velocity
    [-3, 0, 3, 0],
    [-3, 0.35, 3, 0],
    [-3, -0.7, 3, 0],
    [-3, 1.0, 4, 0],
    [-2.2, -2.2, 2.6, 2.6],
    [1.5, 3, -1.2, -3],
    [0, -3, 0.3, 3],
    [-3, 0.4, 1.5, 0], // slow: resting-contact branch
  ]

  it.each(cases)('cap at ball%+s,%+s flicked (%s, %s): ball leaves within 10° of the prediction', (ox, oy, vx, vy) => {
    const bx = -2, by = 2
    place('ball', bx, by)
    place('team1_atk1', bx + ox, by + oy)
    const p = predictFromWorld('team1_atk1', { x: vx, y: vy })
    expect(p.contact).toBe('ball')

    expect(performFlick('team1_atk1', { x: vx, y: vy })).toBeNull()
    const ball = getBodies().ball
    let moved = false
    for (let f = 0; f < 120 && !moved; f++) {
      frame()
      moved = ball.speed > 0.05
    }
    expect(moved).toBe(true)
    frame() // let the contact finish resolving
    const actual = deg(ball.velocity.x, ball.velocity.y)
    expect(angleDiff(actual, segAngle(p.ballPath, 0))).toBeLessThan(10)
    // Speed within 15% too, after the rolling friction of the frames it took to see it
    const rolled = p.ballSpeed - 1.5 * PHYSICS.linearFriction * PHYSICS.ballFrictionRatio
    expect(Math.abs(ball.speed - rolled) / rolled).toBeLessThan(0.15)
  })

  it('the ball meets the cushion where predicted', () => {
    // Glancing hit that sends the ball down to the bottom (+y) cushion, clear of the parked caps
    place('team2_gk', PITCH.halfW - 1.2, -5)
    place('ball', 0, 2)
    place('team1_atk1', -3, 1)
    const p = predictFromWorld('team1_atk1', { x: 4, y: 0 })
    expect(p.bounces).toBeGreaterThanOrEqual(1)
    expect(p.ballPath[3]).toBeCloseTo(PITCH.halfH - BALL_RADIUS, 5)
    const cushion = { x: p.ballPath[2], y: p.ballPath[3] }

    performFlick('team1_atk1', { x: 4, y: 0 })
    const ball = getBodies().ball
    let prevVy = null, hit = null
    // Watch every sub-step (a ball covers a few units per frame)
    for (let i = 0; i < 300 * PHYSICS.subSteps && !hit; i++) {
      stepPhysics(1000 / 60 / PHYSICS.subSteps)
      if (prevVy !== null && Math.sign(ball.velocity.y) !== Math.sign(prevVy) && Math.abs(prevVy) > 0.05) {
        hit = { x: ball.position.x, y: ball.position.y }
      }
      if (ball.speed > 0.05) prevVy = ball.velocity.y
    }
    expect(hit).not.toBeNull()
    expect(Math.hypot(hit.x - cushion.x, hit.y - cushion.y)).toBeLessThan(1)
  })

  it('a predicted goal goes in', () => {
    place('ball', 10, 0.6)
    place('team1_atk1', 7, 0.6)
    const p = predictFromWorld('team1_atk1', { x: 4.5, y: 0 })
    expect(p.end).toBe('goal')
    performFlick('team1_atk1', { x: 4.5, y: 0 })
    const ball = getBodies().ball
    let crossed = false
    for (let f = 0; f < 200 && !crossed; f++) {
      frame()
      crossed = ball.position.x > PITCH.halfW && Math.abs(ball.position.y) < PITCH.goalWidth / 2
    }
    expect(crossed).toBe(true)
  })
})
