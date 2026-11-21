/**
 * Daily challenge progress: today's attempts, the streak of days in a row
 * it's been beaten, and the best streak (which unlocks a rare cap).
 */
import { getSaveStorage } from '../utils/playerSave'
import { create } from 'zustand'
import { dayKey, nextStreak, previousDay, challengeFor, challengeBodies, weekdayOf } from '../game/daily'
import { useMatchStore } from './MatchStore'
import { setPendingBodies } from './savedMatch'
import { setStreakSource } from './unlocks'
import { isSignedIn, useAccountStore } from './accountStore'
import { useAchievementStore } from './achievementStore'
import { useRewardsStore } from './rewardsStore'

export const DAILY_KEY = 'capball:daily:v1'
const EMPTY = { lastDone: null, streak: 0, best: 0, tries: {}, won: [] }

const read = () => {
  try {
    const v = { ...EMPTY, ...(JSON.parse(getSaveStorage()?.getItem(DAILY_KEY) || 'null') || {}) }
    return { ...v, won: Array.isArray(v.won) ? v.won.filter((d) => typeof d === 'string').slice(-14) : [] }
  } catch { return { ...EMPTY } }
}
const write = (v) => { try { getSaveStorage()?.setItem(DAILY_KEY, JSON.stringify(v)) } catch { /* ignore */ } }

export const useDailyStore = create((set, get) => ({
  ...read(),

  /** Count an attempt at today's challenge (and whether it was beaten). */
  finish(won) {
    const today = dayKey()
    const s = get()
    const tries = { [today]: { tries: (s.tries[today]?.tries || 0) + 1, won: !!(s.tries[today]?.won || won) } }
    const streak = won ? nextStreak(s, today) : { lastDone: s.lastDone, streak: s.streak, best: s.best }
    // The days it's been beaten (for this week's row), the last two weeks' worth
    const beaten = won && !s.won?.includes(today) ? [...(s.won || []), today].slice(-14) : s.won || []
    const next = { ...streak, tries, won: beaten }
    write(next)
    set(next)
    if (beaten !== s.won && beaten.includes(today) && weekdayOf(today) === 0) useRewardsStore.getState().sundayBonus(today)
    if (next.streak >= 7) useAchievementStore.getState().award(['daily7'])
    if (won && !s.tries[today]?.won) useRewardsStore.getState().noteMatch({ mode: 'daily', won: true, gf: 0, ga: 0 })
    else if (isSignedIn()) useAccountStore.getState().save()
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
