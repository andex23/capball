import { describe, it, expect } from 'vitest'
import { newCareer, recordCareerResult, recordCclMatch, careerNext, finishSeason, sanitizeCareer, seasonOver, cclPending, ME, TOP, compOf } from '../game/career'
import { cclRun, CCL_PRIZE } from '../game/championsLeague'
import { teamById } from '../game/tournament'

const club = { name: 'Champs FC', primary: '#123456', edge: '#ffffff' }

/** Play everything the calendar gives you with this score (league and Champions League), cup off. */
function playAll(c, [gf, ga]) {
  for (let i = 0; i < 60; i++) {
    const due = careerNext(c)
    if (!due) break
    const r = due.fixture.home === ME ? { home: gf, away: ga } : { home: ga, away: gf }
    c = due.kind === 'ccl' ? recordCclMatch(c, due.fixture.id, r) : recordCareerResult(c, due.fixture.id, r)
  }
  return c
}

describe('Cap Champions League', () => {
  it('top two in the Premier Cap League qualify; the groups, semis and final fit between league matchdays', () => {
    // A career at the top, winning everything
    let c = { ...newCareer(club, { now: 2 }), cup: null }
    c = { ...c, level: TOP }
    c = finishSeason(playAll({ ...c, league: finishSeason({ ...c, cup: null }).league }, [5, 0]))
    expect(c.level).toBe(TOP)
    expect(c.past[0].qualified).toBe(true)
    expect(c.ccl).toBeTruthy()
    const g = c.ccl.groups[0]
    expect(g.teams).toHaveLength(4)
    expect(teamById(g, ME).name).toBe(club.name)
    expect(c.ccl.groups[1].teams).toHaveLength(4)

    // Nothing in the Champions League until two league matches are played
    c = { ...c, cup: null }
    expect(careerNext(c).kind).toBe('league')
    let sawCcl = false
    for (let i = 0; i < 60; i++) {
      const due = careerNext(c)
      if (!due) break
      const r = due.fixture.home === ME ? { home: 3, away: 0 } : { home: 0, away: 3 }
      if (due.kind === 'ccl') { sawCcl = true; const before = c.coins; c = recordCclMatch(c, due.fixture.id, r); expect(c.coins).toBeGreaterThan(before) } else c = recordCareerResult(c, due.fixture.id, r)
    }
    expect(sawCcl).toBe(true)
    expect(seasonOver(c.league)).toBe(true)
    expect(cclRun(c.ccl)).toBe('won')
    expect(cclPending(c)).toBe(false)
    expect(c.ccl.knockout.championId).toBe(ME)
    expect(compOf(c, 'ccl', c.ccl.knockout.rounds[1][0].id).format).toBe('knockout')
    // It survives a save, and the title goes in the record books
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c)))).toEqual(c)
    const next = finishSeason(c)
    expect(next.cclTitles).toBe(1)
    expect(next.past[0].ccl).toBe('won')
    expect(CCL_PRIZE.won).toBeGreaterThan(CCL_PRIZE.final)
  })

  it('losing every group match: out in the groups, and the season can still end', () => {
    let c = { ...newCareer(club, { now: 4 }), level: TOP, cup: null }
    c = finishSeason(playAll({ ...c, league: finishSeason(c).league }, [5, 0]))
    c = { ...c, cup: null }
    for (let i = 0; i < 60; i++) {
      const due = careerNext(c)
      if (!due) break
      const lose = due.kind === 'ccl'
      const r = due.fixture.home === ME ? (lose ? { home: 0, away: 2 } : { home: 2, away: 0 }) : (lose ? { home: 2, away: 0 } : { home: 0, away: 2 })
      c = due.kind === 'ccl' ? recordCclMatch(c, due.fixture.id, r) : recordCareerResult(c, due.fixture.id, r)
    }
    expect(cclRun(c.ccl)).toBe('group')
    expect(cclPending(c)).toBe(false)
    const next = finishSeason(c)
    expect(next.past[0].ccl).toBe('group')
    expect(next.cclTitles || 0).toBe(0)
  })
})
