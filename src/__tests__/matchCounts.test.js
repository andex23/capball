import { describe, it, expect } from 'vitest'
import { create } from 'zustand'
import { SCREEN, PHASE } from '../state/MatchStore'
import { watchMatchCounts, quitBucket, matchStage } from '../lagos/matchCounts'

function setup() {
  const store = create(() => ({ screen: SCREEN.MENU, matchKey: 0, challenge: null, phase: PHASE.SELECT, extraTime: false, penaltyShootout: false, gameMode: 'local' }))
  const log = []
  let t = 0
  watchMatchCounts(store, (e, d) => log.push(`${e}:${d}`), (s) => (s.challenge ? 'daily' : s.gameMode), () => t)
  const play = (extra = {}) => store.setState((s) => ({ screen: SCREEN.PLAYING, matchKey: s.matchKey + 1, extraTime: false, penaltyShootout: false, ...extra }))
  return { store, log, play, wait: (ms) => { t += ms } }
}

describe('match counts', () => {
  it('counts a finished match once, extra time and penalties included', () => {
    const { store, log, play } = setup()
    play()
    store.setState({ screen: SCREEN.MATCH_END })
    play({ extraTime: true })
    store.setState({ screen: SCREEN.MATCH_END })
    play({ penaltyShootout: true })
    store.setState({ screen: SCREEN.MATCH_END })
    store.setState({ screen: SCREEN.MENU })
    expect(log).toEqual(['match_start:local', 'match_end:local'])
  })
  it('counts a match left from the pause menu as quit, with how long it lasted', () => {
    const { store, log, play, wait } = setup()
    play()
    wait(200e3)
    store.setState({ screen: SCREEN.MENU })
    expect(log).toEqual(['match_start:local', 'match_quit:local_3m'])
  })
  it('counts a restart as a quit and a new start', () => {
    const { log, play } = setup()
    play()
    play()
    expect(log).toEqual(['match_start:local', 'match_quit:local_0m', 'match_start:local'])
  })
  it('finishes the daily challenge when it is won or lost', () => {
    const { store, log, play } = setup()
    play({ challenge: { won: null } })
    store.setState({ phase: PHASE.CHALLENGE_DONE, challenge: { won: false } })
    play({ challenge: { won: null }, phase: PHASE.SELECT }) // try again
    store.setState({ screen: SCREEN.MENU, challenge: null }) // gave up mid-try
    expect(log).toEqual(['match_start:daily', 'match_end:daily', 'feature:daily_lost', 'match_start:daily', 'match_quit:daily_0m'])
  })
  it('buckets quit times', () => {
    expect([30e3, 90e3, 300e3, 900e3].map(quitBucket)).toEqual(['0m', '1m', '3m', '6m'])
  })

  it('counts a live match going off screen and coming back, with how far it had got', () => {
    const store = create(() => ({ screen: SCREEN.MENU, matchKey: 0, challenge: null, phase: PHASE.SELECT, gameMode: 'ai', stats: { team1: { turns: 0 } } }))
    const log = []
    let t = 0
    const doc = new EventTarget()
    doc.visibilityState = 'visible'
    const flip = (v) => { doc.visibilityState = v; doc.dispatchEvent(new Event('visibilitychange')) }
    watchMatchCounts(store, (e, d) => log.push(`${e}:${d}`), (s) => s.gameMode, () => t, doc)
    store.setState({ screen: SCREEN.PLAYING, matchKey: 1 })
    globalThis.__counterballPitchDrawn = 0
    flip('hidden') // pitch never drew
    flip('hidden') // counted once
    flip('visible')
    globalThis.__counterballPitchDrawn = 1
    flip('hidden') // drawn, no flick yet
    flip('visible')
    store.setState({ stats: { team1: { turns: 3 } } })
    t = 200e3
    flip('hidden')
    expect(log).toEqual(['match_start:ai', 'match_hidden:ai_loading', 'match_back:ai_loading', 'match_hidden:ai_first_turn', 'match_back:ai_first_turn', 'match_hidden:ai_3m'])
    // Off screen on a menu isn't a match being left
    flip('visible')
    store.setState({ screen: SCREEN.MENU })
    log.length = 0
    flip('hidden')
    expect(log).toEqual([])
    delete globalThis.__counterballPitchDrawn
  })

  it('names the stage of a match', () => {
    globalThis.__counterballPitchDrawn = 4
    expect(matchStage({ matchKey: 3 }, 0, 0)).toBe('loading')
    expect(matchStage({ matchKey: 4, stats: { team1: { turns: 0 } } }, 0, 0)).toBe('first_turn')
    expect(matchStage({ matchKey: 4, stats: { team1: { turns: 1 } } }, 0, 400e3)).toBe('6m')
    delete globalThis.__counterballPitchDrawn
  })
})
