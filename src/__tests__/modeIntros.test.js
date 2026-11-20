import { describe, it, expect, beforeEach } from 'vitest'
import { playedBefore, useIntroStore } from '../state/introStore'
import { useCareerStore } from '../state/careerStore'
import { useDailyStore } from '../state/dailyStore'
import { useSavedStore } from '../state/savedMatch'
import { useTournamentStore } from '../state/tournamentStore'
import { useRewardsStore } from '../state/rewardsStore'
import { MODE_INTROS } from '../data/modeIntros'
import fs from 'node:fs'

describe('how each mode works', () => {
  it('knows who has played a mode before', () => {
    expect(playedBefore('career', {})).toBe(false)
    expect(playedBefore('career', { career: { v: 2 } })).toBe(true)
    expect(playedBefore('career', { hall: [{ club: 'X' }] })).toBe(true)
    expect(playedBefore('tournament', { tournamentHistory: [{ id: 'a' }] })).toBe(true)
    expect(playedBefore('tournament', { localTournament: { weekly: { key: 'w' } } })).toBe(false) // a Weekly Cup isn't your own tournament
    // Starting a Weekly Cup isn't playing one: it counts once you've played a match in it
    const cup = { format: 'knockout', weekly: { key: 'w' }, teams: [{ id: 'T1', cpu: false }, { id: 'T2', cpu: true }], rounds: [[{ id: 'K1-1', home: 'T1', away: 'T2', result: null }]] }
    expect(playedBefore('weekly', { localTournament: cup })).toBe(false)
    expect(playedBefore('weekly', { localTournament: { ...cup, rounds: [[{ ...cup.rounds[0][0], result: { home: 1, away: 0 }, winner: 'T1' }]] } })).toBe(true)
    expect(playedBefore('weekly', { cupsWon: [{ key: 'w' }] })).toBe(true)
    expect(playedBefore('daily', { daily: { lastDone: null, best: 0, tries: {} } })).toBe(false)
    expect(playedBefore('daily', { daily: { tries: { '2026-11-19': { tries: 2 } } } })).toBe(true)
    expect(playedBefore('local', { matchHistory: [{ mode: 'ai' }, { mode: 'local', tournament: true }] })).toBe(false)
    expect(playedBefore('local', { matchHistory: [{ mode: 'local', tournament: false }] })).toBe(true)
  })

  describe('the store', () => {
    beforeEach(() => {
      useIntroStore.setState({ seen: {}, open: null, then: null })
      useCareerStore.setState({ career: null, hall: [] })
      useDailyStore.setState({ lastDone: null, best: 0, tries: {} })
      useSavedStore.setState({ history: [] })
      useTournamentStore.setState({ history: [], local: null })
      useRewardsStore.setState({ cups: [] })
    })

    it('shows a new player the cards once, then never again on its own', () => {
      expect(useIntroStore.getState().maybeShow('career')).toBe(true)
      expect(useIntroStore.getState().open).toBe('career')
      useIntroStore.getState().close()
      expect(useIntroStore.getState().maybeShow('career')).toBe(false)
      expect(useIntroStore.getState().seen.career).toBe(true)
    })

    it('never pops the cards up for someone who already plays the mode, but the "?" still opens them', () => {
      useDailyStore.setState({ lastDone: '2026-11-19', best: 3, tries: {} })
      expect(useIntroStore.getState().maybeShow('daily')).toBe(false)
      expect(useIntroStore.getState().open).toBe(null)
      expect(useIntroStore.getState().seen.daily).toBe(true)
      useIntroStore.getState().show('daily')
      expect(useIntroStore.getState().open).toBe('daily')
    })
  })

  it('every card has a title, text and a screenshot that exists', () => {
    for (const [mode, intro] of Object.entries(MODE_INTROS)) {
      expect(intro.cards.length, mode).toBeGreaterThan(0)
      for (const c of intro.cards) {
        expect(c.title && c.text, mode).toBeTruthy()
        expect(fs.existsSync(`public/intro/${c.img}.webp`), c.img).toBe(true)
      }
    }
  })
})
