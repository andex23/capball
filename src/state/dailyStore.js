/**
 * Daily challenge progress: today's attempts, the streak of days in a row
 * it's been beaten, and the best streak (which unlocks a rare cap).
 */
import { create } from 'zustand'
import { dayKey, nextStreak, previousDay, challengeFor, challengeBodies } from '../game/daily'
import { useMatchStore } from './MatchStore'
import { setPendingBodies } from './savedMatch'
import { setStreakSource } from './unlocks'
import { isSignedIn } from './accountStore'
import { useAchievementStore } from './achievementStore'

export const DAILY_KEY = 'capball:daily:v1'
const EMPTY = { lastDone: null, streak: 0, best: 0, tries: {} }

const read = () => {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(DAILY_KEY) || 'null') || {}) } } catch { return { ...EMPTY } }
}
const write = (v) => { try { localStorage.setItem(DAILY_KEY, JSON.stringify(v)) } catch { /* ignore */ } }

export const useDailyStore = create((set, get) => ({
  ...read(),

  /** Count an attempt at today's challenge (and whether it was beaten). */
  finish(won) {
    const today = dayKey()
    const s = get()
    const tries = { [today]: { tries: (s.tries[today]?.tries || 0) + 1, won: !!(s.tries[today]?.won || won) } }
    const streak = won ? nextStreak(s, today) : { lastDone: s.lastDone, streak: s.streak, best: s.best }
    const next = { ...streak, tries }
    write(next)
    set(next)
    if (next.streak >= 7) useAchievementStore.getState().award(['daily7'])
  },
}))

/** Start (or restart) today's challenge. */
export function playDaily() {
  if (!isSignedIn()) return false
  const c = challengeFor(dayKey())
  setPendingBodies(challengeBodies(c))
  useMatchStore.getState().startChallenge(c)
}

/** The streak as it stands today (it lapses if yesterday was missed). */
export function liveStreak(s = useDailyStore.getState()) {
  const today = dayKey()
  return s.lastDone === today || s.lastDone === previousDay(today) ? s.streak : 0
}

setStreakSource(() => useDailyStore.getState().best)
