import { describe, it, expect } from 'vitest'
import { crossingY, shotSide, cpuDive, strikeDirection } from '../game/penalty'

describe('penalty reading', () => {
  it('finds where a shot crosses the goal line', () => {
    expect(crossingY(9, 0, 1, 0.5, 15)).toBeCloseTo(3)
    expect(crossingY(9, 0, -1, 0, 15)).toBeNull() // going the other way
  })
  it('sorts shots into left, middle and right', () => {
    expect(shotSide(0.3)).toBe(0)
    expect(shotSide(2.1)).toBe(1)
    expect(shotSide(-2.1)).toBe(-1)
  })
  it('the computer keeper reads the shot when its roll comes up, and guesses wrong otherwise', () => {
    expect(cpuDive(2.4, 'hard', () => 0.1)).toBe(1)
    expect(cpuDive(2.4, 'hard', () => 0.9)).not.toBe(1)
  })
  it('a straight strike sends the ball straight on; an off-centre one cuts it away', () => {
    const straight = strikeDirection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, 1.2)
    expect(straight.x).toBeCloseTo(1); expect(straight.y).toBeCloseTo(0)
    const cut = strikeDirection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0.5 }, 1.2)
    expect(cut.y).toBeGreaterThan(0.3)
    expect(strikeDirection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 3 }, 1.2)).toBeNull() // misses
  })
})
