import { describe, it, expect } from 'vitest'
import { newCareer, transferWindow, buyPlayer, promoteReserve, sellReserve, takeYouth, squadSize, MAX_SQUAD, MAX_RESERVES, sanitizeCareer, finishSeason, nextMatch, recordCareerResult, seasonOver, ME } from '../game/career'
import { sellValue, makeYouth } from '../game/squad'
import { wageBill, matchVenue, VENUE, attendance, newClub } from '../game/club'
import { STADIUMS, STADIUM_KEYS } from '../data/StadiumData'
import { seededRng } from '../game/tournament'

const club = { name: 'Res FC', primary: '#123456', edge: '#ffffff' }
const rich = (c) => ({ ...c, coins: 100_000 })

describe('a squad of fifteen', () => {
  it('starts with ten and signs into free reserve places without selling anyone', () => {
    let c = rich(newCareer(club, { now: 1 }))
    expect(squadSize(c)).toBe(10)
    const market = transferWindow(c).market
    for (const p of market) {
      const next = buyPlayer(c, p.id, 'reserve')
      if (next) c = next
    }
    expect(c.reserves.length).toBe(Math.min(MAX_RESERVES, market.length))
    expect(squadSize(c)).toBeLessThanOrEqual(MAX_SQUAD)
    expect(c.biz.ledger.sales).toBe(0)
  })

  it('the reserves are full at five', () => {
    const y = makeYouth(seededRng('y'), 0, 'MID')
    let c = rich({ ...newCareer(club, { now: 2 }), reserves: Array.from({ length: 5 }, (_, i) => ({ ...y, id: `r${i}` })) })
    expect(squadSize(c)).toBe(15)
    const p = transferWindow(c).market[0]
    expect(buyPlayer(c, p.id, 'reserve')).toBeNull()
    c = buyPlayer(c, p.id, 'reserve:0')
    expect(c.reserves[0].id).toBe(p.id)
    expect(c.biz.ledger.sales).toBe(sellValue(y))
  })

  it('a reserve swaps into the matchday ten (keepers for keepers) and can be sold', () => {
    const mid = { ...makeYouth(seededRng('m'), 0, 'MID'), id: 'm1' }
    let c = { ...newCareer(club, { now: 3 }), reserves: [mid] }
    expect(promoteReserve(c, 0, 'gk')).toBeNull()
    const out = c.squad.atk1
    c = promoteReserve(c, 0, 'atk1')
    expect(c.squad.atk1.id).toBe('m1')
    expect(c.reserves[0].id).toBe(out.id)
    const before = c.coins
    c = sellReserve(c, 0)
    expect(c.reserves).toHaveLength(0)
    expect(c.coins).toBe(before + sellValue(out))
  })

  it('reserves are paid wages, survive a reload and develop over the summer', () => {
    const mid = { ...makeYouth(seededRng('w'), 0, 'MID'), id: 'w1' }
    let c = { ...newCareer(club, { now: 4 }), reserves: [mid] }
    expect(wageBill(c.squad, c.bench, c.reserves)).toBeGreaterThan(wageBill(c.squad, c.bench))
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c))).reserves).toEqual(c.reserves)
    while (!seasonOver(c.league)) {
      const f = nextMatch(c.league)
      if (!f) break
      c = recordCareerResult(c, f.id, f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 })
    }
    c = finishSeason({ ...c, cup: null })
    expect(c.reserves[0].age).toBe(mid.age + 1)
  })

  it('an academy graduate joins the reserves if there is room', () => {
    const y = { ...makeYouth(seededRng('g'), 0, 'ATK'), id: 'g1' }
    const c = takeYouth({ ...newCareer(club, { now: 5 }), youthOffer: y }, 'reserve')
    expect(c.reserves.map((p) => p.id)).toEqual(['g1'])
    expect(c.youthOffer).toBeNull()
  })
})

describe('the venue', () => {
  it('each level is a real table venue, with more room to watch', () => {
    VENUE.forEach((v, i) => {
      expect(STADIUMS[v.venue]).toBeTruthy()
      if (i) expect(v.seats).toBeGreaterThan(VENUE[i - 1].seats)
    })
    expect(STADIUM_KEYS).not.toContain('capArena') // career only
  })

  it('home matches are at your venue; away ones at theirs', () => {
    const b = { ...newClub(0), stadium: 4 }
    expect(matchVenue(b, true, 0, 'X')).toBe('capArena')
    expect(matchVenue(b, false, 0, 'Bottle Rockets')).toBe(matchVenue(b, false, 0, 'Bottle Rockets'))
    expect(attendance({ ...newClub(0), fans: 99_999 })).toBe(VENUE[0].seats)
  })
})
