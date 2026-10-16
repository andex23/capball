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

describe('one career match a day', () => {
  beforeEach(() => useTournamentStore.setState(initial, true))

  it('after today’s match, the next one waits for tomorrow', async () => {
    const { localDay, playedToday, sanitizeCareer } = await import('../game/career')
    let c = newCareer(club, { now: 12 })
    useCareerStore.setState({ career: c })
    const f = nextMatch(c.league)
    useCareerStore.getState().record(f.id, f.home === ME ? { home: 1, away: 0 } : { home: 0, away: 1 })
    c = useCareerStore.getState().career
    expect(c.lastPlayedDay).toBe(localDay())
    expect(playedToday(c)).toBe(true)
    useTournamentStore.getState().playFixture('career', nextMatch(c.league))
    expect(useTournamentStore.getState().playing).toBe(null)
    // The date is kept through a save and reload
    expect(sanitizeCareer(JSON.parse(JSON.stringify(c))).lastPlayedDay).toBe(c.lastPlayedDay)
    // Tomorrow it's open again
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    expect(playedToday(c, localDay(tomorrow))).toBe(false)
    useCareerStore.setState({ career: { ...c, lastPlayedDay: '2000-01-01' } })
    useTournamentStore.getState().playFixture('career', nextMatch(c.league))
    expect(useTournamentStore.getState().playing?.kind).toBe('career')
  })
})
