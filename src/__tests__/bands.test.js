import { describe, it, expect } from 'vitest'
import { BANDS, bandEarned, bandColor } from '../data/bands'
import { sanitizeTeamConfig } from '../multiplayer/protocol'
import { sanitizeTeam } from '../game/tournament'
import { isProduct } from '../data/shop'

const none = { won: 0, goalsFor: 0, cleanSheets: 0, promotions: 0, titles: 0, cups: 0, streak: 0 }

describe('rubber bands', () => {
  it('free bands are open, earned ones open at their goal, shop-only never by play', () => {
    const by = (k) => BANDS.find((b) => b.key === k)
    expect(bandEarned(by('red'), none)).toBe(true)
    expect(bandEarned(by('blue'), none)).toBe(false)
    expect(bandEarned(by('blue'), { ...none, won: 3 })).toBe(true)
    expect(bandEarned(by('gold'), { ...none, won: 999, cups: 99 })).toBe(false)
  })
  it('keeps only real bands on real players, online and in tournaments', () => {
    expect(sanitizeTeamConfig({ bands: { gk: 'pink', atk1: 'plaid', nobody: 'red' } }).bands).toEqual({ gk: 'pink' })
    expect(sanitizeTeam({ bands: { def1: 'gold', mid: 7 } }).bands).toEqual({ def1: 'gold' })
  })
  it('every band that costs money is a product, free ones are not', () => {
    expect(isProduct('band_gold')).toBe(true)
    expect(isProduct('band_red')).toBe(false)
    expect(bandColor('pink')).toMatch(/^#/)
    expect(bandColor('nope')).toBe(null)
  })
})
