import { describe, it, expect } from 'vitest'
import { bandStyleOf, cleanBandFields, ownBand, bandPartsUsed, isFreeBandPart, BAND_PART_PRICES, drawBand, BAND_PATTERNS } from '../game/bandStyle'
import { sanitizeTeamConfig } from '../multiplayer/protocol'
import { sanitizeTeam } from '../game/tournament'

const band = { bandEnabled: true, bandPattern: 'regal', bandBase: '#5B1E7A', bandAccent: '#E9C46A', bandWidth: 'wide', bandFinish: 'chrome' }

describe('Band Studio', () => {
  it('is off unless switched on, and cleans odd values', () => {
    expect(bandStyleOf({})).toBe(null)
    expect(bandStyleOf({ ...band, bandEnabled: false })).toBe(null)
    expect(bandStyleOf(band)).toEqual({ pattern: 'regal', base: '#5B1E7A', accent: '#E9C46A', width: 'wide', finish: 'chrome' })
    expect(bandStyleOf({ bandEnabled: true, bandPattern: 'plaid', bandBase: 'red', bandWidth: 'huge', bandFinish: 'gold' }))
      .toEqual({ pattern: 'solid', base: '#1A1A1A', accent: '#FFD600', width: 'standard', finish: 'satin' })
  })

  it('keeps the band through online play, saves and tournaments, and nothing else', () => {
    const odd = { ...band, bandPattern: 'plaid', bandBase: '<script>' }
    for (const out of [sanitizeTeamConfig(odd), sanitizeTeam(odd)]) {
      expect(out.bandEnabled).toBe(true)
      expect(out.bandPattern).toBe('solid')
      expect(out.bandBase).toBe('#1A1A1A')
      expect(out.bandFinish).toBe('chrome')
    }
    expect(sanitizeTeamConfig({ bands: { gk: 'pink' } }).bands).toBeUndefined()
    expect(cleanBandFields({}).bandEnabled).toBe(false)
  })

  it('Solid, Twin Line, Matte and Satin are free; the rest cost ₦500k once', () => {
    for (const k of ['solid', 'twin', 'matte', 'satin']) expect(isFreeBandPart(k)).toBe(true)
    expect(Object.keys(BAND_PART_PRICES).sort()).toEqual(['chevron', 'chrome', 'gloss', 'grid', 'regal'])
    for (const p of Object.values(BAND_PART_PRICES)) expect(p).toBe(500000)
    expect(bandPartsUsed(band)).toEqual(['regal', 'chrome'])
  })

  it('swaps an extra the player has not bought for a free one', () => {
    const fixed = ownBand(band, (k) => k === 'chrome')
    expect(fixed.bandPattern).toBe('solid')
    expect(fixed.bandFinish).toBe('chrome')
    expect(ownBand(band, () => true)).toBe(null)
    expect(ownBand({ ...band, bandEnabled: false }, () => false)).toBe(null)
  })

  it('draws every pattern without errors', () => {
    const calls = []
    const ctx = new Proxy({}, { get: (_, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => calls.push(k)), set: () => true })
    for (const pattern of BAND_PATTERNS) drawBand(ctx, 256, 32, { pattern, base: '#000000', accent: '#FFFFFF' })
    expect(calls.length).toBeGreaterThan(20)
  })
})
