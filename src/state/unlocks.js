/**
 * What the player has earned, gathered from career totals, career mode,
 * tournaments and the daily challenge — and which rare caps that unlocks.
 */
import { useSavedStore } from './savedMatch'
import { useCareerStore } from './careerStore'
import { useTournamentStore } from './tournamentStore'
import { RARE_DESIGNS, isUnlocked } from '../data/TeamOptions'
import { useAccountStore, isSignedIn } from './accountStore'

const SEEN_KEY = 'capball:unlocks-seen:v1'
let dailyStreak = () => 0
/** The daily challenge reports its best streak here. */
export function setStreakSource(fn) { dailyStreak = fn }

export function currentProgress() {
  // Rewards are for signed-in players
  if (!isSignedIn()) return { won: 0, goalsFor: 0, cleanSheets: 0, promotions: 0, titles: 0, cups: 0, streak: 0 }
  const totals = useSavedStore.getState().career || {}
  const career = useCareerStore.getState().career
  const cups = useTournamentStore.getState().history?.length || 0
  return {
    won: totals.won || 0,
    goalsFor: totals.goalsFor || 0,
    cleanSheets: totals.cleanSheets || 0,
    promotions: career?.promotions || 0,
    titles: career?.titles || 0,
    cups,
    streak: dailyStreak() || 0,
  }
}

/** React hook: the progress object, refreshed when any source changes. */
export function useProgress() {
  useAccountStore((s) => s.username)
  useSavedStore((s) => s.career)
  useCareerStore((s) => s.career)
  useTournamentStore((s) => s.history)
  return currentProgress()
}

const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] } }

/** Rare designs unlocked since the player last looked, marking them seen. */
export function takeNewUnlocks() {
  const p = currentProgress()
  const seen = new Set(readSeen())
  const fresh = RARE_DESIGNS.filter((d) => isUnlocked(d, p) && !seen.has(d.key))
  if (fresh.length) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((d) => d.key)])) } catch { /* ignore */ }
  }
  return fresh
}
