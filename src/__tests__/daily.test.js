import { describe, it, expect, beforeEach, vi } from 'vitest'
import { challengeFor, challengeBodies, challengeName, dayKey, previousDay, nextDay, nextStreak, weekDays, SPECIAL_NAME } from '../game/daily'
import { PITCH, CAP_RADIUS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { useMatchStore, PHASE, TIMING, clearMatchTimers } from '../state/MatchStore'

const radius = (id) => (id === 'ball' ? BALL_RADIUS : id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS)

describe('daily challenge set-ups', () => {
  it('is the same all day and changes between days', () => {
    expect(challengeFor('2026-10-09')).toEqual(challengeFor('2026-10-09'))
    const names = new Set(Array.from({ length: 30 }, (_, i) => challengeFor(dayKey(new Date(2026, 0, i + 1))).template))
    expect(names.size).toBeGreaterThan(3)
  })
  it('puts every cap and the ball on the pitch without overlaps, for a year of days', () => {
    for (let i = 0; i < 365; i++) {
      const b = challengeBodies(challengeFor(dayKey(new Date(2026, 0, i + 1))))
      const ids = Object.keys(b)
      expect(ids).toHaveLength(13)
      for (const id of ids) {
        const [x, y] = b[id]
        expect(Math.abs(x)).toBeLessThanOrEqual(PITCH.halfW - radius(id) + 0.01)
        expect(Math.abs(y)).toBeLessThanOrEqual(PITCH.halfH - radius(id) + 0.01)
      }
      for (let a = 0; a < ids.length; a++) for (let c = a + 1; c < ids.length; c++) {
        const [x1, y1] = b[ids[a]], [x2, y2] = b[ids[c]]
        expect(Math.hypot(x1 - x2, y1 - y2)).toBeGreaterThan(radius(ids[a]) + radius(ids[c]) - 0.05)
      }
    }
  })
  it('follows the week: never the same set-up two days running, harder towards Sunday', () => {
    let prev = null
    for (let i = 0; i < 365; i++) {
      const key = dayKey(new Date(2026, 0, i + 1))
      const c = challengeFor(key)
      expect(c.name).toBe(challengeName(key))
      if (prev) expect(c.name).not.toBe(prev)
      prev = c.name
    }
    // 2026-11-16 is a Monday
    expect(weekDays('2026-11-20')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
    expect(weekDays('2026-11-20').map(challengeName)).toEqual(['Free kick', 'Breakaway', 'Corner', 'Long range', 'Tight angle', 'Crowded box', SPECIAL_NAME])
    expect(challengeFor('2026-11-16').level).toBe('Easy')
    expect(nextDay('2026-11-30')).toBe('2026-12-01')
  })
  it('the Sunday Special has an extra defender and one flick fewer', () => {
    for (let w = 0; w < 52; w++) {
      const key = dayKey(new Date(2026, 0, 4 + w * 7)) // Sundays
      const c = challengeFor(key)
      expect(c).toMatchObject({ special: true, name: SPECIAL_NAME, level: 'Hardest' })
      const plain = { 'Free kick': [2, 2], Corner: [3, 2], Breakaway: [3, 2], 'Tight angle': [2, 1], 'Long range': [2, 1], 'Crowded box': [3, 4] }[c.base]
      expect(c.flicks).toBe(Math.max(1, plain[0] - 1))
      expect(Object.keys(c.theirs).length).toBe(plain[1] + 1)
    }
  })
  it('streaks build day by day and restart after a gap', () => {
    let s = { lastDone: null, streak: 0, best: 0 }
    s = nextStreak(s, '2026-10-08')
    s = nextStreak(s, '2026-10-09')
    expect(s).toMatchObject({ streak: 2, best: 2 })
    expect(nextStreak(s, '2026-10-09')).toBe(s) // twice in a day counts once
    expect(nextStreak(s, '2026-10-12')).toMatchObject({ streak: 1, best: 2 })
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
  })
})

describe('daily challenge flow', () => {
  const initial = useMatchStore.getState()
  beforeEach(() => { vi.useFakeTimers(); clearMatchTimers(); useMatchStore.setState(initial, true) })
  const get = () => useMatchStore.getState()
  const start = () => get().startChallenge({ id: 'x', name: 'Test', text: '', flicks: 2 })

  it('a wasted flick uses one up; the last one ends it', () => {
    start()
    get().switchTurn()
    expect(get()).toMatchObject({ phase: PHASE.SELECT, activeTeam: 'team1', challenge: { flicksLeft: 1 } })
    get().callFoul({ x: 0, y: 0 }, 'team2', false)
    expect(get()).toMatchObject({ phase: PHASE.CHALLENGE_DONE, challenge: { won: false } })
  })
  it('scoring wins it, after the celebration', () => {
    start()
    get().scoreGoal('team1')
    expect(get().phase).toBe(PHASE.GOAL)
    vi.advanceTimersByTime(TIMING.goal)
    expect(get()).toMatchObject({ phase: PHASE.CHALLENGE_DONE, challenge: { won: true } })
  })
  it('leaving gives the player back their own team 2 kit', () => {
    const before = get().teamConfig.team2
    start()
    expect(get().teamConfig.team2.name).toBe('Defenders')
    get().leaveChallenge()
    expect(get().teamConfig.team2).toEqual(before)
    expect(get().challenge).toBeNull()
  })
})
