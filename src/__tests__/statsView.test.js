import { describe, it, expect } from 'vitest'
import { dayView, timeline, change, finishRate, headlines } from '../admin/statsView'

const day = (d, players, counts) => ({ day: d, players, counts })
const sample = [
  day('2026-11-23', 40, { open: 30, 'match_start:career': 20, 'match_end:career': 18, 'match_start:tournament_computer': 6, 'match_end:tournament_computer': 3, 'match_start:local': 8, 'match_end:local': 1, 'match_quit:local_1m': 2, 'match_quit:tournament_computer_6m': 1, 'pitch_lost:shown': 1, 'pitch_lost:hidden': 2, 'error:quick_not_available': 1, 'board:top_50': 9 }),
  day('2026-11-22', 107, { 'match_start:career': 163, 'match_end:career': 132, 'match_start:daily': 54, 'match_end:daily': 50, pitch_lost: 2 }),
]

describe('HQ stats', () => {
  it('sums a day by mode, with quits, pitch drops and errors', () => {
    const v = dayView(sample[0])
    expect(v.byMode.career).toMatchObject({ started: 20, finished: 18 })
    expect(v.byMode.tournament).toMatchObject({ started: 6, finished: 3 })
    expect(v.byMode.local.quits['1m']).toBe(2)
    expect(v.byMode.tournament.quits['6m']).toBe(1)
    expect(v.pitch).toMatchObject({ lost: 3, shown: 1, hidden: 2 })
    expect(v.errors.quick_not_available).toBe(1)
    expect(v.started).toBe(34)
    expect(v.board).toBe(9)
  })
  it('orders days oldest first; works out changes and finish rates', () => {
    expect(timeline(sample).map((d) => d.day)).toEqual(['2026-11-22', '2026-11-23'])
    expect(change(120, 100)).toBe(20)
    expect(change(5, 0)).toBeNull()
    expect(finishRate(10, 12)).toBe(100)
    expect(finishRate(0, 0)).toBeNull()
  })
  it('reads the latest day in plain words', () => {
    const notes = headlines(timeline(sample), new Date('2026-11-23T12:00:00Z')).map((n) => n.text)
    expect(notes.join(' ')).toMatch(/On pace for about 80 players/)
    expect(notes.join(' ')).toMatch(/Career is the most played/)
    expect(notes.join(' ')).toMatch(/Two players: only 13%/)
    expect(notes.join(' ')).toMatch(/dropped 1 time/)
  })
})

describe('closed by stage', async () => {
  const { dayView, closedByStage } = await import('../admin/statsView')
  it('counts matches that went off screen and never came back, by stage', () => {
    const d = dayView({ day: '2026-11-24', counts: { 'match_hidden:computer_loading': 3, 'match_hidden:career_first_turn': 2, 'match_back:career_first_turn': 1, 'match_hidden:tournament_computer_1m': 1, 'pitch_stall:turned': 2 } })
    expect(closedByStage([d])).toEqual([3, 1, 0, 1, 0, 0])
    expect(d.pitch.stall).toBe(2)
  })
})

describe('more of what we count', async () => {
  const { dayView, allCounts } = await import('../admin/statsView')
  it('reads online searches, the shop and features', () => {
    const d = dayView({ day: '2026-11-24', counts: { find: 5, find_ok: 1, 'shop:open': 4, 'shop:try_cap_danfo': 2, 'shop:buy_cap_danfo': 1, 'feature:chip': 7, 'feature:daily_won': 2, open: 9 } })
    expect(d.find).toEqual({ tries: 5, found: 1, paired: 0, cancelled: 0 })
    expect(d.shop).toEqual({ open: 4, tries: 2, bought: 1, pending: 0, items: { cap_danfo: 1 } })
    expect(d.feature).toEqual({ chip: 7, daily_won: 2 })
    expect(allCounts([d])[0]).toEqual({ key: 'open', total: 9, today: 9 })
  })
})
