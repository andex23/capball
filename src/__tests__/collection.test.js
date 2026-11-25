import { describe, it, expect } from 'vitest'
import { COLLECTION, COLLECTION_PRICES, capsForRank, capsForResults, collectionCap } from '../game/collection'
import { CAP_PRICES } from '../game/wallet'

const r = (gf, ga) => ({ gf, ga })

describe('The Collection', () => {
  it('has every cap with a way to get it', () => {
    expect(COLLECTION.length).toBe(12)
    for (const d of COLLECTION) expect(d.league || d.feat || d.price).toBeTruthy()
  })

  it('stacks league places downwards', () => {
    expect(capsForRank(1)).toEqual(expect.arrayContaining(['kingmaker', 'alaafin', 'edo-regalia', 'ife-dynasty']))
    expect(capsForRank(1)).toHaveLength(4)
    expect(capsForRank(2).sort()).toEqual(['alaafin', 'edo-regalia', 'ife-dynasty'])
    expect(capsForRank(3).sort()).toEqual(['edo-regalia', 'ife-dynasty'])
    expect(capsForRank(10)).toEqual(['ife-dynasty'])
    expect(capsForRank(11)).toEqual([])
    expect(capsForRank(0)).toEqual([])
  })

  it('gives Nok Ember for all 15 and Ukwu Gold only for unbeaten in all 15', () => {
    const fifteen = Array.from({ length: 15 }, () => r(2, 1))
    expect(capsForResults(fifteen).sort()).toEqual(['nok-ember', 'ukwu-gold'])
    expect(capsForResults([...fifteen.slice(1), r(0, 3)])).toEqual(['nok-ember'])
    expect(capsForResults([...fifteen.slice(1), r(1, 1)]).sort()).toEqual(['nok-ember', 'ukwu-gold'])
    expect(capsForResults([...fifteen.slice(1), null])).toEqual([])
  })

  it('prices the shop caps and never sells the league prizes', () => {
    expect(COLLECTION_PRICES['purple-hibiscus']).toBe(5000000)
    expect(COLLECTION_PRICES['confluence-town']).toBe(5000000)
    for (const k of ['acid-racing', 'lagos-90', 'liquid-chrome', 'midnight-club']) expect(CAP_PRICES[k]).toBe(1500000)
    for (const k of ['kingmaker', 'alaafin', 'edo-regalia', 'ife-dynasty', 'ukwu-gold', 'nok-ember']) expect(CAP_PRICES[k]).toBeUndefined()
    expect(collectionCap('kingmaker').league).toBe(1)
  })
})

describe('Weekend League payout', () => {
  it('gives the champion the stacked caps, a week of the Kingmaker and the prize, once', async () => {
    const { useRewardsStore } = await import('../state/rewardsStore')
    const s = useRewardsStore.getState()
    const now = new Date('2026-11-30T09:00:00Z')
    const caps = [...capsForRank(1), 'nok-ember']
    expect(s.leagueResult({ key: '2026-11-27', rank: 1, players: 40, pts: 41, caps, money: 110 }, now)).toBe(true)
    const after = useRewardsStore.getState()
    expect(after.caps).toEqual(expect.arrayContaining(['alaafin', 'edo-regalia', 'ife-dynasty', 'nok-ember']))
    expect(after.caps).not.toContain('kingmaker')
    expect(after.kingmakerUntil).toBe(now.getTime() + 7 * 86400000)
    expect(after.news[0].id).toBe('league:2026-11-27')
    expect(s.leagueResult({ key: '2026-11-27', rank: 1, players: 40, pts: 41, caps, money: 110 }, now)).toBe(false)
  })
})
