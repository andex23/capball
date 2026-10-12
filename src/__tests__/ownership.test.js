import { describe, it, expect, beforeEach } from 'vitest'
import { ownKit, canUseArt, canUseBand, switchSaveTo } from '../lagos/ownership'
import { DEFAULT_TEAM_CONFIG } from '../state/MatchStore'

const none = { won: 0, goalsFor: 0, cleanSheets: 0, promotions: 0, titles: 0, cups: 0, streak: 0 }
const fallback = DEFAULT_TEAM_CONFIG.team1

describe('only the player who bought or earned it can use it', () => {
  it('exclusive caps need buying; rare caps can be bought or earned; starters are free', () => {
    expect(canUseArt('ankara', { owned: [], progress: none })).toBe(false)
    expect(canUseArt('ankara', { owned: ['cap_ankara'], progress: none })).toBe(true)
    expect(canUseArt('silver', { owned: [], progress: { ...none, won: 10 } })).toBe(true)
    expect(canUseArt('silver', { owned: [], progress: none })).toBe(false)
    expect(canUseArt('stout', { owned: [], progress: none })).toBe(true)
    expect(canUseBand('gold', { owned: [], progress: none })).toBe(false)
    expect(canUseBand('red', { owned: [], progress: none })).toBe(true)
  })
  it('takes off a cap and bands the player does not own, keeps what they do', () => {
    const kit = { ...fallback, art: 'eko', primary: '#1A0B3B', bands: { gk: 'gold', atk1: 'red', mid: 'pink' } }
    const fixed = ownKit(kit, fallback, { owned: ['band_pink'], progress: none })
    expect(fixed.art).toBe('')
    expect(fixed.primary).toBe(fallback.primary)
    expect(fixed.bands).toEqual({ atk1: 'red', mid: 'pink' })
    expect(ownKit({ ...fallback, art: 'eko', bands: {} }, fallback, { owned: ['cap_eko'], progress: none })).toBe(null)
  })
})

describe('shared phone: each Lagos Life player has their own save', () => {
  let mem
  beforeEach(() => {
    mem = new Map()
    globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
  })
  it('the first player keeps what is on the phone; a second player starts clean; the first gets theirs back', () => {
    mem.set('capball:career:v1', 'ADA-CAREER')
    expect(switchSaveTo('p_ada')).toBe(false)
    expect(mem.get('capball:career:v1')).toBe('ADA-CAREER')
    expect(switchSaveTo('p_bayo')).toBe(true)
    expect(mem.has('capball:career:v1')).toBe(false)
    mem.set('capball:career:v1', 'BAYO-CAREER')
    expect(switchSaveTo('p_ada')).toBe(true)
    expect(mem.get('capball:career:v1')).toBe('ADA-CAREER')
    expect(switchSaveTo('p_bayo')).toBe(true)
    expect(mem.get('capball:career:v1')).toBe('BAYO-CAREER')
    expect(switchSaveTo('p_bayo')).toBe(false)
  })
})
