import { describe, it, expect, beforeEach } from 'vitest'
import { newCareer, nextMatch, recordCareerResult, cupTie, CUP_AFTER, ME } from '../game/career'
import { useCareerStore } from '../state/careerStore'
import { useTournamentStore } from '../state/tournamentStore'

const club = { name: 'Lions', primary: '#D32F2F', edge: '#FFFFFF' }
const initial = useTournamentStore.getState()

function cupDue() {
  let c = newCareer(club, { now: 11 })
  for (let i = 0; i < CUP_AFTER[0]; i++) {
    const f = nextMatch(c.league)
    c = recordCareerResult(c, f.id, f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 })
  }
  return c
}

describe('a cup tie on its date comes first', () => {
  beforeEach(() => useTournamentStore.setState(initial, true))

  it('the league match can’t be started while the cup tie is due', () => {
    const c = cupDue()
    useCareerStore.setState({ career: c })
    useTournamentStore.getState().playFixture('career', nextMatch(c.league))
    expect(useTournamentStore.getState().playing).toBe(null)
    expect(useTournamentStore.getState().playLanFixture('career', nextMatch(c.league), 'T1', 'internet')).toBe(false)
  })

  it('the cup tie can', () => {
    const c = cupDue()
    useCareerStore.setState({ career: c })
    useTournamentStore.getState().playFixture('careerCup', cupTie(c))
    expect(useTournamentStore.getState().playing?.kind).toBe('careerCup')
  })
})

describe('the career’s own calendar (game dates, not real ones)', () => {
  beforeEach(() => useTournamentStore.setState(initial, true))

  it('the next match can be played straight after the last one', () => {
    let c = newCareer(club, { now: 12 })
    useCareerStore.setState({ career: c })
    const f = nextMatch(c.league)
    useCareerStore.getState().record(f.id, f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 })
    c = useCareerStore.getState().career
    useTournamentStore.getState().playFixture('career', nextMatch(c.league))
    expect(useTournamentStore.getState().playing?.kind).toBe('career')
  })

  it('league on Saturdays a week apart, the cup on the Wednesday after, never two on one day', async () => {
    const { careerDate, leagueDate, formatGameDate, recordCupResult } = await import('../game/career')
    let c = newCareer(club, { now: 13 })
    const seen = []
    for (let i = 0; i < 40; i++) {
      const d = careerDate(c)
      if (!d) break
      const due = (await import('../game/career')).careerNext(c)
      expect(d.getUTCDay()).toBe(due.kind === 'cup' ? 3 : 6)
      // The calendar only moves forwards, one match a day
      if (seen.length) expect(d.getTime()).toBeGreaterThan(seen[seen.length - 1])
      seen.push(d.getTime())
      const f = due.fixture
      const win = f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 }
      c = due.kind === 'cup' ? recordCupResult(c, f.id, win) : recordCareerResult(c, f.id, win)
    }
    expect(seen.length).toBeGreaterThan(CUP_AFTER.length)
    expect(formatGameDate(leagueDate(newCareer(club, { now: 1 }), { round: 0 }))).toBe('Sat 1 Aug 2026')
  })
})
