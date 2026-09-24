/* ── Crowd reactions ──
   Pure helpers that turn what the ball is doing into crowd noise levels and
   "moments" (cushion hits, near misses). Positions are in pitch units with
   z as the pitch's short axis, the same as the three.js meshes; speeds are
   pitch units per second. */
import { PITCH, BALL_RADIUS } from '../data/TeamData'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// Ball speeds (units/s). A full-power flick is ~270.
export const FAST_BALL = 180 // "fast" for crowd excitement
export const HARD_CUSHION = 90 // a cushion hit worth a buzz on the phone
const NEAR_GOAL = 12 // the crowd starts to lean in within this distance of a goal mouth
const NEAR_MISS_WIDTH = 2.2 // how far outside a post still counts as a near miss

/** Baseline crowd level between moments. */
export const CROWD_IDLE = 0.2

/**
 * Crowd level 0–1 from where the ball is and how fast it's moving: louder
 * the closer it gets to either goal mouth and the faster it travels.
 */
export function crowdIntensity(x, z, speed, pitch = PITCH) {
  const dx = Math.max(0, pitch.halfW - Math.abs(x)) // to the nearest goal line
  const dz = Math.max(0, Math.abs(z) - pitch.goalWidth / 2) // outside the posts
  const near = clamp01(1 - Math.hypot(dx, dz) / NEAR_GOAL)
  const pace = clamp01(speed / FAST_BALL)
  return clamp01(CROWD_IDLE + 0.5 * near * near + 0.3 * pace + 0.3 * near * pace)
}

/** Ease `current` toward `target`: quick to swell, slower to die away. */
export function approachLevel(current, target, dt, rise = 6, fall = 1.5) {
  const rate = target > current ? rise : fall
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

/**
 * Did the ball just bounce off a cushion? Takes the positions from three
 * consecutive frames (p0 → p1 → p2, each {x, z}) and the frame time.
 * Returns { wall: 'end' | 'side', x, z, speed } with the estimated impact
 * point and the speed going in, or null.
 *
 * The ball turned round somewhere between p1 and p2; assuming it kept its
 * speed, the turning point is where p1 → turn → p2 adds up to one frame's
 * travel. A bounce off a cap mid-pitch also turns the ball round, so the turn
 * must be at a cushion. The end zone is deeper because the goal frame juts
 * into the pitch beside each post.
 */
export function detectCushionBounce(p0, p1, p2, dt, pitch = PITCH, radius = BALL_RADIUS) {
  if (!(dt > 0)) return null
  const vin = { x: (p1.x - p0.x) / dt, z: (p1.z - p0.z) / dt }
  const vout = { x: (p2.x - p1.x) / dt, z: (p2.z - p1.z) / dt }
  const speed = Math.hypot(vin.x, vin.z)

  const turn = (vIn, vOut, a1, a2, limit, zone) => {
    // Heading for a cushion on this axis, then away from it
    if (!(vIn * vOut < 0)) return null
    const dir = Math.sign(vIn)
    const at = (a1 + a2 + dir * Math.abs(vIn) * dt) / 2
    return at * dir >= limit - zone ? at : null
  }

  const endX = turn(vin.x, vout.x, p1.x, p2.x, pitch.halfW - radius, 2)
  if (endX !== null) {
    return { wall: 'end', x: endX, z: p1.z + (endX - p1.x) * (vin.z / vin.x), speed }
  }
  const sideZ = turn(vin.z, vout.z, p1.z, p2.z, pitch.halfH - radius, 0.6)
  if (sideZ !== null) {
    return { wall: 'side', x: p1.x + (sideZ - p1.z) * (vin.x / vin.z), z: sideZ, speed }
  }
  return null
}

/** Is an end-cushion bounce close enough outside a post to be a near miss? */
export function isNearMiss(bounce, pitch = PITCH) {
  if (!bounce || bounce.wall !== 'end') return false
  const outside = Math.abs(bounce.z) - pitch.goalWidth / 2
  return outside >= 0 && outside <= NEAR_MISS_WIDTH && bounce.speed >= 40
}
