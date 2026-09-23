import { describe, it, expect } from 'vitest'
import { emptyRecords, sanitizeRecords, matchEntry, applyMatch, resetRecords, recordLine } from '../game/records'

const idFor = (k) => `s.0.${k}`
const result = (score, winner, extra = {}) => ({ winner, isDraw: !winner, score, ...extra })
const state = (over) => ({ screen: 'MATCH_END', matchKey: 1, gameMode: 'ai', aiTeam: 'team2', aiDifficulty: 'hard', onlineMyTeam: null, ...over })

describe('matchEntry', () => {
  it('vs CPU: the player is the team the CPU is not', () => {
    const e = matchEntry(state({ matchResult: result({ team1: 3, team2: 1 }, 'team1') }), idFor)
    expect(e).toMatchObject({ id: 's.0.1', prevId: 's.0.0', bucket: 'cpu:hard', outcome: 'W', gf: 3, ga: 1, shootout: false })
    const flipped = matchEntry(state({ aiTeam: 'team1', matchResult: result({ team1: 3, team2: 1 }, 'team1') }), idFor)
    expect(flipped).toMatchObject({ outcome: 'L', gf: 1, ga: 3 })
  })

  it('online: host and guest each see their own result', () => {
    const r = result({ team1: 0, team2: 2 }, 'team2')
    expect(matchEntry(state({ gameMode: 'online', onlineMyTeam: 'team1', matchResult: r }), idFor)).toMatchObject({ bucket: 'online', outcome: 'L', gf: 0, ga: 2 })
    expect(matchEntry(state({ gameMode: 'online', onlineMyTeam: 'team2', matchResult: r }), idFor)).toMatchObject({ bucket: 'online', outcome: 'W', gf: 2, ga: 0 })
  })

  it('draws, local matches and shootouts', () => {
    expect(matchEntry(state({ matchResult: result({ team1: 1, team2: 1 }, null) }), idFor).outcome).toBe('D')
    expect(matchEntry(state({ gameMode: 'local', matchResult: result({ team1: 1, team2: 0 }, 'team1') }), idFor)).toMatchObject({ bucket: 'local', gf: 0, ga: 0 })
    const pens = matchEntry(state({ matchResult: result({ team1: 1, team2: 1 }, 'team1', { penaltyScore: { team1: 3, team2: 2 } }) }), idFor)
    expect(pens).toMatchObject({ outcome: 'W', shootout: true })
  })

  it('ignores missing, stale or unknown results', () => {
    const r = result({ team1: 1, team2: 0 }, 'team1')
    expect(matchEntry(state({ matchResult: null }), idFor)).toBeNull()
    expect(matchEntry(state({ screen: 'TEAM_SELECT', matchResult: r }), idFor)).toBeNull() // host's old result arriving in setup
    expect(matchEntry(state({ gameMode: 'online', onlineMyTeam: null, matchResult: r }), idFor)).toBeNull()
    expect(matchEntry(state({ aiDifficulty: 'impossible', matchResult: r }), idFor)).toBeNull()
  })
})

describe('applyMatch', () => {
  const entry = (over) => ({ id: 'a', prevId: 'z', bucket: 'cpu:hard', outcome: 'W', gf: 3, ga: 1, shootout: false, ...over })

  it('counts a match once per id', () => {
    const once = applyMatch(emptyRecords(), entry())
    expect(once.changed).toBe(true)
    expect(once.records.cpu.hard).toEqual({ w: 1, d: 0, l: 0, gf: 3, ga: 1 })
    const twice = applyMatch(once.records, entry())
    expect(twice.changed).toBe(false)
    expect(twice.records.cpu.hard.w).toBe(1)
  })

  it('does not mutate its input', () => {
    const before = emptyRecords()
    applyMatch(before, entry())
    expect(before).toEqual(emptyRecords())
  })

  it('tracks W/D/L and goals per bucket', () => {
    let r = emptyRecords()
    r = applyMatch(r, entry({ id: '1' })).records
    r = applyMatch(r, entry({ id: '2', outcome: 'D', gf: 2, ga: 2 })).records
    r = applyMatch(r, entry({ id: '3', outcome: 'L', gf: 0, ga: 4 })).records
    r = applyMatch(r, entry({ id: '4', bucket: 'online', outcome: 'L', gf: 1, ga: 2 })).records
    r = applyMatch(r, entry({ id: '5', bucket: 'local', gf: 0, ga: 0 })).records
    expect(r.cpu.hard).toEqual({ w: 1, d: 1, l: 1, gf: 5, ga: 7 })
    expect(r.cpu.easy).toEqual({ w: 0, d: 0, l: 0, gf: 0, ga: 0 })
    expect(r.online).toMatchObject({ w: 0, l: 1 })
    expect(r.local.played).toBe(1)
  })

  it('reports new bests', () => {
    let res = applyMatch(emptyRecords(), entry({ id: '1', gf: 3, ga: 1 }))
    expect(res.newBests).toEqual(['biggestWin', 'mostGoals'])
    res = applyMatch(res.records, entry({ id: '2', gf: 2, ga: 1 }))
    expect(res.newBests).toEqual([])
    res = applyMatch(res.records, entry({ id: '3', outcome: 'L', gf: 4, ga: 5 }))
    expect(res.newBests).toEqual(['mostGoals'])
    expect(res.records.bests).toEqual({ biggestWin: 2, mostGoals: 4, shootoutsWon: 0 })
  })

  it('a shootout after a draw decides that match', () => {
    const draw = applyMatch(emptyRecords(), entry({ id: 'k1', outcome: 'D', gf: 1, ga: 1 })).records
    expect(draw.cpu.hard).toMatchObject({ w: 0, d: 1, l: 0 })
    const won = applyMatch(draw, entry({ id: 'k2', prevId: 'k1', outcome: 'W', gf: 1, ga: 1, shootout: true }))
    expect(won.records.cpu.hard).toEqual({ w: 1, d: 0, l: 0, gf: 1, ga: 1 })
    expect(won.records.bests.shootoutsWon).toBe(1)
    expect(won.newBests).toEqual(['shootoutWon'])

    const lost = applyMatch(draw, entry({ id: 'k2', prevId: 'k1', outcome: 'L', gf: 1, ga: 1, shootout: true })).records
    expect(lost.cpu.hard).toEqual({ w: 0, d: 0, l: 1, gf: 1, ga: 1 })
    expect(lost.bests.shootoutsWon).toBe(0)
  })

  it('a local shootout does not count the match twice', () => {
    const draw = applyMatch(emptyRecords(), entry({ id: 'k1', bucket: 'local', outcome: 'D' })).records
    const pens = applyMatch(draw, entry({ id: 'k2', prevId: 'k1', bucket: 'local', outcome: 'W', shootout: true })).records
    expect(pens.local.played).toBe(1)
  })

  it('a shootout without its recorded draw counts as a new match', () => {
    const r = applyMatch(emptyRecords(), entry({ id: 'k2', prevId: 'k1', outcome: 'W', gf: 0, ga: 0, shootout: true })).records
    expect(r.cpu.hard).toEqual({ w: 1, d: 0, l: 0, gf: 0, ga: 0 })
  })

  it('rejects malformed entries', () => {
    expect(applyMatch(emptyRecords(), entry({ bucket: 'cpu:godlike' })).changed).toBe(false)
    expect(applyMatch(emptyRecords(), entry({ outcome: 'X' })).changed).toBe(false)
    expect(applyMatch(emptyRecords(), null).changed).toBe(false)
  })
})

describe('sanitizeRecords / resetRecords / recordLine', () => {
  it('drops bad counts and unknown keys', () => {
    const r = sanitizeRecords({
      cpu: { hard: { w: 4, d: -1, l: 'x', gf: 1.5, ga: 2 }, impossible: { w: 9 } },
      online: [],
      local: { played: 3 },
      bests: { biggestWin: 1e20, mostGoals: NaN },
      last: { id: 5, bucket: 'online', outcome: 'W' },
    })
    expect(r.cpu.hard).toEqual({ w: 4, d: 0, l: 0, gf: 0, ga: 2 })
    expect(r.cpu.impossible).toBeUndefined()
    expect(r.online).toEqual({ w: 0, d: 0, l: 0, gf: 0, ga: 0 })
    expect(r.local.played).toBe(3)
    expect(r.bests).toEqual({ biggestWin: 1e9, mostGoals: 0, shootoutsWon: 0 })
    expect(r.last).toBeNull()
  })

  it('reset clears stats but keeps the last match id so it is not recounted', () => {
    const r = applyMatch(emptyRecords(), { id: 'a', prevId: 'z', bucket: 'online', outcome: 'W', gf: 1, ga: 0, shootout: false }).records
    const cleared = resetRecords(r)
    expect(cleared.online.w).toBe(0)
    expect(applyMatch(cleared, { id: 'a', prevId: 'z', bucket: 'online', outcome: 'W', gf: 1, ga: 0, shootout: false }).changed).toBe(false)
  })

  it('formats the match-end line', () => {
    const r = emptyRecords()
    r.cpu.hard = { w: 4, d: 1, l: 2, gf: 0, ga: 0 }
    r.online = { w: 3, d: 0, l: 2, gf: 0, ga: 0 }
    r.local.played = 7
    expect(recordLine(r, { gameMode: 'ai', aiDifficulty: 'hard' })).toBe('Your record vs Hard CPU: 4W 1D 2L')
    expect(recordLine(r, { gameMode: 'online' })).toBe('Online: 3W 2L')
    expect(recordLine(r, { gameMode: 'local' })).toBe('Local matches played: 7')
  })
})
