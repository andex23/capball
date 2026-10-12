import { describe, it, expect } from 'vitest'
import { newCareer, finishSeason, nextMatch, recordCareerResult, seasonOver, sanitizeCareer, ME } from '../game/career'
import { allSlots, transferWindow } from '../game/transfers'
import {
  contractOf, renewContract, renewTerms, afterMatch, matchAttrs, fitnessOf, unhappyAfterSeason, inboxOffers, rejectOffer,
  repAfterSeason, scoutPlayer, isScouted, roughPotential, seasonAwards, hallEntry, sanitizeHall, contractFor,
} from '../game/clubLife'
import { searchMarket, willingness, locate } from '../game/world'
import { wageOf } from '../game/club'

const club = { name: 'Life FC', primary: '#123456', edge: '#ffffff' }
const playSeason = (c, win = true) => {
  while (!seasonOver(c.league)) {
    const f = nextMatch(c.league)
    if (!f) break
    c = recordCareerResult(c, f.id, (f.home === ME) === win ? { home: 2, away: 0 } : { home: 0, away: 2 })
  }
  return { ...c, cup: null }
}
const setAll = (c, patch) => ({
  ...c,
  squad: Object.fromEntries(Object.entries(c.squad).map(([r, p]) => [r, { ...p, ...patch(p) }])),
  bench: c.bench.map((p) => ({ ...p, ...patch(p) })),
})

describe('contracts', () => {
  it('every player starts with a contract, and it runs down each summer', () => {
    const c = setAll(newCareer(club, { now: 1 }), () => ({ contract: 3 }))
    expect(allSlots(newCareer(club, { now: 1 })).every(({ player }) => player.contract >= 1 && player.contract <= 3)).toBe(true)
    const next = finishSeason(playSeason(c))
    expect(allSlots(next).every(({ player }) => player.contract === 2 || player.youth)).toBe(true)
  })

  it('an expiring player leaves on a free; the reserves fill his place', () => {
    let c = setAll(newCareer(club, { now: 2 }), () => ({ contract: 3 }))
    const gone = c.squad.atk1
    c = { ...c, squad: { ...c.squad, atk1: { ...gone, contract: 1 } } }
    const next = finishSeason(playSeason(c))
    expect(allSlots(next).some(({ player }) => player.id === gone.id)).toBe(false)
    expect(next.squad.atk1).toBeTruthy()
    expect(next.lastSummer.left).toContain(gone.name)
    expect(locate(next.world, gone.id)?.club).toBeNull() // a free agent now
  })

  it('renewing costs a pay rise and adds seasons; an unhappy player refuses', () => {
    const c = newCareer(club, { now: 3 })
    const p = c.squad.mid
    const renewed = renewContract(c, 'mid')
    expect(renewed.squad.mid.contract).toBe(contractFor(p.age))
    expect(renewed.squad.mid.wageX).toBeGreaterThan(1)
    expect(wageOf(renewed.squad.mid)).toBeGreaterThanOrEqual(wageOf(p))
    const sad = { ...c, squad: { ...c.squad, mid: { ...p, wantsAway: true } } }
    expect(renewTerms(sad, sad.squad.mid).ok).toBe(false)
    expect(renewContract(sad, 'mid').error).toBeTruthy()
  })
})

describe('fitness (no injuries)', () => {
  it('playing tires a player, resting restores him, and tired players play weaker', () => {
    const c = newCareer(club, { now: 4 })
    const ids = Object.values(c.squad).map((p) => p.id)
    let t = afterMatch(c, ids)
    t = afterMatch(t, ids)
    expect(fitnessOf(t.squad.atk1)).toBe(72)
    expect(fitnessOf(t.bench[0])).toBe(100)
    expect(matchAttrs(t.squad.atk1).pwr).toBeLessThan(t.squad.atk1.attrs.pwr)
    t = afterMatch(t, [])
    expect(fitnessOf(t.squad.atk1)).toBe(92)
    expect(JSON.stringify(t)).not.toContain('injury')
  })
})

describe('morale, offers and reputation', () => {
  it('a good player who never plays wants to leave', () => {
    const c = newCareer(club, { now: 5 })
    const star = { ...c.bench[3], attrs: { pwr: 80, sht: 80, pas: 70, phy: 70 }, rating: 78, apps: 0, age: 25 }
    const withStar = { ...c, bench: c.bench.map((p, i) => (i === 3 ? star : p)) }
    expect(unhappyAfterSeason(withStar, 0).has(star.id)).toBe(true)
    expect(unhappyAfterSeason({ ...withStar, bench: withStar.bench.map((p, i) => (i === 3 ? { ...p, apps: 9 } : p)) }, 3).has(star.id)).toBe(false)
  })

  it('clubs bid for your best players in a window; a rejected offer stays down', () => {
    const c = newCareer(club, { now: 6 })
    const star = { ...c.squad.atk1, attrs: { pwr: 78, sht: 80, pas: 66, phy: 60 }, rating: 77, age: 24 }
    const withStar = { ...c, squad: { ...c.squad, atk1: star } }
    expect(transferWindow(withStar)).toBeTruthy()
    // Offers vary by career; across a few, the star draws a bid
    const careers = Array.from({ length: 10 }, (_, i) => ({ ...withStar, league: { ...withStar.league, id: `L${i}` } }))
    const wanted = careers.find((x) => inboxOffers(x).some((o) => o.player.id === star.id))
    expect(wanted).toBeTruthy()
    expect(inboxOffers(rejectOffer(wanted, star.id)).some((o) => o.player.id === star.id)).toBe(false)
  })

  it('winning builds your name, which makes players less reluctant to drop down', () => {
    expect(repAfterSeason(10, { outcome: 'promoted', met: true })).toBe(30)
    expect(repAfterSeason(10, { outcome: 'stayed', met: false })).toBe(0)
    const w = newCareer(club, { now: 7 }).world
    const r = searchMarket(w, { level: 3 }, 0)[0]
    expect(willingness(r.player, r.club, 0, 90).premium).toBeLessThan(willingness(r.player, r.club, 0, 0).premium)
  })
})

describe('scouting and awards', () => {
  it('potential is a rough guess until you pay to scout him', () => {
    const c = newCareer(club, { now: 8 })
    const r = searchMarket(c.world, { maxAge: 19 }, 0)[0]
    const [lo, hi] = roughPotential(r.player).split('–').map(Number)
    expect(hi - lo).toBeGreaterThanOrEqual(8)
    expect(r.player.pot).toBeGreaterThanOrEqual(lo)
    expect(r.player.pot).toBeLessThanOrEqual(hi)
    const scouted = scoutPlayer(c, r.player.id)
    expect(isScouted(scouted, r.player.id)).toBe(true)
    expect(scouted.coins).toBeLessThan(c.coins)
    expect(scoutPlayer({ ...c, coins: 0 }, r.player.id).error).toBeTruthy()
  })

  it('a season hands out awards and a finished career goes in the Hall of Fame', () => {
    let c = newCareer(club, { now: 9 })
    c = { ...c, squad: { ...c.squad, atk1: { ...c.squad.atk1, apps: 10, goals: 9, ratingSum: 80, age: 20 } } }
    const a = seasonAwards(c)
    expect(a.boot.name).toBe(c.squad.atk1.name)
    expect(a.pots.name).toBe(c.squad.atk1.name)
    expect(a.young.name).toBe(c.squad.atk1.name)
    const next = finishSeason(setAll(playSeason(c), () => ({ contract: 3 })))
    expect(next.past[0].awards.boot).toBeTruthy()
    expect(sanitizeCareer(JSON.parse(JSON.stringify(next)))).toEqual(next)
    const h = hallEntry(next, 'retired', 0)
    expect(sanitizeHall([h])).toEqual([h])
  })
})

it('contracts tick on players you keep', () => {
  expect(contractOf({})).toBe(2)
})
