import { describe, it, expect } from 'vitest'
import { flickScale, priceOf, sellValue, startingSquad, coinsForResult, openWindow, sanitizeSquad, clubRatings, squadRatings, averageRating, START_COINS } from '../game/squad'
import { newCareer, transferWindow, recordCareerResult, finishSeason, nextMatch, sanitizeCareer, seasonOver, playedThisSeason, ME } from '../game/career'

const club = { name: 'Test FC', primary: '#123456', edge: '#FFFFFF' }

describe('squad', () => {
  it('flick power scales with PWR around a 70', () => {
    expect(flickScale(70)).toBeCloseTo(1, 2)
    expect(flickScale(45)).toBeCloseTo(0.88, 2)
    expect(flickScale(95)).toBeCloseTo(1.12, 2)
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

  it('results pay coins', () => {
    expect(coinsForResult(2, 0)).toBe(70)
    expect(coinsForResult(1, 1)).toBe(30)
    expect(coinsForResult(0, 3)).toBe(10)
  })

  it('windows open pre-season and after matchday 5', () => {
    expect(openWindow(0)).toBe(0)
    expect(openWindow(5)).toBe(1)
    expect(openWindow(2)).toBe(0) // still open: the pre-season window runs to matchday 3
    expect(openWindow(3)).toBe(-1)
    expect(openWindow(6)).toBe(1)
    expect(openWindow(7)).toBe(-1)
  })

  it('computer clubs get stronger up the divisions', () => {
    expect(averageRating(clubRatings(3, 'Royal Crowns'))).toBeGreaterThan(averageRating(clubRatings(0, 'Bottle Rockets')) + 20)
    expect(clubRatings(1, 'Tin Town')).toEqual(clubRatings(1, 'Tin Town'))
  })

  it('sanitizeSquad repairs junk', () => {
    const s = sanitizeSquad({ gk: { name: 'Ok', rating: 300 }, def1: 'junk' })
    expect(s.gk.rating).toBeGreaterThan(90)
    expect(s.gk.attrs).toBeTruthy()
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

  it('buying from the market spends coins and takes the player out of the world', async () => {
    const { makeBid } = await import('../game/transfers')
    const { searchMarket, locate } = await import('../game/world')
    const c = newCareer(club, { now: 1 })
    const target = searchMarket(c.world, { sort: 'price' }, 0).find((r) => r.club && !r.willing.reluctant && r.asking <= c.coins)
    const { career: next, result } = makeBid(c, target.player.id, target.asking)
    expect(result.verdict).toBe('accept')
    expect(next.reserves.at(-1).id).toBe(target.player.id)
    expect(next.coins).toBe(c.coins - target.asking)
    expect(locate(next.world, target.player.id)).toBeNull()
  })

  it('results earn coins; the window shuts at matchday 3 and reopens after matchday 5', () => {
    let c = newCareer(club, { now: 1 })
    const start = c.coins
    const play = () => {
      const f = nextMatch(c.league)
      c = recordCareerResult(c, f.id, f.home === ME ? { home: 2, away: 0 } : { home: 0, away: 2 })
    }
    play()
    expect(c.biz.ledger.prize).toBe(70)            // the win's prize money
    expect(c.coins).toBe(start + c.lastEarned)      // plus tickets/sponsor, less wages
    expect(transferWindow(c).index).toBe(0)        // still open after matchday 1
    play(); play()
    expect(transferWindow(c)).toBeNull()
    play(); play()
    expect(playedThisSeason(c.league)).toBe(5)
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

describe('match ratings and growth', () => {
  it('scorers, keepers with saves and clean sheets rate well; Man of the Match is the best', async () => {
    const { matchRatings, manOfTheMatch } = await import('../game/squad')
    const r = matchRatings({
      side: 'team1', score: { team1: 2, team2: 0 },
      goalLog: [{ team: 'team1', cap: 'team1_atk1' }, { team: 'team1', cap: 'team1_atk1' }],
      matchEvents: [{ type: 'save', cap: 'team2_atk1', by: 'team1_gk' }],
    })
    expect(r.atk1).toBeGreaterThan(8)
    expect(r.gk).toBeGreaterThan(r.mid)
    expect(manOfTheMatch(r, { atk1: 2 })).toBe('atk1')
    const loss = matchRatings({ side: 'team1', score: { team1: 0, team2: 4 }, goalLog: [{ team: 'team2', cap: 'team1_def1', own: true }] })
    expect(loss.def1).toBeLessThan(5)
  })

  it('a match adds apps, goals and form; good games build experience until a player steps up', async () => {
    const { applyMatchToSquad, startingSquad, formOf } = await import('../game/squad')
    let squad = startingSquad('g')
    squad = { ...squad, atk1: { ...squad.atk1, age: 21, pot: squad.atk1.rating + 10 } }
    const start = squad.atk1.rating
    const r = applyMatchToSquad(squad, { ratings: { gk: 6, def1: 6, def2: 6, mid: 6.3, atk1: 9, atk2: 6 }, goalsByRole: { atk1: 2 }, seed: 's' })
    expect(r.squad.atk1).toMatchObject({ apps: 1, goals: 2 })
    expect(formOf(r.squad.atk1)).toBe(9)
    expect(r.squad.atk1.rating).toBe(start + 1) // a 9/10 game is enough for a 21-year-old under his potential
    expect(r.squad.mid.rating).toBe(squad.mid.rating) // an average game doesn't move anyone
    // ...but never past his potential
    const capped = { ...squad, atk1: { ...squad.atk1, pot: squad.atk1.rating } }
    expect(applyMatchToSquad(capped, { ratings: { atk1: 9 }, seed: 't' }).squad.atk1.rating).toBe(start)
  })
})
