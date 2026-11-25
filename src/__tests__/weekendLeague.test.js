import { describe, it, expect } from 'vitest'
import { LEAGUE_ENTRY, LEAGUE_OPENS, qualifies, winsToGo, untilOpen, opensIn, leagueKey, leagueWindow, isLive, openFixtures, acceptsResults, cleanResult, lineFor, tableOrder, nextOpen, lastLeagueKey } from '../game/leagueRules'
import { leagueClubs } from '../game/leagueClubs'
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

const lagos = (day, h, m = 0) => Date.parse(`2026-11-${String(day).padStart(2, '0')}T00:00:00Z`) - 3600000 + (h * 60 + m) * 60000

describe('Weekend League weekends', () => {
  it('runs Friday 4:30pm to Sunday midnight in Lagos', () => {
    expect(leagueKey(lagos(25, 12))).toBe('2026-11-27') // Wednesday: the coming one
    expect(leagueKey(lagos(28, 12))).toBe('2026-11-27')
    expect(leagueKey(lagos(29, 23, 59))).toBe('2026-11-27')
    expect(leagueKey(lagos(30, 0, 1))).toBe('2026-12-04') // Monday: next one
    expect(isLive(lagos(27, 16, 29))).toBe(false)
    expect(isLive(lagos(27, 16, 30))).toBe(true)
    expect(isLive(lagos(29, 23, 59))).toBe(true)
    expect(isLive(lagos(30, 0, 0))).toBe(false)
    expect(lastLeagueKey(lagos(30, 9))).toBe('2026-11-27')
    expect(nextOpen(lagos(30, 9))).toBe(leagueWindow('2026-12-04').start)
  })
  it('opens five fixtures a day', () => {
    expect(openFixtures('2026-11-27', lagos(27, 16))).toBe(0)
    expect(openFixtures('2026-11-27', lagos(27, 17))).toBe(5)
    expect(openFixtures('2026-11-27', lagos(28, 0, 1))).toBe(10)
    expect(openFixtures('2026-11-27', lagos(29, 10))).toBe(15)
    expect(acceptsResults('2026-11-27', lagos(30, 1))).toBe(true)
    expect(acceptsResults('2026-11-27', lagos(30, 3))).toBe(false)
  })
})

describe('Weekend League table', () => {
  it('cleans results and adds up a line', () => {
    expect(cleanResult({ gf: 2, ga: 1 })).toEqual({ gf: 2, ga: 1 })
    expect(cleanResult({ gf: 13, ga: 0 })).toBeNull()
    expect(cleanResult({ gf: 1.5, ga: 0 })).toBeNull()
    const line = lineFor([{ gf: 2, ga: 0 }, null, { gf: 1, ga: 1 }, { gf: 0, ga: 3, left: true }])
    expect(line).toEqual({ p: 3, w: 1, d: 1, l: 1, gf: 3, ga: 4, gd: -1, pts: 4 })
  })
  it('orders by points, goal difference, goals, then who got there first', () => {
    const rows = [
      { id: 'a', pts: 6, gd: 1, gf: 3, at: 5 },
      { id: 'b', pts: 6, gd: 2, gf: 2, at: 9 },
      { id: 'c', pts: 6, gd: 2, gf: 4, at: 9 },
      { id: 'd', pts: 6, gd: 2, gf: 4, at: 1 },
      { id: 'e', pts: 7, gd: -3, gf: 0, at: 1 },
    ]
    expect(rows.sort(tableOrder).map((r) => r.id).join('')).toBe('edcba')
  })
  it('has fifteen clubs, all hard, the same for everyone, new each weekend', () => {
    const a = leagueClubs('2026-11-27')
    expect(a).toHaveLength(15)
    expect(a).toEqual(leagueClubs('2026-11-27'))
    expect(a.every((c) => c.difficulty === 'hard' && c.name)).toBe(true)
    expect(new Set(a.map((c) => c.name)).size).toBe(15)
    expect(leagueClubs('2026-12-04').map((c) => c.name)).not.toEqual(a.map((c) => c.name))
  })
})

import { leagueStart, leagueFinish, leagueTable } from '../../server/league.js'
import { handleLeagueWeb } from '../../server/leagueWeb.js'

describe('Weekend League on the server', () => {
  const FRI = lagos(27, 18)
  const SAT = lagos(28, 12)
  it('needs a sign-up, opens five a day, and lets each fixture be played once', async () => {
    const saves = memSaves()
    await expect(leagueStart(saves, 'live', 'ada', { key: '2026-11-27', index: 0 }, FRI)).rejects.toThrow('not-signed-up')
    await leagueJoin(saves, 'live', 'ada', { name: 'Ada FC' })
    await expect(leagueStart(saves, 'live', 'ada', { key: '2026-11-27', index: 5 }, FRI)).rejects.toThrow('bad-request')
    const started = await leagueStart(saves, 'live', 'ada', { key: '2026-11-27', index: 0 }, FRI)
    expect(started.me).toMatchObject({ rank: 1, p: 1, l: 1, pts: 0, gd: -3 })
    const done = await leagueFinish(saves, 'live', 'ada', { key: '2026-11-27', index: 0, gf: 2, ga: 1 }, FRI + 60000)
    expect(done.me).toMatchObject({ p: 1, w: 1, pts: 3, gd: 1 })
    await expect(leagueFinish(saves, 'live', 'ada', { key: '2026-11-27', index: 0, gf: 9, ga: 0 }, FRI + 90000)).rejects.toThrow('already-played')
    await expect(leagueStart(saves, 'live', 'ada', { key: '2026-11-27', index: 0 }, FRI + 90000)).rejects.toThrow('already-played')
    await leagueStart(saves, 'live', 'ada', { key: '2026-11-27', index: 6 }, SAT)
  })
  it('leaving early keeps the 3–0 loss', async () => {
    const saves = memSaves()
    await leagueJoin(saves, 'live', 'bayo', { name: 'Bayo' })
    await leagueStart(saves, 'live', 'bayo', { key: '2026-11-27', index: 1 }, FRI)
    const t = await leagueTable(saves, 'live', 'bayo', { key: '2026-11-27' }, FRI + 600000)
    expect(t.results[1]).toMatchObject({ gf: 0, ga: 3, left: true })
    expect(t.me).toMatchObject({ p: 1, l: 1, pts: 0 })
  })
  it('ranks players on one table, with Lagos Life and the website kept apart', async () => {
    const saves = memSaves()
    for (const [id, gf] of [['a', 1], ['b', 3], ['c', 0]]) {
      await leagueJoin(saves, 'live', id, { name: id.toUpperCase() })
      await leagueStart(saves, 'live', id, { key: '2026-11-27', index: 0 }, FRI)
      await leagueFinish(saves, 'live', id, { key: '2026-11-27', index: 0, gf, ga: 0 }, FRI + 1000)
    }
    const t = await leagueTable(saves, 'live', 'a', { key: '2026-11-27' }, FRI + 5000)
    expect(t.top.map((r) => r.name)).toEqual(['B', 'A', 'C'])
    expect(t.me.rank).toBe(2)
    expect((await leagueTable(saves, 'web', 'a', { key: '2026-11-27' }, FRI)).players).toBe(0)
  })
  it('the website version needs a signed-in account', async () => {
    const saves = memSaves()
    const check = async (t) => (t === 'good-token-123456789012' ? 'acc1' : null)
    await expect(handleLeagueWeb({ action: 'leagueInfo', token: 'nope' }, check, saves)).rejects.toThrow('signed-out')
    await expect(handleLeagueWeb({ action: 'whatever', token: 'good-token-123456789012' }, check, saves)).rejects.toThrow('bad-request')
    const r = await handleLeagueWeb({ action: 'leagueJoin', token: 'good-token-123456789012', name: 'Web FC' }, check, saves)
    expect(r.registered).toBe(1)
  })
})
