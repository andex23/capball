import { describe, it, expect } from 'vitest'
import { newCareer } from '../game/career'
import { searchMarket, bidVerdict, locate } from '../game/world'
import { fitFor, offerOptions, tabRows } from '../game/marketFit'
import { ovrAt } from '../game/squad'

const club = { name: 'Market FC', primary: '#123456', edge: '#ffffff' }

describe('the market from your side', () => {
  it('compares a player with the starter he would replace (your weakest in his position)', () => {
    const c = newCareer(club, { now: 5 })
    const row = searchMarket(c.world, { pos: 'DEF', sort: 'ovr' }, c.level)[0]
    const fit = fitFor(c, row.player)
    const weakest = Math.min(ovrAt(c.squad.def1, 'def1'), ovrAt(c.squad.def2, 'def2'))
    expect(fit.mine.rating).toBe(weakest)
    expect(fit.delta).toBe(ovrAt(row.player, fit.role) - weakest)
  })

  it('"For you" only shows affordable players who would start, biggest upgrade first', () => {
    const c = newCareer(club, { now: 5 })
    const rows = tabRows(c, searchMarket(c.world, {}, c.level), 'forYou')
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.fit.delta).toBeGreaterThan(0)
      expect(r.total).toBeLessThanOrEqual(c.coins)
      expect(r.willing.premium || 1).toBeLessThanOrEqual(2) // no silly wages to drop down
    }
    const score = (r) => r.fit.delta - 6 * ((r.willing.premium || 1) - 1)
    for (let i = 1; i < rows.length; i++) expect(score(rows[i - 1])).toBeGreaterThanOrEqual(score(rows[i]))
    expect(tabRows(c, searchMarket(c.world, {}, c.level), 'free').every((r) => !r.club)).toBe(true)
    expect(tabRows(c, searchMarket(c.world, {}, c.level), 'young').every((r) => r.player.age <= 21)).toBe(true)
  })

  it('the three offers say honestly how likely they are', () => {
    const c = newCareer(club, { now: 5 })
    const row = searchMarket(c.world, { sort: 'ovr' }, c.level).find((r) => r.club)
    const { player, club: from } = locate(c.world, row.player.id)
    const [cheeky, fair, asking] = offerOptions(row.asking)
    let fairYes = 0
    let cheekyYes = 0
    for (let s = 0; s < 60; s++) {
      expect(bidVerdict(player, from, asking.fee, 0, `s${s}`).verdict).toBe('accept') // the asking price: always
      if (bidVerdict(player, from, fair.fee, 0, `s${s}`).verdict === 'accept') fairYes++
      if (bidVerdict(player, from, cheeky.fee, 0, `s${s}`).verdict === 'accept') cheekyYes++
    }
    expect(fairYes).toBeGreaterThan(20)   // a good chance
    expect(cheekyYes).toBeLessThan(fairYes) // a long shot
  })
})
