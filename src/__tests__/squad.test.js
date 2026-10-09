import { describe, it, expect } from 'vitest'
import { flickScale, priceOf, sellValue, startingSquad, signPlayer, coinsForResult, openWindow, marketFor, sanitizeSquad, clubRatings, squadRatings, averageRating, START_COINS } from '../game/squad'
import { newCareer, transferWindow, buyPlayer, recordCareerResult, finishSeason, nextMatch, sanitizeCareer, seasonOver, playedThisSeason, ME } from '../game/career'

const club = { name: 'Test FC', primary: '#123456', edge: '#FFFFFF' }

describe('squad', () => {
  it('flick power scales with rating around an average player', () => {
    expect(flickScale(50)).toBeCloseTo(1, 1)
    expect(flickScale(1)).toBeCloseTo(0.88, 2)
    expect(flickScale(99)).toBeCloseTo(1.12, 2)
    expect(flickScale(undefined)).toBe(1)
  })

  it('prices rise with rating and selling returns less than buying', () => {
    expect(priceOf(70)).toBeGreaterThan(priceOf(50))
    expect(sellValue(60)).toBeLessThan(priceOf(60))
  })

  it('a starting squad has six players and a keeper in goal', () => {
    const s = startingSquad('x')
    expect(Object.keys(s)).toHaveLength(6)
    expect(s.gk.keeper).toBe(true)
    expect(s.atk1.keeper).toBe(false)
  })

  it('signing swaps the player, charges the fee and refunds the sale', () => {
    const s = startingSquad('x')
    const player = { id: 'p1', name: 'New Guy', keeper: false, rating: 55 }
    const deal = signPlayer(s, 1000, player, 'atk1')
    expect(deal.squad.atk1.name).toBe('New Guy')
    expect(deal.coins).toBe(1000 - priceOf(55) + sellValue(s.atk1.rating))
    expect(signPlayer(s, 0, player, 'atk1')).toBeNull()       // can't afford
    expect(signPlayer(s, 1000, player, 'gk')).toBeNull()      // outfielder in goal
  })

  it('results pay coins', () => {
    expect(coinsForResult(2, 0)).toBe(70)
    expect(coinsForResult(1, 1)).toBe(30)
    expect(coinsForResult(0, 3)).toBe(10)
  })

  it('windows open pre-season and after matchday 3', () => {
    expect(openWindow(0)).toBe(0)
    expect(openWindow(3)).toBe(1)
    expect(openWindow(1)).toBe(-1)
  })

  it('the market is the same for a reload and drops signed players', () => {
    const a = marketFor({ season: 1, level: 0, windowIndex: 0, seed: 's' })
    const b = marketFor({ season: 1, level: 0, windowIndex: 0, seed: 's' })
    expect(a).toEqual(b)
    expect(a.some((p) => p.keeper)).toBe(true)
    expect(marketFor({ season: 1, level: 0, windowIndex: 0, seed: 's', taken: [a[0].id] })).toHaveLength(a.length - 1)
  })

  it('computer clubs get stronger up the divisions', () => {
    expect(averageRating(clubRatings(3, 'Royal Crowns'))).toBeGreaterThan(averageRating(clubRatings(0, 'Bottle Rockets')) + 20)
    expect(clubRatings(1, 'Tin Town')).toEqual(clubRatings(1, 'Tin Town'))
  })

  it('sanitizeSquad repairs junk', () => {
    const s = sanitizeSquad({ gk: { name: 'Ok', rating: 300 }, def1: 'junk' })
    expect(s.gk.rating).toBe(99)
    expect(s.def1.name).toBeTruthy()
    expect(Object.keys(squadRatings(s))).toHaveLength(6)
  })
})

describe('career transfers', () => {
  it('a new career has a squad, coins and an open pre-season window', () => {
    const c = newCareer(club, { now: 1 })
    expect(c.coins).toBe(START_COINS)
    expect(transferWindow(c).index).toBe(0)
  })

  it('buying from the window spends coins and removes the player from the market', () => {
    const c = newCareer(club, { now: 1 })
    const w = transferWindow(c)
    const cheapest = [...w.market].filter((p) => !p.keeper).sort((a, b) => a.rating - b.rating)[0]
    const next = buyPlayer(c, cheapest.id, 'mid')
    expect(next.squad.mid.id).toBe(cheapest.id)
    expect(next.coins).toBeLessThan(c.coins)
    expect(transferWindow(next).market.find((p) => p.id === cheapest.id)).toBeUndefined()
    expect(buyPlayer(next, cheapest.id, 'mid')).toBeNull()
  })

  it('results earn coins; the window shuts after matchday 1 and reopens after matchday 3', () => {
    let c = newCareer(club, { now: 1 })
    const start = c.coins
    const play = () => {
      const f = nextMatch(c.league)
      c = recordCareerResult(c, f.id, f.home === ME ? { home: 2, away: 0 } : { home: 0, away: 2 })
    }
    play()
    expect(c.coins).toBe(start + 70)
    expect(transferWindow(c)).toBeNull()
    play(); play()
    expect(playedThisSeason(c.league)).toBe(3)
    expect(transferWindow(c).index).toBe(1)
    while (!seasonOver(c.league)) play()
    const before = c.coins
    const after = finishSeason(c)
    expect(after.coins).toBeGreaterThan(before)
    expect(transferWindow(after).index).toBe(0)
  })

  it('old saved careers load with a squad and coins', () => {
    const c = newCareer(club, { now: 1 })
    const { squad, coins, signed, ...old } = c
    void squad; void coins; void signed
    const loaded = sanitizeCareer(JSON.parse(JSON.stringify(old)))
    expect(loaded.coins).toBe(START_COINS)
    expect(Object.keys(loaded.squad)).toHaveLength(6)
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c))).squad).toEqual(c.squad)
  })
})
