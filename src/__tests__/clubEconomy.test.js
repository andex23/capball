import { it, expect } from 'vitest'
import { newCareer, nextMatch, recordCareerResult, finishSeason, cupTie, recordCupResult, transferWindow, buyPlayer, signSponsor, buildFacility, takeYouth, ME, myPosition } from '../game/career'
import { averageRating, squadRatings, clubRatings } from '../game/squad'
import { wageBill, UPGRADE_COST, ledgerTotals } from '../game/club'
import { seededRng, teamById } from '../game/tournament'

function play(c, rng, weak = false) {
  const res = (f, t) => {
    const opp = teamById(t, f.home === ME ? f.away : f.home)
    const mine = averageRating(squadRatings(c.squad)); const theirs = averageRating(clubRatings(c.level, opp.name))
    const pWin = weak ? 0.2 : Math.max(0.15, Math.min(0.8, 0.45 + (mine - theirs) * 0.03)); const r = rng()
    const [gf, ga] = r < pWin ? [2, 1] : r < pWin + 0.25 ? [1, 1] : [0, 1]
    return f.home === ME ? { home: gf, away: ga } : { home: ga, away: gf }
  }
  for (let f = nextMatch(c.league); f; f = nextMatch(c.league)) {
    // transfers: buy the best affordable upgrade
    const w = transferWindow(c)
    if (w && !weak) for (const p of w.market.slice().sort((a, b) => b.rating - a.rating)) {
      const role = Object.entries(c.squad).filter(([r]) => (r === 'gk') === (p.pos === 'GK')).sort((a, b) => a[1].rating - b[1].rating)[0]
      if (role && p.rating > role[1].rating + 3 && c.coins > 200) { const n = buyPlayer(c, p.id, role[0]); if (n) c = n }
    }
    c = recordCareerResult(c, f.id, res(f, c.league))
    const t = cupTie(c); if (t) c = recordCupResult(c, t.id, res(t, c.cup.tournament))
  }
  return c
}

it('the club economy stays sensible over ten seasons: no runaway riches, no hopeless debt', () => {
  for (const seed of [1, 2, 3, 'weak']) {
    const weak = seed === 'weak'
    const rng = seededRng(`econ${seed}`)
    let c = newCareer({ name: 'Sim FC', primary: '#123456', edge: '#ffffff' }, { now: seed })
    let maxBank = -Infinity
    let minBank = Infinity
    for (let s = 0; s < 10; s++) {
      if (c.biz.offers.length) c = signSponsor(c, 0) || c
      for (const k of ['stadium', 'training', 'academy']) { const cost = UPGRADE_COST[k][c.biz[k] + 1]; if (cost && c.coins > cost * 2) c = buildFacility(c, k) || c }
      if (c.youthOffer) c = takeYouth(c, null) || c
      c = play(c, rng, weak)
      const pos = myPosition(c.league); const fin = ledgerTotals(c.biz.ledger); const lvl = c.level
      const wages = wageBill(c.squad, c.bench)
      c = finishSeason(c)
      void pos; void fin; void lvl; void wages
      maxBank = Math.max(maxBank, c.coins)
      minBank = Math.min(minBank, c.coins)
    }
    expect(maxBank).toBeLessThan(100_000) // never more than ₦1bn in the bank after ten seasons
    expect(minBank).toBeGreaterThan(0)    // a club playing sensibly never sinks into debt
  }
})
