import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  STEP, startTutorial, tutorialReducer, phaseEvent, shouldAutoStart, isActive, attackDir,
  goalPlacement, stepCopy, isTutorialDone, markTutorialDone, rearmTutorial, onTutorialRearm, STORAGE_KEY,
  shotClockHoldPatch,
} from '../game/tutorial'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { projectToScreen } from '../scene/camera'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}
const throwingStorage = {
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('QuotaExceededError') },
  removeItem: () => { throw new Error('SecurityError') },
}

const run = (tut, ...types) => types.reduce((t, type) => tutorialReducer(t, { type }), tut)

beforeEach(() => rearmTutorial(memoryStorage())) // clears the in-memory "done" flag

describe('tutorial steps', () => {
  it('follows a real first turn: aim, flick, then the explanations', () => {
    let t = startTutorial('team1')
    expect(t).toEqual({ step: STEP.PRESS, team: 'team1' })
    t = run(t, 'aimStart')
    expect(t.step).toBe(STEP.AIM)
    t = run(t, 'flick')
    expect(t.step).toBe(STEP.WATCH)
    t = run(t, 'turnEnd') // first flick resolved
    expect(t.step).toBe(STEP.FOUL)
    t = run(t, 'turnEnd') // the opponent's turn ending doesn't hurry it along…
    expect(t.step).toBe(STEP.FOUL)
    t = run(t, 'myTurn') // …the player's turn coming round again does
    expect(t.step).toBe(STEP.GOAL)
    t = run(t, 'aimStart')
    expect(t.step).toBe(STEP.READY)
    t = run(t, 'flick')
    expect(t.step).toBe(STEP.DONE)
    expect(isActive(t)).toBe(false)
  })

  it('"You\'re ready" also clears itself after a moment', () => {
    expect(run({ step: STEP.READY, team: 'team1' }, 'timeout').step).toBe(STEP.DONE)
  })

  it('goes back to the cap if the player puts it down', () => {
    expect(run(startTutorial('team1'), 'aimStart', 'aimCancel').step).toBe(STEP.PRESS)
  })

  it('a flick without an aim step still waits for the turn to end', () => {
    expect(run(startTutorial('team1'), 'flick').step).toBe(STEP.WATCH)
  })

  it('"Next" walks through every coach mark', () => {
    const seen = []
    let t = startTutorial('team2')
    while (isActive(t)) { seen.push(t.step); t = run(t, 'next') }
    expect(seen).toEqual([STEP.PRESS, STEP.AIM, STEP.FOUL, STEP.GOAL, STEP.READY])
  })

  it('skip ends it from any step, and so does the end of the match', () => {
    for (const step of [STEP.PRESS, STEP.AIM, STEP.WATCH, STEP.FOUL, STEP.GOAL, STEP.READY]) {
      expect(run({ step, team: 'team1' }, 'skip').step).toBe(STEP.DONE)
      expect(run({ step, team: 'team1' }, 'matchOver').step).toBe(STEP.DONE)
    }
  })

  it('ignores events that don\'t apply (same object back) and stays done', () => {
    const t = startTutorial('team1')
    expect(tutorialReducer(t, { type: 'turnEnd' })).toBe(t)
    expect(tutorialReducer(t, { type: 'timeout' })).toBe(t)
    const done = run(t, 'skip')
    expect(run(done, 'next', 'aimStart')).toBe(done)
    expect(tutorialReducer(null, { type: 'next' })).toBe(null)
  })

  it('has copy for every visible step, with the goal direction filled in', () => {
    expect(stepCopy(STEP.PRESS).body).toMatch(/drag BACK/)
    expect(stepCopy(STEP.AIM).body).toMatch(/dotted line/)
    expect(stepCopy(STEP.FOUL).body).toMatch(/foul/)
    expect(stepCopy(STEP.GOAL, { goalWhere: 'on the right' }).body).toBe('Score in the goal on the right.')
    expect(stepCopy(STEP.READY).title).toMatch(/ready/)
    expect(stepCopy(STEP.WATCH)).toBeNull()
  })
})

describe('game events', () => {
  const st = (phase, activeTeam = 'team1') => ({ phase, activeTeam })

  it('only the tutorial team\'s aim and flick count', () => {
    expect(phaseEvent(st(PHASE.SELECT), st(PHASE.AIM), 'team1')).toEqual({ type: 'aimStart' })
    expect(phaseEvent(st(PHASE.SELECT, 'team2'), st(PHASE.AIM, 'team2'), 'team1')).toBeNull()
    expect(phaseEvent(st(PHASE.AIM), st(PHASE.SELECT), 'team1')).toEqual({ type: 'aimCancel' })
    expect(phaseEvent(st(PHASE.AIM), st(PHASE.RESOLVE), 'team1')).toEqual({ type: 'flick' })
    expect(phaseEvent(st(PHASE.AIM, 'team2'), st(PHASE.RESOLVE, 'team2'), 'team1')).toBeNull()
  })

  it('any turn finishing (turn switch, goal, foul) is a turn end', () => {
    expect(phaseEvent(st(PHASE.RESOLVE), st(PHASE.SELECT, 'team2'), 'team1')).toEqual({ type: 'turnEnd' })
    expect(phaseEvent(st(PHASE.RESOLVE), st(PHASE.FOUL), 'team1')).toEqual({ type: 'turnEnd' })
    expect(phaseEvent(st(PHASE.RESOLVE), st(PHASE.GOAL), 'team1')).toEqual({ type: 'turnEnd' })
    expect(phaseEvent(st(PHASE.RESOLVE), st(PHASE.MATCH_OVER), 'team1')).toEqual({ type: 'matchOver' })
    expect(phaseEvent(st(PHASE.SELECT), st(PHASE.SELECT, 'team2'), 'team1')).toBeNull()
  })

  it('the player\'s turn starting again is its own event', () => {
    expect(phaseEvent(st(PHASE.RESOLVE, 'team2'), st(PHASE.SELECT, 'team1'), 'team1')).toEqual({ type: 'myTurn' })
    expect(phaseEvent(st(PHASE.FREE_KICK_SETUP), st(PHASE.SELECT), 'team1')).toEqual({ type: 'myTurn' })
    expect(phaseEvent(st(PHASE.KICKOFF), st(PHASE.SELECT), 'team1')).toEqual({ type: 'myTurn' })
    // putting the cap down is not a new turn
    expect(phaseEvent(st(PHASE.AIM), st(PHASE.SELECT), 'team1')).toEqual({ type: 'aimCancel' })
    // …and it does nothing to the very first coach mark
    const t = startTutorial('team1')
    expect(tutorialReducer(t, { type: 'myTurn' })).toBe(t)
  })
})

describe('when it starts', () => {
  const base = { gameMode: 'ai', aiTeam: 'team2', activeTeam: 'team1', phase: PHASE.KICKOFF, penaltyShootout: false }

  it('starts at the player\'s kick-off in a local or vs-CPU match', () => {
    expect(shouldAutoStart(base, false)).toBe(true)
    expect(shouldAutoStart({ ...base, gameMode: 'local', activeTeam: 'team2' }, false)).toBe(true)
    expect(shouldAutoStart({ ...base, phase: PHASE.SELECT }, false)).toBe(true)
  })

  it('never starts online, for the CPU, in a shootout, mid-turn or once done', () => {
    expect(shouldAutoStart({ ...base, gameMode: 'online' }, false)).toBe(false)
    expect(shouldAutoStart({ ...base, activeTeam: 'team2' }, false)).toBe(false)
    expect(shouldAutoStart({ ...base, penaltyShootout: true }, false)).toBe(false)
    expect(shouldAutoStart({ ...base, phase: PHASE.RESOLVE }, false)).toBe(false)
    expect(shouldAutoStart(base, true)).toBe(false)
  })
})

describe('"tutorial done" flag', () => {
  it('persists in storage and can be re-armed', () => {
    const storage = memoryStorage()
    expect(isTutorialDone(storage)).toBe(false)
    markTutorialDone(storage)
    expect(storage.getItem(STORAGE_KEY)).toBe('1')
    expect(isTutorialDone(storage)).toBe(true)
    rearmTutorial(storage)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(isTutorialDone(storage)).toBe(false)
  })

  it('reads a flag saved in an earlier session', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '1')
    expect(isTutorialDone(storage)).toBe(true)
  })

  it('survives storage that throws, and still won\'t repeat this session', () => {
    expect(() => isTutorialDone(throwingStorage)).not.toThrow()
    expect(isTutorialDone(throwingStorage)).toBe(false)
    expect(() => markTutorialDone(throwingStorage)).not.toThrow()
    expect(isTutorialDone(throwingStorage)).toBe(true)
    expect(() => rearmTutorial(throwingStorage)).not.toThrow()
    expect(isTutorialDone(throwingStorage)).toBe(false)
    expect(isTutorialDone(null)).toBe(false)
  })

  it('tells a running match when it is re-armed', () => {
    const fn = vi.fn()
    const off = onTutorialRearm(fn)
    rearmTutorial(memoryStorage())
    off()
    rearmTutorial(memoryStorage())
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('attacking direction', () => {
  it('uses the real attacking goal, which swaps with the sides', () => {
    expect(attackDir('team1', 'left')).toBe(1)
    expect(attackDir('team2', 'left')).toBe(-1)
    expect(attackDir('team1', 'right')).toBe(-1)
  })

  it('describes the goal by where it is on screen (the pitch turns upright on phones)', () => {
    expect(goalPlacement({ dx: 300, dy: 10 }, 1)).toBe('on the right')
    expect(goalPlacement({ dx: -300, dy: 10 }, 1)).toBe('on the left')
    expect(goalPlacement({ dx: 5, dy: -280 }, 1)).toBe('at the top')
    expect(goalPlacement({ dx: 5, dy: 280 }, 1)).toBe('at the bottom')
    expect(goalPlacement(null, -1)).toBe('on the left')
    expect(goalPlacement({ dx: NaN, dy: 0 }, 1)).toBe('on the right')
  })
})

describe('projectToScreen', () => {
  const identity = () => ({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] })
  const rect = { left: 10, top: 20, width: 200, height: 100 }

  it('maps clip space to the canvas rectangle', () => {
    const camera = { matrixWorldInverse: identity(), projectionMatrix: identity() }
    expect(projectToScreen(0, 0, 0, camera, rect)).toEqual({ x: 110, y: 70, onScreen: true })
    expect(projectToScreen(1, 1, 0, camera, rect)).toEqual({ x: 210, y: 20, onScreen: true })
    expect(projectToScreen(2, 0, 0, camera, rect).onScreen).toBe(false)
  })

  it('returns null without a camera or for points behind it', () => {
    expect(projectToScreen(0, 0, 0, null, rect)).toBeNull()
    // perspective-style w = -z: a point at z = +1 is behind the camera
    const persp = { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0] }
    const camera = { matrixWorldInverse: identity(), projectionMatrix: persp }
    expect(projectToScreen(0, 0, 1, camera, rect)).toBeNull()
    expect(projectToScreen(0, 0, -2, camera, rect)).toMatchObject({ x: 110, y: 70 })
  })
})

describe('clock hold', () => {
  it('the match clock stands still while the tutorial holds it', () => {
    useMatchStore.setState({ timerRunning: true, paused: false, phase: PHASE.SELECT, timeRemaining: 90, tutorialHold: true })
    useMatchStore.getState().tickTimer(1)
    expect(useMatchStore.getState().timeRemaining).toBe(90)
    useMatchStore.getState().setTutorialHold(false)
    useMatchStore.getState().tickTimer(1)
    expect(useMatchStore.getState().timeRemaining).toBe(89)
  })

  it('keeps the shot clock full while a coach mark waits', () => {
    expect(shotClockHoldPatch({ tutorialHold: true, shotClock: 15, shotClockRemaining: 11.2 })).toEqual({ shotClockRemaining: 15 })
    expect(shotClockHoldPatch({ tutorialHold: true, shotClock: 15, shotClockRemaining: 15 })).toBeNull()
    expect(shotClockHoldPatch({ tutorialHold: false, shotClock: 15, shotClockRemaining: 3 })).toBeNull()
    expect(shotClockHoldPatch({ tutorialHold: true, shotClock: 0, shotClockRemaining: 0 })).toBeNull() // shot clock off
    expect(shotClockHoldPatch({ tutorialHold: true })).toBeNull() // no shot clock in this build
  })
})
