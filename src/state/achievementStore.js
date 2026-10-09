/**
 * Earned achievements (signed-in players only), the win streak and tables
 * played that some of them need, and a queue of fresh ones to announce.
 */
import { create } from 'zustand'
import { ACHIEVEMENT_IDS } from '../game/achievements'
import { isSignedIn } from './accountStore'

export const ACHIEVEMENTS_KEY = 'capball:achievements:v1'
const storage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }

function load() {
  try {
    const d = JSON.parse(storage()?.getItem(ACHIEVEMENTS_KEY) || 'null') || {}
    const earned = {}
    for (const [k, v] of Object.entries(d.earned || {})) if (ACHIEVEMENT_IDS.includes(k) && typeof v === 'string') earned[k] = v
    return {
      earned,
      winStreak: Number.isInteger(d.winStreak) && d.winStreak >= 0 ? d.winStreak : 0,
      tables: Array.isArray(d.tables) ? d.tables.filter((x) => typeof x === 'string').slice(0, 20) : [],
    }
  } catch { return { earned: {}, winStreak: 0, tables: [] } }
}

export const useAchievementStore = create((set, get) => ({
  ...load(),
  fresh: [], // just earned, waiting to be announced

  persist() {
    const { earned, winStreak, tables } = get()
    try { storage()?.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ earned, winStreak, tables })) } catch { /* blocked */ }
  },

  /** Give these achievements (only new ones count, only when signed in). Returns the new ids. */
  award(ids) {
    if (!isSignedIn()) return []
    const { earned } = get()
    const now = new Date().toISOString()
    const fresh = [...new Set(ids)].filter((id) => ACHIEVEMENT_IDS.includes(id) && !earned[id])
    if (!fresh.length) return []
    set({ earned: { ...earned, ...Object.fromEntries(fresh.map((id) => [id, now])) }, fresh: [...get().fresh, ...fresh] })
    get().persist()
    return fresh
  },

  /** Track the run of wins and the tables played; returns the values after this match. */
  noteMatch({ won, table }) {
    const winStreak = won ? get().winStreak + 1 : 0
    const tables = table && !get().tables.includes(table) ? [...get().tables, table] : get().tables
    set({ winStreak, tables })
    get().persist()
    return { winStreak, tables }
  },

  takeFresh() {
    const [first, ...rest] = get().fresh
    set({ fresh: rest })
    return first || null
  },
}))
