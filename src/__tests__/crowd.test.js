import { describe, it, expect } from 'vitest'
import {
  crowdIntensity, approachLevel, detectCushionBounce, isNearMiss, CROWD_IDLE, FAST_BALL,
} from '../game/crowd'
import { PITCH, BALL_RADIUS } from '../data/TeamData'

const DT = 1 / 60

describe('crowd intensity', () => {
  it('idles when the ball sits still in midfield', () => {
    expect(crowdIntensity(0, 0, 0)).toBeCloseTo(CROWD_IDLE)
  })

  it('rises as the ball nears either goal', () => {
    const far = crowdIntensity(0, 0, 0)
    const closer = crowdIntensity(8, 0, 0)
    const atMouth = crowdIntensity(PITCH.halfW - 0.5, 0, 0)
    expect(closer).toBeGreaterThan(far)
    expect(atMouth).toBeGreaterThan(closer)
    // Symmetric: both goals matter, whichever end
    expect(crowdIntensity(-8, 1, 0)).toBeCloseTo(crowdIntensity(8, -1, 0))
  })

  it('cares more about the goal mouth than the corner flag', () => {
    expect(crowdIntensity(PITCH.halfW - 1, 0, 0)).toBeGreaterThan(crowdIntensity(PITCH.halfW - 1, PITCH.halfH - 1, 0))
  })

  it('rises with ball speed, most of all near goal', () => {
    expect(crowdIntensity(0, 0, FAST_BALL)).toBeGreaterThan(crowdIntensity(0, 0, 20))
    const midBoost = crowdIntensity(0, 0, FAST_BALL) - crowdIntensity(0, 0, 0)
    const goalBoost = crowdIntensity(11, 0, FAST_BALL) - crowdIntensity(11, 0, 0)
    expect(goalBoost).toBeGreaterThan(midBoost)
  })

  it('stays within 0–1', () => {
    for (const x of [-20, -15, 0, 14.9, 20]) {
      for (const speed of [0, 100, 10000]) {
        const v = crowdIntensity(x, 0, speed)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('swells faster than it fades', () => {
    const up = approachLevel(0.2, 1, 0.1)
    const down = approachLevel(1, 0.2, 0.1)
    expect(up - 0.2).toBeGreaterThan(1 - down)
    expect(approachLevel(0.5, 0.5, 0.1)).toBe(0.5)
  })
})

describe('cushion bounces', () => {
  const wallX = PITCH.halfW - BALL_RADIUS

  it('spots a bounce off an end cushion and where it hit', () => {
    // Moving right at 3 units/frame, bounces off the end wall just outside the post
    const p0 = { x: wallX - 4, z: 4.2 }
    const p1 = { x: wallX - 1, z: 4.2 }
    const p2 = { x: wallX - 1.8, z: 4.2 }
    const b = detectCushionBounce(p0, p1, p2, DT)
    expect(b.wall).toBe('end')
    expect(b.z).toBeCloseTo(4.2)
    expect(b.speed).toBeCloseTo(180)
    expect(isNearMiss(b)).toBe(true)
  })

  it('spots a bounce off a side cushion', () => {
    const wallZ = PITCH.halfH - BALL_RADIUS
    const b = detectCushionBounce({ x: 0, z: wallZ - 3 }, { x: 1, z: wallZ - 0.5 }, { x: 2, z: wallZ - 1.5 }, DT)
    expect(b.wall).toBe('side')
    expect(isNearMiss(b)).toBe(false)
  })

  it('ignores a ball bouncing off a cap in midfield', () => {
    expect(detectCushionBounce({ x: -2, z: 0 }, { x: 0, z: 0 }, { x: -1, z: 0 }, DT)).toBeNull()
  })

  it('ignores a ball that just keeps rolling', () => {
    expect(detectCushionBounce({ x: 10, z: 1 }, { x: 12, z: 1 }, { x: 14, z: 1 }, DT)).toBeNull()
  })

  it('only calls it a near miss just outside a post, and at pace', () => {
    const post = PITCH.goalWidth / 2
    expect(isNearMiss({ wall: 'end', z: post + 0.5, speed: 120 })).toBe(true)
    expect(isNearMiss({ wall: 'end', z: -(post + 1), speed: 120 })).toBe(true)
    expect(isNearMiss({ wall: 'end', z: post + 5, speed: 120 })).toBe(false) // way wide
    expect(isNearMiss({ wall: 'end', z: post + 0.5, speed: 10 })).toBe(false) // a dribble
    expect(isNearMiss(null)).toBe(false)
  })
})
