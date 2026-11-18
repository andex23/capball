import { describe, it, expect } from 'vitest'
import { inboxItems, unreadCount, whenLabel } from '../game/inbox'
import { UPDATES } from '../data/updates'

describe("what's new (the bell)", () => {
  const updates = [
    { id: 'b', date: '2026-11-18', icon: 'ball', title: 'B', text: 'b' },
    { id: 'a', date: '2026-11-01', icon: 'ball', title: 'A', text: 'a' },
  ]
  it('lists updates, badges, the daily challenge and the next career match, newest first', () => {
    const items = inboxItems({
      updates, earned: { clean_sheet: '2026-11-10T09:00:00Z' },
      daily: { ready: true, day: '2026-11-18', streak: 3 }, career: { key: '1:league:L4', text: 'SOJ v Fizzy', date: '2026-11-17' },
    })
    expect(items.map((i) => i.kind)).toEqual(['update', 'daily', 'career', 'achievement', 'update'])
    expect(items.find((i) => i.kind === 'daily').text).toContain('3 days')
    expect(unreadCount(items)).toBe(5)
  })
  it('counts only what has not been seen', () => {
    const items = inboxItems({ updates, seen: ['update:a', 'update:b'], earned: { first_win: '2026-11-18T00:00:00Z' } })
    expect(unreadCount(items)).toBe(1)
    expect(items.find((i) => i.unread).id).toBe('badge:first_win')
  })
  it('a new day brings a new daily item; the next career match is its own item', () => {
    const one = inboxItems({ updates: [], daily: { ready: true, day: '2026-11-18' }, seen: ['daily:2026-11-17'] })
    expect(unreadCount(one)).toBe(1)
    const two = inboxItems({ updates: [], career: { key: '1:league:L5', text: 'x' }, seen: ['career:1:league:L4'] })
    expect(unreadCount(two)).toBe(1)
  })
  it('every update has a unique id, a date and words', () => {
    expect(new Set(UPDATES.map((u) => u.id)).size).toBe(UPDATES.length)
    for (const u of UPDATES) { expect(u.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(u.title).toBeTruthy(); expect(u.text).toBeTruthy() }
  })
  it('says when, simply', () => {
    expect(whenLabel('2026-11-18', '2026-11-18')).toBe('Today')
    expect(whenLabel('2026-11-17', '2026-11-18')).toBe('Yesterday')
    expect(whenLabel('2026-11-15', '2026-11-18')).toBe('3 days ago')
    expect(whenLabel('2026-11-09', '2026-11-18')).toBe('Last week')
  })
})
