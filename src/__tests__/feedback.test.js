import { describe, it, expect } from 'vitest'
import { cleanFeedback, saveFeedback, readFeedback } from '../../server/feedback.js'

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
const NOW = Date.UTC(2026, 10, 23, 15)

describe('player feedback', () => {
  it('keeps only what it should', () => {
    expect(cleanFeedback({ mood: 'nope' })).toBeNull()
    expect(cleanFeedback({ mood: 'meh', about: ['controls', 'controls', 'hack'], text: '  aim is hard\u0007 ', from: 'lagos' }))
      .toEqual({ mood: 'meh', about: ['controls'], text: 'aim is hard', from: 'lagos' })
    expect(cleanFeedback({ mood: 'ok', text: 'x'.repeat(900) }).text.length).toBe(500)
  })
  it('stores it by day, newest first, with no sender kept', async () => {
    const saves = memorySaves()
    await saveFeedback(saves, { mood: 'love', text: 'great' }, '1.2.3.4', NOW)
    await saveFeedback(saves, { mood: 'meh', about: ['slow'] }, '5.6.7.8', NOW + 1000)
    const items = await readFeedback(saves, 3, NOW + 2000)
    expect(items.map((x) => x.mood)).toEqual(['meh', 'love'])
    expect(JSON.stringify([...saves.rows.values()])).not.toContain('1.2.3.4')
  })
  it('lets one sender send five a day', async () => {
    const saves = memorySaves()
    for (let i = 0; i < 5; i++) expect(await saveFeedback(saves, { mood: 'ok' }, 'same', NOW)).toBe(true)
    expect(await saveFeedback(saves, { mood: 'ok' }, 'same', NOW)).toBe(false)
    expect(await saveFeedback(saves, { mood: 'ok' }, 'other', NOW)).toBe(true)
  })
})
