import { describe, it, expect } from 'vitest'
import {
  weekendKey, isOpen, lastWeekendKey, weekendWindow, acceptsResults, cleanRun, runPoints, runOver, runComplete, extends_, matchPoints,
} from '../game/weekendRules'
import { weekendClubs } from '../game/weekendCup'
import { weekendSubmit, weekendTable, tableView, cleanName } from '../../server/lagos.js'
import { nextUp } from '../state/weekendStore'

// Lagos is UTC+1: Friday 27 Nov 2026 00:00 Lagos is Thursday 23:00 UTC
const lagos = (d, h, m = 0) => Date.UTC(2026, 10, d, h - 1, m)

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
const W = (gf, ga, pens = null) => ({ gf, ga, pens })

describe('Weekend Cup timing (Lagos time)', () => {
  it('runs Friday 00:00 to Sunday 23:59 in Lagos', () => {
    expect(isOpen(lagos(26, 23, 59))).toBe(false) // Thursday night
    expect(isOpen(lagos(27, 0, 0))).toBe(true) // Friday midnight
    expect(isOpen(lagos(29, 23, 59))).toBe(true) // Sunday night
    expect(isOpen(lagos(30, 0, 0))).toBe(false) // Monday
    expect(weekendKey(lagos(28, 12))).toBe('2026-11-27')
    expect(weekendKey(lagos(24, 12))).toBe('2026-11-27') // Tuesday: the coming one
    expect(weekendWindow('2026-11-27')).toEqual({ start: lagos(27, 0), end: lagos(30, 0) })
  })
  it('knows which weekend Monday reports on', () => {
    expect(lastWeekendKey(lagos(30, 9))).toBe('2026-11-27')
    expect(lastWeekendKey(lagos(28, 9))).toBe('2026-11-20')
  })
  it('takes results until shortly after it closes', () => {
    expect(acceptsResults('2026-11-27', lagos(30, 1))).toBe(true)
    expect(acceptsResults('2026-11-27', lagos(30, 3))).toBe(false)
    expect(acceptsResults('2026-11-27', lagos(26, 22))).toBe(false)
  })
})

describe('Weekend Cup runs', () => {
  it('scores win 3, draw 1, plus 1 a goal', () => {
    expect(matchPoints(W(3, 1))).toBe(6)
    expect(matchPoints(W(1, 1, 'won'))).toBe(2)
    expect(matchPoints(W(0, 2))).toBe(0)
    expect(runPoints([W(3, 1), W(2, 0), W(1, 1, 'won')])).toBe(13)
  })
  it('ends a run on a loss or a lost shootout, or after five', () => {
    expect(runOver([W(1, 0)])).toBe(false)
    expect(runOver([W(1, 0), W(0, 1)])).toBe(true)
    expect(runOver([W(1, 1, 'lost')])).toBe(true)
    expect(runOver([W(1, 1, 'won')])).toBe(false)
    const five = [W(1, 0), W(1, 0), W(1, 0), W(1, 0), W(1, 1, 'won')]
    expect(runOver(five)).toBe(true)
    expect(runComplete(five)).toBe(true)
    expect(runComplete([...five.slice(0, 4), W(0, 1)])).toBe(false)
  })
  it('turns away results that can’t be right', () => {
    expect(cleanRun([W(1, 0), W(2, 2)])).toBeNull() // a draw needs a shootout result
    expect(cleanRun([W(0, 1), W(1, 0)])).toBeNull() // played on after losing
    expect(cleanRun([W(40, 0)])).toBeNull()
    expect(cleanRun([W(1.5, 0)])).toBeNull()
    expect(cleanRun(Array(6).fill(W(1, 0)))).toBeNull()
    expect(cleanRun([{ gf: 2, ga: 1, pens: 'won' }])).toEqual([W(2, 1)])
  })
  it('only lets a run carry on, never be rewritten', () => {
    expect(extends_([W(1, 0)], [W(1, 0), W(2, 0)])).toBe(true)
    expect(extends_([W(1, 0)], [W(3, 0)])).toBe(false)
    expect(extends_([W(1, 0), W(2, 0)], [W(1, 0)])).toBe(false)
  })
  it('knows what is next up', () => {
    expect(nextUp([])).toEqual({ run: 0, round: 0 })
    expect(nextUp([[W(1, 0)]])).toEqual({ run: 0, round: 1 })
    expect(nextUp([[W(0, 1)]])).toEqual({ run: 1, round: 0 })
    expect(nextUp([[W(0, 1)], [W(0, 1)], [W(1, 0), W(0, 1)]])).toBeNull()
  })
  it('has five clubs, the same for everyone, harder each round', () => {
    const a = weekendClubs('2026-11-27')
    expect(a).toEqual(weekendClubs('2026-11-27'))
    expect(a.map((c) => c.difficulty)).toEqual(['easy', 'easy', 'medium', 'hard', 'hard'])
    expect(new Set(a.map((c) => c.name)).size).toBe(5)
    expect(weekendClubs('2026-12-04').map((c) => c.name)).not.toEqual(a.map((c) => c.name))
  })
})

describe('Weekend Cup table on the server', () => {
  const NOW = lagos(28, 15)
  const submit = (saves, player, body, now = NOW) => weekendSubmit(saves, 'live', player, { key: '2026-11-27', name: player, ...body }, now)

  it('keeps each player’s best run and ranks the table', async () => {
    const saves = memorySaves()
    await submit(saves, 'ada', { run: 1, matches: [W(3, 1)] })
    await submit(saves, 'ada', { run: 1, matches: [W(3, 1), W(0, 2)] })
    await submit(saves, 'ada', { run: 2, matches: [W(2, 0), W(2, 0)] })
    const r = await submit(saves, 'tobi', { run: 1, matches: [W(1, 0)] })
    expect(r.players).toBe(2)
    expect(r.top.map((x) => [x.name, x.points])).toEqual([['ada', 10], ['tobi', 4]])
    expect(r.me).toEqual({ rank: 2, points: 4 })
    const t = await weekendTable(saves, 'live', 'ada', 'now', NOW)
    expect(t.me).toEqual({ rank: 1, points: 10 })
    expect(t.top[0].me).toBe(true)
    // The table knows players by a one-way hash, never their Lagos Life id
    expect(Object.keys(saves.rows.get('live|__weekend__:2026-11-27').rows)).not.toContain('ada')
  })
  it('refuses rewritten runs, runs out of order, a fourth run, bad scores and the wrong weekend', async () => {
    const saves = memorySaves()
    await submit(saves, 'ada', { run: 1, matches: [W(1, 0)] })
    await expect(submit(saves, 'ada', { run: 1, matches: [W(5, 0)] })).rejects.toThrow('bad-request')
    await expect(submit(saves, 'ada', { run: 3, matches: [W(1, 0)] })).rejects.toThrow('bad-request')
    await expect(submit(saves, 'ada', { run: 4, matches: [W(1, 0)] })).rejects.toThrow('bad-request')
    await expect(submit(saves, 'ada', { run: 1, matches: [W(1, 0), W(30, 0)] })).rejects.toThrow('bad-request')
    await expect(submit(saves, 'ada', { run: 1, matches: [W(1, 0)] }, lagos(25, 12))).rejects.toThrow('bad-request')
    await expect(weekendSubmit(saves, 'live', 'ada', { key: '2026-11-20', run: 1, matches: [W(1, 0)] }, NOW)).rejects.toThrow('bad-request')
  })
  it('takes the last match of the weekend just after midnight', async () => {
    const saves = memorySaves()
    await expect(submit(saves, 'ada', { run: 1, matches: [W(1, 0)] }, lagos(30, 0, 30))).resolves.toMatchObject({ ok: true })
  })
  it('breaks ties by who got there first, and cleans names', () => {
    const v = tableView({ rows: { a: { name: 'A', best: 9, at: 5 }, b: { name: 'B', best: 9, at: 2 }, c: { name: 'C', best: 12, at: 9 } } }, 'a')
    expect(v.top.map((x) => x.name)).toEqual(['C', 'B', 'A'])
    expect(v.me).toEqual({ rank: 3, points: 9 })
    expect(cleanName('<b>Emrys</b>!!')).toBe('bEmrysb')
    expect(cleanName('')).toBe('Player')
  })
})

describe('Weekend Cup matches', async () => {
  const { vi, beforeEach, afterEach } = await import('vitest')
  const { useWeekendStore } = await import('../state/weekendStore')
  const { useMatchStore, SCREEN } = await import('../state/MatchStore')
  const { useLagosStore } = await import('../lagos/lagosStore')
  const sent = []
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(lagos(28, 15))
    sent.length = 0
    useLagosStore.setState({ weekend: async (action, body) => { sent.push([action, body]); return { players: 1, top: [], me: null } } })
    useWeekendStore.setState({ key: null, runs: [], playing: null, stash: null, paid: [] })
    useMatchStore.setState({ aiDifficulty: 'medium', matchDuration: 180, gameMode: 'local', screen: SCREEN.WEEKEND })
  })
  afterEach(() => { vi.useRealTimers() })

  it('plays a round against the next club, records it, and gives your settings back', () => {
    expect(useWeekendStore.getState().play()).toBe(true)
    let ms = useMatchStore.getState()
    expect(ms.screen).toBe(SCREEN.FORMATION)
    expect(ms.gameMode).toBe('ai')
    expect(ms.aiDifficulty).toBe('easy')
    expect(ms.teamConfig.team2.name).toBe(weekendClubs('2026-11-27')[0].name)
    useMatchStore.setState({ screen: SCREEN.PLAYING })
    useMatchStore.setState({ screen: SCREEN.MATCH_END })
    useWeekendStore.getState().finish({ score: { team1: 2, team2: 1 }, penaltyScore: null })
    ms = useMatchStore.getState()
    expect(ms.screen).toBe(SCREEN.WEEKEND)
    expect(ms.aiDifficulty).toBe('medium')
    expect(ms.matchDuration).toBe(180)
    expect(useWeekendStore.getState().runs).toEqual([[W(2, 1)]])
    expect(sent[0]).toEqual(['weekendSubmit', { key: '2026-11-27', run: 1, matches: [W(2, 1)], name: 'Player' }])
  })
  it('records a draw with the shootout result', () => {
    useWeekendStore.getState().play()
    useWeekendStore.getState().finish({ score: { team1: 1, team2: 1 }, penaltyScore: { team1: 3, team2: 4 } })
    expect(useWeekendStore.getState().runs).toEqual([[W(1, 1, 'lost')]])
  })
  it('doesn’t count a match left early: that round is played again', () => {
    useWeekendStore.getState().play()
    useMatchStore.setState({ screen: SCREEN.PLAYING })
    useMatchStore.getState().quitMatch(SCREEN.MENU)
    expect(useWeekendStore.getState().playing).toBeNull()
    expect(useWeekendStore.getState().runs).toEqual([])
    expect(useMatchStore.getState().aiDifficulty).toBe('medium')
  })
  it('stays shut outside the weekend', () => {
    vi.setSystemTime(lagos(25, 12))
    expect(useWeekendStore.getState().play()).toBe(false)
  })
})
