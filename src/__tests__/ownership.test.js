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
    expect(canUseBand('solid', { owned: [], progress: none })).toBe(true)
    expect(canUseBand('satin', { owned: [], progress: none })).toBe(true)
    expect(canUseBand('chrome', { owned: [], progress: none })).toBe(false)
    expect(canUseBand('chrome', { owned: [], progress: none, bandParts: ['chrome'] })).toBe(true)
    expect(canUseBand('regal', { owned: ['band_pink'], progress: none })).toBe(true) // bought an old band: keeps every extra
  })
  it('takes off a cap and band extras the player does not own, keeps what they do', () => {
    const band = { bandEnabled: true, bandPattern: 'regal', bandBase: '#111111', bandAccent: '#FFD600', bandWidth: 'wide', bandFinish: 'chrome' }
    const kit = { ...fallback, art: 'eko', primary: '#1A0B3B', ...band }
    const fixed = ownKit(kit, fallback, { owned: [], progress: none, bandParts: ['chrome'] })
    expect(fixed.art).toBe('')
    expect(fixed.primary).toBe(fallback.primary)
    expect(fixed.bandPattern).toBe('solid')
    expect(fixed.bandFinish).toBe('chrome')
    expect(fixed.bandWidth).toBe('wide')
    expect(ownKit({ ...fallback, art: 'eko', ...band }, fallback, { owned: ['cap_eko'], progress: none, bandParts: ['regal', 'chrome'] })).toBe(null)
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
