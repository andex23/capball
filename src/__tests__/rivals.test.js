import { describe, it, expect } from 'vitest'
import { newCareer, recordCareerResult, nextMatch, ME, sanitizeCareer, DIVISIONS } from '../game/career'
import { rivalFor, derbyName, isDerby, headToHead } from '../game/rivals'
import { teamById } from '../game/tournament'
import { coinsForResult } from '../game/squad'

const club = { name: 'Derby Test FC', primary: '#123456', edge: '#ffffff' }

/** Play your league matches with this score until the derby comes up; returns the career just before it. */
function toDerby(c) {
  for (let i = 0; i < 20; i++) {
    const f = nextMatch(c.league)
    if (!f || isDerby(c, c.league, f)) return c
    c = recordCareerResult(c, f.id, f.home === ME ? { home: 1, away: 1 } : { home: 1, away: 1 })
  }
  return c
}

describe('rivals and derbies', () => {
  it('every division gives your club one fixed rival among its stronger clubs', () => {
    const c = newCareer(club, { now: 3 })
    for (let level = 0; level < DIVISIONS.length; level++) {
      const r = rivalFor(c, level)
      expect(DIVISIONS[level].clubs.slice(0, 4).map((x) => x.name)).toContain(r)
      expect(rivalFor(c, level)).toBe(r) // the same every time
    }
    expect(derbyName('Bottle Rockets')).toBe('The Bottle Derby')
  })

  it('a derby win pays double prize money, and the head to head is kept', () => {
    const c = toDerby(newCareer(club, { now: 3 }))
    const f = nextMatch(c.league)
    expect(isDerby(c, c.league, f)).toBe(true)
    const rival = teamById(c.league, f.home === ME ? f.away : f.home).name
    const won = recordCareerResult(c, f.id, f.home === ME ? { home: 2, away: 0 } : { home: 0, away: 2 })
    // Twice what the same win pays against anyone else
    expect(won.biz.ledger.prize - c.biz.ledger.prize).toBe(2 * coinsForResult(2, 0, c.level))
    expect(headToHead(won, rival)).toEqual({ w: 1, d: 0, l: 0 })
    expect(sanitizeCareer(JSON.parse(JSON.stringify(won))).h2h).toEqual(won.h2h)
  })
})
