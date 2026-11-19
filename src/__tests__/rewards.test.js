import { describe, it, expect } from 'vitest'
import { claimDaily, dailyStatus, DAILY_REWARDS, weekGoals, weekProgress, noteWeek, weekCap, nextMysteryCap, MYSTERY_CAPS, weekKey } from '../game/rewards'

describe('daily reward', () => {
  it('pays once a day and moves to the next day', () => {
    const a = claimDaily(null, '2026-11-18')
    expect(a.day).toBe(0)
    expect(a.reward).toEqual(DAILY_REWARDS[0])
    expect(claimDaily(a.daily, '2026-11-18')).toBeNull()
    expect(dailyStatus(a.daily, '2026-11-18').ready).toBe(false)
    const b = claimDaily(a.daily, '2026-11-19')
    expect(b.day).toBe(1)
  })
  it('a missed day pauses the run, it never resets', () => {
    let d = claimDaily(null, '2026-11-01').daily
    d = claimDaily(d, '2026-11-02').daily
    const later = claimDaily(d, '2026-11-09') // a week away
    expect(later.day).toBe(2)
  })
  it('after day 7 it starts again', () => {
    let d = null
    for (let i = 0; i < 7; i++) d = claimDaily(d, `2026-11-${10 + i}`).daily
    expect(claimDaily(d, '2026-11-20').day).toBe(0)
  })
})

describe('weekly goals', () => {
  const key = '2026-W47'
  it('three goals a week: the same for everyone, different weeks differ', () => {
    expect(weekGoals(key)).toHaveLength(3)
    expect(weekGoals(key).map((g) => g.id)).toEqual(weekGoals(key).map((g) => g.id))
    const weeks = new Set(['2026-W45', '2026-W46', '2026-W47', '2026-W48'].map((k) => weekGoals(k).map((g) => g.id).join()))
    expect(weeks.size).toBeGreaterThan(1)
  })
  it('counts matches, finishes goals once, and all three earn the cap', () => {
    const goals = weekGoals(key)
    let week = null
    let all = false
    const finished = []
    // Plenty of big wins with saves and posts: every match-based goal fills up
    for (let i = 0; i < 10; i++) {
      const r = noteWeek(week, key, { won: true, gf: 4, ga: 0, mode: 'career', level: 'hard', saves: 2, posts: 1 })
      week = r.week
      finished.push(...r.finished.map((g) => g.id))
      all = all || r.allDone
    }
    for (let i = 0; i < 2; i++) {
      const r = noteWeek(week, key, { mode: 'daily', won: true, gf: 0, ga: 0 })
      week = r.week
      finished.push(...r.finished.map((g) => g.id))
      all = all || r.allDone
    }
    expect(new Set(finished).size).toBe(finished.length) // each goal finishes once
    expect(weekProgress(week, key).every((g) => g.done)).toBe(true)
    expect(all).toBe(true)
    expect(goals.map((g) => g.id).sort()).toEqual([...finished].sort())
  })
  it('the daily challenge only counts for its own goal', () => {
    const k = ['2026-W40', '2026-W41', '2026-W42', '2026-W43', '2026-W44', '2026-W45'].find((w) => weekGoals(w).some((g) => g.daily))
    const r = noteWeek(null, k, { mode: 'daily', won: true, gf: 0, ga: 0 })
    for (const g of weekProgress(r.week, k)) expect(g.have).toBe(g.daily ? 1 : 0)
  })
  it('a new week starts from zero', () => {
    const r = noteWeek(null, key, { won: true, gf: 3, ga: 0, mode: 'quick' })
    expect(weekProgress(r.week, '2026-W48').every((g) => g.have === 0)).toBe(true)
  })
  it('week keys start on Monday', () => {
    expect(weekKey(new Date(2026, 10, 16))).toBe(weekKey(new Date(2026, 10, 22)))
    expect(weekKey(new Date(2026, 10, 22))).not.toBe(weekKey(new Date(2026, 10, 23)))
  })
})

describe('caps', () => {
  it('a weekly cap for every week, mystery caps in order', () => {
    expect(weekCap('2026-W47').key).toMatch(/^week-/)
    expect(nextMysteryCap([]).key).toBe(MYSTERY_CAPS[0].key)
    expect(nextMysteryCap([MYSTERY_CAPS[0].key]).key).toBe(MYSTERY_CAPS[1].key)
    expect(nextMysteryCap(MYSTERY_CAPS.map((c) => c.key))).toBeNull()
  })
})
