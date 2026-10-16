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
