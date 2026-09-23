import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMatchStore, PHASE, SCREEN, TIMING, clearMatchTimers } from '../state/MatchStore'

const initial = useMatchStore.getState()
const get = () => useMatchStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  clearMatchTimers()
  useMatchStore.setState(initial, true)
})
afterEach(() => {
  clearMatchTimers()
  vi.useRealTimers()
})

function startAndKickOff() {
  get().startGame()
  vi.advanceTimersByTime(TIMING.kickoff)
}

describe('match start', () => {
  it('shows the kick-off, then hands control to team1 with the clock running', () => {
    get().startGame()
    expect(get()).toMatchObject({ screen: SCREEN.PLAYING, phase: PHASE.KICKOFF, timerRunning: false, kickoffGuard: true })
    vi.advanceTimersByTime(TIMING.kickoff)
    expect(get()).toMatchObject({ phase: PHASE.SELECT, activeTeam: 'team1', timerRunning: true })
  })

  it('resets everything left over from the previous match', () => {
    useMatchStore.setState({
      score: { team1: 4, team2: 2 },
      team1Side: 'right',
      chosenTeam1Side: 'left',
      half: 2,
      penaltyShootout: true,
      matchResult: { winner: 'team1' },
      stats: { team1: { goals: 4, shots: 9, fouls: 1, turns: 20 }, team2: { goals: 2, shots: 3, fouls: 0, turns: 20 } },
    })
    const key = get().matchKey
    get().startGame()
    expect(get()).toMatchObject({
      score: { team1: 0, team2: 0 },
      team1Side: 'left',
      half: 1,
      penaltyShootout: false,
      matchResult: null,
      matchKey: key + 1,
    })
    expect(get().stats.team1.goals).toBe(0)
  })

  it('cancels timers from an abandoned match', () => {
    get().startGame()
    get().quitMatch()
    vi.advanceTimersByTime(10_000)
    expect(get().screen).toBe(SCREEN.MENU)
    // The pending kick-off timer must not have started play
    expect(get().phase).toBe(PHASE.KICKOFF)
    expect(get().timerRunning).toBe(false)
  })
})

describe('clock', () => {
  it('only runs during live play and not while paused', () => {
    startAndKickOff()
    const t0 = get().timeRemaining
    get().tickTimer(1)
    expect(get().timeRemaining).toBeCloseTo(t0 - 1)
    get().togglePause()
    get().tickTimer(1)
    expect(get().timeRemaining).toBeCloseTo(t0 - 1)
    get().togglePause()
    useMatchStore.setState({ phase: PHASE.GOAL })
    get().tickTimer(1)
    expect(get().timeRemaining).toBeCloseTo(t0 - 1)
  })

  it('swaps ends at half time and team2 kicks off', () => {
    useMatchStore.setState({ chosenTeam1Side: 'left' })
    startAndKickOff()
    get().tickTimer(get().timeRemaining + 1)
    expect(get()).toMatchObject({ half: 2, team1Side: 'right', phase: PHASE.KICKOFF, activeTeam: 'team2', kickoffGuard: true })
    vi.advanceTimersByTime(TIMING.kickoff)
    expect(get().phase).toBe(PHASE.SELECT)
  })

  it('ends the match at full time with the result', () => {
    startAndKickOff()
    get().tickTimer(get().timeRemaining + 1) // → half 2
    vi.advanceTimersByTime(TIMING.kickoff)
    useMatchStore.setState({ score: { team1: 1, team2: 2 } })
    get().tickTimer(get().timeRemaining + 1)
    expect(get().phase).toBe(PHASE.MATCH_OVER)
    expect(get().matchResult).toMatchObject({ winner: 'team2', isDraw: false, score: { team1: 1, team2: 2 } })
    vi.advanceTimersByTime(TIMING.fullTime)
    expect(get().screen).toBe(SCREEN.MATCH_END)
  })
})

describe('turns and goals', () => {
  it('switches turn, clears the kick-off guard and counts turns', () => {
    startAndKickOff()
    get().commitFlick('team1_atk1')
    expect(get().phase).toBe(PHASE.RESOLVE)
    get().switchTurn()
    expect(get()).toMatchObject({ activeTeam: 'team2', phase: PHASE.SELECT, kickoffGuard: false, lastFlickedCapId: null })
    expect(get().stats.team1.turns).toBe(1)
  })

  it('scores, then the conceding team kicks off', () => {
    startAndKickOff()
    get().scoreGoal('team1')
    expect(get()).toMatchObject({ phase: PHASE.GOAL, score: { team1: 1, team2: 0 }, lastScorer: 'team1' })
    expect(get().stats.team1.goals).toBe(1)
    vi.advanceTimersByTime(TIMING.goal)
    expect(get()).toMatchObject({ phase: PHASE.KICKOFF, activeTeam: 'team2', kickoffGuard: true })
    vi.advanceTimersByTime(TIMING.kickoff)
    expect(get().phase).toBe(PHASE.SELECT)
  })

  it('a disallowed goal passes possession', () => {
    startAndKickOff()
    get().disallowGoal('gk_violation')
    expect(get()).toMatchObject({ phase: PHASE.NO_GOAL, noGoalReason: 'gk_violation', score: { team1: 0, team2: 0 } })
    vi.advanceTimersByTime(TIMING.noGoal)
    expect(get()).toMatchObject({ phase: PHASE.SELECT, activeTeam: 'team2' })
  })
})

describe('fouls', () => {
  it('goes foul → free kick setup → fouled team to play, only the taker', () => {
    startAndKickOff()
    get().commitFlick('team1_atk1')
    get().callFoul({ x: 3, y: 1 }, 'team2', false)
    expect(get().phase).toBe(PHASE.FOUL)
    expect(get().stats.team1.fouls).toBe(1)
    vi.advanceTimersByTime(TIMING.foul)
    expect(get()).toMatchObject({ phase: PHASE.FREE_KICK_SETUP, activeTeam: 'team2' })
    useMatchStore.setState({ freeKickCapId: 'team2_atk1' }) // done by the physics setup
    vi.advanceTimersByTime(TIMING.setPiece)
    expect(get()).toMatchObject({ phase: PHASE.SELECT, freeKickCapId: 'team2_atk1' })
  })

  it('a foul in the box is a penalty', () => {
    startAndKickOff()
    get().callFoul({ x: -13, y: 0 }, 'team2', true)
    vi.advanceTimersByTime(TIMING.foul)
    expect(get().phase).toBe(PHASE.PENALTY_SETUP)
  })
})

describe('penalty shootout', () => {
  function kick(scored) {
    vi.advanceTimersByTime(TIMING.kickoff)
    expect(get().phase).toBe(PHASE.SELECT)
    get().penaltyAttemptResult(scored)
    vi.advanceTimersByTime(TIMING.shootoutResult)
  }

  it('alternates shooters and ends when decided', () => {
    get().startPenaltyShootout()
    expect(get()).toMatchObject({ penaltyShootout: true, activeTeam: 'team1', timerRunning: false, kickoffGuard: false })
    kick(true) // t1 1-0
    expect(get().activeTeam).toBe('team2')
    kick(false) // t2 1-0
    kick(true) // t1 2-0
    kick(false) // t2 2-0, team2 has one kick left → can't catch up
    expect(get().phase).toBe(PHASE.MATCH_OVER)
    expect(get().matchResult).toMatchObject({ winner: 'team1', penaltyScore: { team1: 2, team2: 0 } })
  })

  it('does not run the match clock', () => {
    get().startPenaltyShootout()
    vi.advanceTimersByTime(TIMING.kickoff)
    expect(get().timerRunning).toBe(false)
  })

  it('goes to sudden death when level', () => {
    get().startPenaltyShootout()
    for (let i = 0; i < 6; i++) kick(true) // 3-3
    expect(get().phase).toBe(PHASE.KICKOFF)
    kick(true) // t1 4-3
    expect(get().phase).toBe(PHASE.KICKOFF)
    kick(false) // t2 misses → 4-3
    expect(get().matchResult).toMatchObject({ winner: 'team1', penaltyScore: { team1: 4, team2: 3 } })
  })
})
