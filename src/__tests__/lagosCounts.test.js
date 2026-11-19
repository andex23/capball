import { describe, it, expect } from 'vitest'
import { handleLagos, countEvent, readStats, statsAllowed, dayOf } from '../../server/lagos.js'

/** A stand-in for the saves function: remembers documents by mode and name. */
function memorySaves() {
  const rows = new Map()
  const saves = async (action, mode, player, data = null) => {
    const k = `${mode}|${player}`
    if (action === 'put') { rows.set(k, JSON.parse(JSON.stringify(data))); return { ok: true } }
    return { ok: true, data: rows.get(k) ?? null }
  }
  saves.rows = rows
  return saves
}
const api = (playerId = 't_a', mode = 'live') => ({ verifySession: async () => ({ status: 200, data: { playerId, mode } }) })
const NOW = Date.UTC(2026, 10, 16, 12)

describe('Lagos Life usage counts', () => {
  it('adds up events by day and counts different players once', async () => {
    const saves = memorySaves()
    await countEvent(saves, 'live', 't_a', 'open', null, NOW)
    await countEvent(saves, 'live', 't_a', 'open', null, NOW)
    await countEvent(saves, 'live', 't_b', 'match_start', 'computer', NOW)
    await countEvent(saves, 'live', 't_b', 'open', null, NOW - 86400000)
    const stats = await readStats(saves, 'live', 3, NOW)
    expect(stats[0]).toEqual({ day: '2026-11-16', players: 2, counts: { open: 2, 'match_start:computer': 1 } })
    expect(stats[1]).toEqual({ day: '2026-11-15', players: 1, counts: { open: 1 } })
    // Nothing that identifies a player is kept
    expect(JSON.stringify([...saves.rows.values()])).not.toContain('t_a')
  })
  it('keeps test and live apart, ignores unknown events and never throws', async () => {
    const saves = memorySaves()
    expect(await countEvent(saves, 'test', 't_a', 'open', null, NOW)).toBe(true)
    expect(await countEvent(saves, 'live', 't_a', 'made_up', null, NOW)).toBe(false)
    expect(await readStats(saves, 'live', 2, NOW)).toEqual([])
    expect(await countEvent(async () => { throw new Error('down') }, 'live', 't_a', 'open')).toBe(false)
    expect(await countEvent(null, 'live', 't_a', 'open')).toBe(false)
    // A detail that isn't a plain word is dropped, the event still counts
    await countEvent(saves, 'test', 't_a', 'find', '<b>', NOW)
    expect((await readStats(saves, 'test', 1, NOW))[0].counts).toEqual({ open: 1, find: 1 })
  })
  it('counts through the server for a verified player only', async () => {
    const saves = memorySaves()
    await expect(handleLagos({ action: 'count', session: 's', event: 'find', detail: 'quick' }, api(), null, saves)).resolves.toEqual({ ok: true })
    await expect(handleLagos({ action: 'count', session: 's', event: 'nonsense' }, api(), null, saves)).rejects.toThrow('bad-request')
    await expect(handleLagos({ action: 'count', event: 'open' }, api(), null, saves)).rejects.toThrow('bad-request')
    const bad = { verifySession: async () => ({ status: 401, data: null }) }
    await expect(handleLagos({ action: 'count', session: 's', event: 'open' }, bad, null, saves)).rejects.toThrow('bad-session')
    expect((await readStats(saves, 'live', 1))[0].counts).toEqual({ 'find:quick': 1 })
  })
  it('counts the errors players hit, by where and which', async () => {
    const saves = memorySaves()
    await handleLagos({ action: 'logError', session: 's', code: 'not_available', where: 'quick' }, api(), null, saves)
    expect((await readStats(saves, 'live', 1))[0].counts).toEqual({ 'error:quick_not_available': 1 })
  })
  it('a real player can never read or write the counts document', async () => {
    const saves = memorySaves()
    await countEvent(saves, 'live', 't_a', 'open', null, NOW)
    // Saves always use the verified player's own id, which Lagos Life issues
    const r = await handleLagos({ action: 'loadSave', session: 's' }, api('t_a'), null, saves)
    expect(r.data).toBeNull()
    expect(dayOf(NOW)).toBe('2026-11-16')
  })
  it('only the owner key opens the stats', () => {
    expect(statsAllowed('abc', { LAGOS_STATS_KEY: 'abc' })).toBe(true)
    expect(statsAllowed('abd', { LAGOS_STATS_KEY: 'abc' })).toBe(false)
    expect(statsAllowed('', { LAGOS_STATS_KEY: 'abc' })).toBe(false)
    expect(statsAllowed('abc', {})).toBe(false)
    expect(statsAllowed(undefined, { LAGOS_STATS_KEY: 'abc' })).toBe(false)
  })
})

describe('the Lagos Life board', () => {
  it('players on the same wins share a place, as Lagos Life counts your rank', async () => {
    const { tiedRank } = await import('../lagos/LagosPanels')
    const top = [{ score: 5 }, { score: 3 }, { score: 3 }, { score: 3 }, { score: 1 }]
    const s = (r) => r.score
    expect(top.map((_, i) => tiedRank(top, i, s))).toEqual([1, 2, 2, 2, 5])
  })
})

describe('the pitch-side board', () => {
  it('runs the top five, with tied places, and you', async () => {
    const { tickerItems } = await import('../lagos/LagosPanels')
    const board = { top: [{ name: 'Alex', score: 14 }, { name: 'Temi', score: 11 }, { name: 'Chidi', score: 11 }, { name: 'Bob', score: 6 }, { name: 'Ade', score: 5 }, { name: 'Zed', score: 4 }], me: { rank: 24, score: 2 } }
    const { items, me } = tickerItems(board, 2)
    expect(items.map((x) => `${x.rank} ${x.name} ${x.wins}`)).toEqual(['1 Alex 14', '2 Temi 11', '2 Chidi 11', '4 Bob 6', '5 Ade 5'])
    expect(me).toEqual({ rank: 24, wins: 2 })
    expect(tickerItems(null).items).toEqual([])
  })
})

describe('goals settle ties on the board', () => {
  it('one number carries wins then goals; old numbers are all wins', async () => {
    const { boardScore, winsOf, goalsOf, rankValue } = await import('../lagos/lagosStore')
    expect(boardScore(2, 13)).toBe(2013)
    expect([winsOf(2013), goalsOf(2013)]).toEqual([2, 13])
    expect([winsOf(3), goalsOf(3)]).toEqual([3, 0]) // from before goals counted
    expect(rankValue(3)).toBeGreaterThan(rankValue(2013)) // 3 wins beats 2 wins, whatever the goals
    expect(boardScore(1, 5000)).toBe(1999) // goals never spill into wins
  })
  it('level on wins, more goals ranks higher; only wins are shown', async () => {
    const { tickerItems } = await import('../lagos/LagosPanels')
    const board = { top: [{ name: 'Bob', score: 2009 }, { name: 'Elder', score: 2013 }, { name: 'Old', score: 3 }, { name: 'Zed', score: 2009 }], me: { rank: 2, score: 2013 } }
    const { items } = tickerItems(board)
    expect(items.map((x) => `${x.rank} ${x.name} ${x.wins}`)).toEqual(['1 Old 3', '2 Elder 2', '3 Bob 2', '3 Zed 2'])
  })
})
