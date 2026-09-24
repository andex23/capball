/**
 * First-match tutorial as a small pure step machine.
 *
 * The UI (src/ui/Tutorial.jsx) turns store phase changes into events with
 * phaseEvent() and feeds them to tutorialReducer(). Nothing here touches the
 * DOM or the store, so every transition is unit tested directly.
 */

import { PHASE } from '../state/MatchStore'
import { teamHomeDir } from './rules'

export const STEP = {
  PRESS: 'press', // point at the kicker cap: press and drag back
  AIM: 'aim', // explain the arrow / ball line while aiming
  WATCH: 'watch', // flick in progress — nothing shown until it resolves
  FOUL: 'foul', // hit the ball first
  GOAL: 'goal', // which goal to attack
  READY: 'ready', // good luck
  DONE: 'done',
}

/** Steps that show a coach mark (WATCH and DONE show nothing). */
export const VISIBLE_STEPS = [STEP.PRESS, STEP.AIM, STEP.FOUL, STEP.GOAL, STEP.READY]

/** What "Next" moves on to. */
const NEXT = {
  [STEP.PRESS]: STEP.AIM,
  [STEP.AIM]: STEP.FOUL,
  [STEP.WATCH]: STEP.FOUL,
  [STEP.FOUL]: STEP.GOAL,
  [STEP.GOAL]: STEP.READY,
  [STEP.READY]: STEP.DONE,
}

/**
 * Game events that move the tutorial on by themselves. Each explanation stays
 * up until the player does the thing it leads into, so an opponent's turn
 * ending can never whisk a card away mid-read:
 *   first flick resolves → fouls; player's turn comes round again → scoring;
 *   player starts aiming → "you're ready"; player flicks (or a few s pass) → done.
 */
const ON_EVENT = {
  aimStart: { [STEP.PRESS]: STEP.AIM, [STEP.GOAL]: STEP.READY },
  aimCancel: { [STEP.AIM]: STEP.PRESS },
  flick: { [STEP.PRESS]: STEP.WATCH, [STEP.AIM]: STEP.WATCH, [STEP.READY]: STEP.DONE },
  turnEnd: { [STEP.WATCH]: STEP.FOUL },
  myTurn: { [STEP.WATCH]: STEP.FOUL, [STEP.FOUL]: STEP.GOAL },
  timeout: { [STEP.READY]: STEP.DONE },
}

/** A fresh tutorial for the team the player controls. */
export function startTutorial(team) {
  return { step: STEP.PRESS, team }
}

export function isActive(tut) {
  return !!tut && tut.step !== STEP.DONE
}

/**
 * Advance the tutorial. Returns the same object when the event doesn't apply,
 * so callers can skip a re-render with a simple identity check.
 *
 * Events: { type: 'next' | 'skip' | 'aimStart' | 'aimCancel' | 'flick' | 'turnEnd' | 'myTurn' | 'timeout' | 'matchOver' }
 */
export function tutorialReducer(tut, event) {
  if (!tut || tut.step === STEP.DONE || !event) return tut
  let step
  if (event.type === 'skip' || event.type === 'matchOver') step = STEP.DONE
  else if (event.type === 'next') step = NEXT[tut.step]
  else step = ON_EVENT[event.type]?.[tut.step]
  return step && step !== tut.step ? { ...tut, step } : tut
}

/**
 * Translate a store change into a tutorial event (or null).
 * Aiming and flicking only count for the tutorial's team, so a CPU or a
 * second local player lining up doesn't move the player's coach marks on.
 */
export function phaseEvent(prev, next, team) {
  if (!prev || !next || prev.phase === next.phase) return null
  const mine = next.activeTeam === team
  if (next.phase === PHASE.MATCH_OVER) return { type: 'matchOver' }
  // The player's turn starting again (after the opponent's flick, a set piece, a kick-off…)
  if (mine && next.phase === PHASE.SELECT && prev.phase !== PHASE.AIM) return { type: 'myTurn' }
  if (prev.phase === PHASE.RESOLVE) return { type: 'turnEnd' }
  if (next.phase === PHASE.AIM) return mine ? { type: 'aimStart' } : null
  if (prev.phase === PHASE.AIM && next.phase === PHASE.SELECT) return mine ? { type: 'aimCancel' } : null
  if (next.phase === PHASE.RESOLVE) return mine ? { type: 'flick' } : null
  return null
}

/**
 * Should the tutorial start now? Only for a human-controlled turn in a local
 * or vs-CPU match (never online, never a shootout, never for the CPU), and
 * only while the player's turn is starting.
 */
export function shouldAutoStart(state, done) {
  if (done || !state) return false
  if (state.gameMode !== 'local' && state.gameMode !== 'ai') return false
  if (state.penaltyShootout) return false
  if (state.gameMode === 'ai' && state.activeTeam === state.aiTeam) return false
  return state.phase === PHASE.KICKOFF || state.phase === PHASE.SELECT
}

/**
 * While a coach mark holds play, the per-turn shot clock must not run down.
 * The store's shot clock ticks on its own, so this returns the patch that
 * tops it back up (or null when nothing needs doing — including builds
 * without a shot clock).
 */
export function shotClockHoldPatch(state) {
  if (!state?.tutorialHold || !state.shotClock) return null
  if (!(state.shotClockRemaining < state.shotClock)) return null
  return { shotClockRemaining: state.shotClock }
}

/** +1 when `team` attacks the right-hand (world +x) goal, -1 for the left. */
export function attackDir(team, team1Side = 'left') {
  return -teamHomeDir(team, team1Side)
}

/**
 * Words for where a goal is on screen, from the screen-space offset between
 * the pitch centre and that goal (dy grows downwards). On phones the pitch is
 * turned upright, so "right" can become "top". Without a projection, fall
 * back to the world direction (the landscape view).
 */
export function goalPlacement(screenDelta, worldDir) {
  if (screenDelta && Number.isFinite(screenDelta.dx) && Number.isFinite(screenDelta.dy)
    && (screenDelta.dx !== 0 || screenDelta.dy !== 0)) {
    const { dx, dy } = screenDelta
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'on the right' : 'on the left'
    return dy > 0 ? 'at the bottom' : 'at the top'
  }
  return worldDir > 0 ? 'on the right' : 'on the left'
}

/** Coach-mark copy for a step. */
export function stepCopy(step, { goalWhere = 'ahead' } = {}) {
  switch (step) {
    case STEP.PRESS:
      return { title: 'Your cap', body: 'This is your cap. Press on it and drag BACK, like a slingshot.' }
    case STEP.AIM:
      return { title: 'Aim', body: 'The arrow shows where your cap goes; the dotted line is where the ball will go. Let go to flick.' }
    case STEP.FOUL:
      return { title: 'Fouls', body: 'Hit the ball first — touching an opponent’s cap first is a foul.' }
    case STEP.GOAL:
      return { title: 'Scoring', body: `Score in the goal ${goalWhere}.` }
    case STEP.READY:
      return { title: 'You’re ready!', body: 'Good luck.' }
    default:
      return null
  }
}

/* ── "Tutorial done" flag ──
   localStorage can be missing or throw (private mode, blocked storage), so
   every access is guarded and an in-memory flag keeps it from re-running
   within the same session when storage doesn't work. */
export const STORAGE_KEY = 'capball.tutorialDone'
let memoryDone = false
const listeners = new Set()

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function isTutorialDone(storage = defaultStorage()) {
  if (memoryDone) return true
  try {
    return storage?.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialDone(storage = defaultStorage()) {
  memoryDone = true
  try {
    storage?.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage unavailable — the in-memory flag still stops a repeat this session
  }
}

/** "Replay tutorial": clear the flag and tell a running match to start it again. */
export function rearmTutorial(storage = defaultStorage()) {
  memoryDone = false
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored to clear
  }
  listeners.forEach((fn) => fn())
}

/** Subscribe to re-arming; returns an unsubscribe function. */
export function onTutorialRearm(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
