import { describe, it, expect } from 'vitest'
import { LEAGUE_ENTRY, LEAGUE_OPENS, qualifies, winsToGo, untilOpen, opensIn } from '../game/leagueRules'
import { cleanClub } from '../state/leagueStore'
import { leagueJoin, leagueInfo } from '../../server/lagos.js'

// An in-memory stand-in for the save store
function memSaves() {
  const m = new Map()
  return async (action, mode, key, data) => {
    const k = `${mode}|${key}`
    if (action === 'get') return m.has(k) ? { data: m.get(k) } : null
    m.set(k, data)
    return { ok: true }
  }
}

describe('Weekend League entry', () => {
  it('takes 15 wins', () => {
    expect(LEAGUE_ENTRY).toBe(15)
    expect(qualifies(14)).toBe(false)
    expect(qualifies(15)).toBe(true)
    expect(winsToGo(7)).toBe(8)
    expect(winsToGo(40)).toBe(0)
    expect(winsToGo(undefined)).toBe(15)
  })
})

describe('Weekend League club', () => {
  it('keeps a name and the look of the caps, nothing else', () => {
    const c = cleanClub({ name: '  Dru   FC  ', primary: '#C8102E', edge: '#fff', art: 'cola', numbers: { atk1: 9 }, hack: 1 })
    expect(c).toEqual({ name: 'Dru FC', primary: '#C8102E', edge: '#fff', art: 'cola' })
  })
  it('needs a name and colours', () => {
    expect(cleanClub({ name: '', primary: '#000', edge: '#fff' })).toBeNull()
    expect(cleanClub({ name: 'X' })).toBeNull()
    expect(cleanClub(null)).toBeNull()
  })
})

describe('Weekend League sign-up (server)', () => {
  it('counts each player once, and knows who has signed up', async () => {
    const saves = memSaves()
    expect(await leagueInfo(saves, 'live', 'ada')).toEqual({ ok: true, registered: 0, me: false })
    expect((await leagueJoin(saves, 'live', 'ada', { name: 'Ada FC' })).registered).toBe(1)
    expect((await leagueJoin(saves, 'live', 'ada', { name: 'Ada United' })).registered).toBe(1)
    expect((await leagueJoin(saves, 'live', 'bayo', { name: 'Bayo' })).registered).toBe(2)
    expect(await leagueInfo(saves, 'live', 'ada')).toEqual({ ok: true, registered: 2, me: true })
    expect((await leagueInfo(saves, 'test', 'ada')).registered).toBe(0)
  })
})

describe('Weekend League countdown', () => {
  it('opens Friday 27 November at 4:30pm in Lagos', () => {
    expect(new Date(LEAGUE_OPENS).toISOString()).toBe('2026-11-27T15:30:00.000Z')
  })
  it('counts down and stops at zero', () => {
    const at = LEAGUE_OPENS - ((1 * 86400 + 10 * 3600 + 32 * 60 + 5) * 1000)
    expect(untilOpen(at)).toEqual({ days: 1, hours: 10, mins: 32, secs: 5, open: false })
    expect(opensIn(at)).toBe('1d 10h')
    expect(opensIn(LEAGUE_OPENS - 90 * 60000)).toBe('1h 30m')
    expect(opensIn(LEAGUE_OPENS - 20000)).toBe('1m')
    expect(untilOpen(LEAGUE_OPENS + 5000).open).toBe(true)
    expect(opensIn(LEAGUE_OPENS + 5000)).toBe('now')
  })
})
