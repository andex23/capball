import { describe, it, expect } from 'vitest'
import { newCareer, sanitizeCareer, finishSeason, nextMatch, recordCareerResult, seasonOver, ME, MAX_SQUAD, opponentOvr, targetFor } from '../game/career'
import {
  makeBid, offersFor, sellTo, releasePlayer, releaseCost, loanOut, loanClub, promoteYouth, releaseYouth, promoteReserve,
  squadSize, squadFull, transferWindow, vacate, YOUTH_MAX,
} from '../game/transfers'
import {
  createWorld, searchMarket, locate, bestSix, clubOvr, strengthOf, worldSummer, askingPrice, willingness, sanitizeWorld,
  bidVerdict, AI_SQUAD,
} from '../game/world'
import { makeYouth, makePlayer } from '../game/squad'
import { simulateResult, createTournament, seededRng } from '../game/tournament'
import { wageBill, wageOf } from '../game/club'

const club = { name: 'Test FC', primary: '#123456', edge: '#ffffff' }
const rich = (c) => ({ ...c, coins: 1_000_000 })
const kid = (seed, pos = 'MID') => ({ ...makeYouth(seededRng(seed), 0, pos), id: seed })
const playSeason = (c) => {
  while (!seasonOver(c.league)) {
    const f = nextMatch(c.league)
    if (!f) break
    c = recordCareerResult(c, f.id, f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 })
  }
  return c
}
/** The cheapest willing player at a club in division `level`. */
const cheapAt = (c, level = 0) => searchMarket(c.world, { level, sort: 'price' }, c.level).find((r) => !r.willing.reluctant)

describe('the world', () => {
  it('every division has favourites and strugglers, with stars at the big clubs', () => {
    const w = createWorld('q')
    for (let level = 0; level < 4; level++) {
      const clubs = w.clubs.filter((c) => c.level === level)
      expect(clubs).toHaveLength(5)
      const ovr = clubs.map(clubOvr)
      expect(ovr[0]).toBeGreaterThan(ovr[4] + 6) // the favourites are much stronger than the strugglers
      for (const c of clubs) {
        expect(c.players).toHaveLength(AI_SQUAD)
        expect(Object.keys(bestSix(c.players))).toHaveLength(6)
      }
    }
    // The Premier Cap League's best are world-class; the Sunday League's worst are poor
    const prem = searchMarket(w, { level: 3 }, 3)[0].player.rating
    const sunday = searchMarket(w, { level: 0, sort: 'ovr' }, 0).at(-1).player.rating
    expect(prem).toBeGreaterThanOrEqual(88)
    expect(sunday).toBeLessThan(50)
  })

  it('stronger clubs win more simulated games', () => {
    const t = createTournament({ format: 'league', teams: [{ name: 'A', cpu: true, ovr: 75 }, { name: 'B', cpu: true, ovr: 60 }, { name: 'C', cpu: true, ovr: 60 }], now: 1 })
    const rng = seededRng('sim')
    let a = 0; let b = 0
    for (let i = 0; i < 400; i++) { const r = simulateResult(t, { home: 'T1', away: 'T2' }, rng); if (r.home > r.away) a++; if (r.away > r.home) b++ }
    expect(a).toBeGreaterThan(b * 2.5)
  })

  it('a summer moves the world on but keeps every club playable', () => {
    let w = createWorld('s')
    for (let i = 0; i < 12; i++) w = worldSummer(w, `s${i}`).world
    for (const c of w.clubs) {
      expect(c.players.length).toBeGreaterThanOrEqual(10)
      expect(c.players.filter((p) => p.pos === 'GK').length).toBeGreaterThanOrEqual(1)
      expect(Object.keys(bestSix(c.players))).toHaveLength(6)
      // Clubs stay near the level they're built for
      expect(Math.abs(clubOvr(c) - strengthOf(c))).toBeLessThan(15)
    }
    const ids = [...w.clubs.flatMap((c) => c.players), ...w.free].map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length) // nobody is in two places
    expect(sanitizeWorld(JSON.parse(JSON.stringify(w)), 'x')).toEqual(w)
  })

  it('your opponents play with their real best six', () => {
    const c = newCareer(club, { now: 2 })
    const name = c.league.teams[1].name
    expect(opponentOvr(c, name)).toBe(clubOvr(c.world.clubs.find((x) => x.name === name)))
    expect(c.league.teams[1].ovr).toBe(opponentOvr(c, name))
  })

  it('the board judges your squad against the real clubs', () => {
    const c = newCareer(club, { now: 3 })
    const stars = Object.fromEntries(Object.entries(c.squad).map(([r, p]) => [r, { ...p, attrs: { pwr: 90, sht: 90, pas: 90, phy: 90 } }]))
    expect(targetFor(0, stars, c.world)).toBe('promotion')
  })
})

describe('the transfer market', () => {
  it('searches by position, OVR, age, price and name', () => {
    const w = createWorld('m')
    const keepers = searchMarket(w, { pos: 'GK', minOvr: 70 }, 3)
    expect(keepers.length).toBeGreaterThan(0)
    expect(keepers.every((r) => r.player.pos === 'GK' && r.player.rating >= 70)).toBe(true)
    const young = searchMarket(w, { maxAge: 19, sort: 'pot' }, 0)
    expect(young.every((r) => r.player.age <= 19)).toBe(true)
    expect(young[0].player.pot).toBeGreaterThanOrEqual(young.at(-1).player.pot)
    const cheap = searchMarket(w, { maxPrice: 50, sort: 'price' }, 0)
    expect(cheap.every((r) => r.asking <= 50)).toBe(true)
    const named = searchMarket(w, { name: 'royal crowns' }, 0)
    expect(named.every((r) => r.club?.name === 'Royal Crowns')).toBe(true)
    expect(searchMarket(w, { level: 'free' }, 0).every((r) => !r.club)).toBe(true)
  })

  it('stars cost more than squad players; players from higher divisions want money to drop down', () => {
    const w = createWorld('p')
    const rc = w.clubs.find((c) => c.name === 'Royal Crowns')
    const rows = searchMarket(w, { name: 'Royal Crowns', sort: 'ovr' }, 3)
    expect(rows[0].standing).toBe('star')
    expect(rows[0].asking).toBeGreaterThan(askingPrice(rows.at(-1).player, rc))
    const star = willingness(rows[0].player, rc, 0)
    expect(star.reluctant).toBe(true)
    expect(star.premium).toBeGreaterThanOrEqual(5) // a Premier star dropping three divisions
    expect(star.bonus).toBeGreaterThan(rows[0].asking)
    expect(willingness(rows[0].player, rc, 3).reluctant).toBe(false)
    const oneDown = willingness(rows.at(-1).player, rc, 2)
    expect(oneDown.premium).toBeLessThan(star.premium)
    expect(oneDown.premium).toBeGreaterThan(1)
  })

  it('a club accepts a fair bid, counters a low one, and stops talking after three tries', () => {
    const c = rich(newCareer(club, { now: 4 }))
    const t = cheapAt(c)
    // Low: rejected or countered
    let r = makeBid(c, t.player.id, Math.round(t.asking * 0.75))
    expect(['counter', 'reject']).toContain(r.result.verdict)
    r = makeBid(r.career, t.player.id, Math.round(t.asking * 0.5))
    expect(r.result.verdict).toBe('reject')
    r = makeBid(r.career, t.player.id, Math.round(t.asking * 0.5))
    expect(r.result.verdict).toBe('reject')
    expect(r.result.ended).toBe(true)
    expect(makeBid(r.career, t.player.id, t.asking * 2).result.verdict).toBe('ended')
    // A fresh club accepts the asking price straight away
    expect(makeBid(c, t.player.id, t.asking).result.verdict).toBe('accept')
    expect(bidVerdict(t.player, t.club, t.asking, 0, 'k').verdict).toBe('accept')
  })

  it('a full squad of fifteen can’t sign anyone until a player leaves', () => {
    let c = rich(newCareer(club, { now: 5 }))
    c = { ...c, reserves: [kid('a'), kid('b'), kid('c'), kid('d'), kid('e', 'GK')] }
    expect(squadSize(c)).toBe(MAX_SQUAD)
    expect(squadFull(c)).toBe(true)
    const t = cheapAt(c)
    expect(makeBid(c, t.player.id, t.asking).result.verdict).toBe('full')
    // Release one: now there's room
    const before = c.coins
    const released = releasePlayer(c, 'reserve:0')
    expect(released.coins).toBe(before - releaseCost(c.reserves[0]))
    expect(locate(released.world, 'a')).toBeTruthy() // he's a free agent now
    expect(makeBid(released, t.player.id, t.asking).result.verdict).toBe('accept')
  })

  it('a player who drops down costs a bonus and keeps higher wages', () => {
    const c = rich(newCareer(club, { now: 13 }))
    const r = searchMarket(c.world, { level: 2, sort: 'price' }, 0)[0]
    const { career: next, result } = makeBid(c, r.player.id, r.asking)
    expect(result.verdict).toBe('accept')
    expect(next.coins).toBe(c.coins - r.asking - r.willing.bonus)
    const p = next.reserves.at(-1)
    expect(p.wageX).toBe(r.willing.premium)
    expect(wageOf(p)).toBeGreaterThan(wageOf({ ...p, wageX: 1 }) * 2)
    expect(sanitizeCareer(JSON.parse(JSON.stringify(next))).reserves.at(-1).wageX).toBe(p.wageX)
    // Not enough for fee plus bonus: no deal
    expect(makeBid({ ...c, coins: r.asking }, r.player.id, r.asking).result.verdict).toBe('funds')
  })

  it('free agents sign any time; club players only in a window', () => {
    let c = rich(newCareer(club, { now: 6 }))
    const f = nextMatch(c.league)
    c = recordCareerResult(c, f.id, { home: 1, away: 1 })
    expect(transferWindow(c)).toBeNull()
    const t = cheapAt(c)
    expect(makeBid(c, t.player.id, t.asking).result.verdict).toBe('shut')
    const fa = searchMarket(c.world, { level: 'free', sort: 'price' }, 0).find((r) => !r.willing.reluctant)
    expect(makeBid(c, fa.player.id, fa.asking).result.verdict).toBe('accept')
  })
})

describe('selling, releasing, loans and the youth team', () => {
  it('clubs bid for a good player; selling a starter brings the best reserve in', () => {
    let c = newCareer(club, { now: 7 })
    // A star striker everyone wants, and a reserve to replace him
    const star = { ...c.squad.atk1, attrs: { pwr: 80, sht: 82, pas: 70, phy: 66 }, rating: 80, age: 24 }
    c = { ...c, squad: { ...c.squad, atk1: star }, reserves: [kid('cover', 'ATK')] }
    const offers = offersFor(c, 'atk1')
    expect(offers.length).toBeGreaterThan(0)
    const sold = sellTo(c, 'atk1', offers[0].clubId)
    expect(sold.coins).toBe(c.coins + offers[0].fee)
    expect(sold.squad.atk1.id).toBe('cover')
    expect(sold.reserves).toHaveLength(0)
    expect(locate(sold.world, star.id).club.id).toBe(offers[0].clubId)
  })

  it('you can’t sell a starter with nobody to replace him', () => {
    const c = newCareer(club, { now: 8 })
    expect(vacate(c, 'gk').error).toBeTruthy()
    expect(releasePlayer(c, 'atk1').error).toBeTruthy()
  })

  it('a loan frees a place, costs no wages, and he comes back better in the summer', () => {
    let c = newCareer(club, { now: 9 })
    const young = { ...kid('loanee', 'ATK'), age: 19, pot: 80 }
    c = { ...c, reserves: [young] }
    expect(loanClub(c, 'reserve:0')).toBeTruthy()
    const out = loanOut(c, 'reserve:0')
    expect(out.reserves).toHaveLength(0)
    expect(out.loans[0].player.id).toBe('loanee')
    expect(wageBill(out.squad, out.bench, out.reserves)).toBeLessThan(wageBill(c.squad, c.bench, c.reserves))
    const next = finishSeason({ ...playSeason(out), cup: null })
    const back = next.reserves.find((p) => p.id === 'loanee')
    expect(back.rating).toBeGreaterThan(young.rating)
    expect(next.loans).toHaveLength(0)
  })

  it('the academy fills the youth team each summer; promote them when there’s room', () => {
    let c = newCareer(club, { now: 10 })
    expect(c.youthTeam.length).toBe(2)
    expect(c.youthTeam.every((p) => p.age <= 16)).toBe(true)
    const p0 = c.youthTeam[0]
    const up = promoteYouth(c, 0)
    expect(up.reserves.at(-1).id).toBe(p0.id)
    expect(up.youthTeam).toHaveLength(1)
    expect(releaseYouth(c, 1).youthTeam).toHaveLength(1)
    const full = { ...c, reserves: [kid('a'), kid('b'), kid('c'), kid('d'), kid('e', 'GK')] }
    expect(promoteYouth(full, 0).error).toBeTruthy()
    c = finishSeason({ ...playSeason({ ...c, biz: { ...c.biz, academy: 4 } }), cup: null })
    expect(c.youthTeam.length).toBe(Math.min(YOUTH_MAX, 2 + 3))
    expect(c.lastSummer.youthIn).toHaveLength(3)
  })

  it('reserves swap into the matchday ten', () => {
    let c = { ...newCareer(club, { now: 11 }), reserves: [kid('m1')] }
    expect(promoteReserve(c, 0, 'gk')).toBeNull()
    const out = c.squad.atk1
    c = promoteReserve(c, 0, 'atk1')
    expect(c.squad.atk1.id).toBe('m1')
    expect(c.reserves[0].id).toBe(out.id)
  })

  it('everything survives a save and reload, and old saves get a world', () => {
    let c = rich(newCareer(club, { now: 12 }))
    const t = cheapAt(c)
    c = makeBid(c, t.player.id, Math.round(t.asking * 0.75)).career
    c = makeBid(c, t.player.id, t.asking).career
    c = loanOut({ ...c, reserves: [...c.reserves, { ...makePlayer(seededRng('z'), 52, 'MID'), id: 'z' }] }, `reserve:${c.reserves.length}`)
    const again = sanitizeCareer(JSON.parse(JSON.stringify(c)))
    expect(again).toEqual(c)
    const { world, youthTeam, loans, ...old } = c
    void world; void youthTeam; void loans
    const fixed = sanitizeCareer(JSON.parse(JSON.stringify(old)))
    expect(fixed.world.clubs).toHaveLength(20)
    expect(fixed.youthTeam.length).toBeGreaterThan(0)
  })
})
