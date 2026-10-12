import { describe, it, expect } from 'vitest'
import { followShift } from '../scene/useBallFollow'

describe('follow-the-ball camera', () => {
  it('leans halfway towards the ball', () => {
    expect(followShift(4, -2)).toEqual([2, -1])
  })
  it('never moves further than the cap', () => {
    const [x, z] = followShift(40, 0)
    expect(Math.hypot(x, z)).toBeCloseTo(6)
  })
})
