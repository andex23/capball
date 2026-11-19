/**
 * Which "What's new" items this player has seen, kept on the phone (and
 * with their account). The first time the game runs, everything already
 * shipped counts as seen: only what's new from then on lights up the bell.
 */
import { getSaveStorage as storage } from '../utils/playerSave'
import { create } from 'zustand'
import { UPDATES } from '../data/updates'

export const INBOX_KEY = 'capball:inbox-seen:v1'

function load() {
  try {
    const raw = storage()?.getItem(INBOX_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      return { seen: Array.isArray(d.seen) ? d.seen.filter((x) => typeof x === 'string').slice(-400) : [], since: typeof d.since === 'string' ? d.since : null }
    }
  } catch { /* fall through */ }
  // First run: the updates already out aren't news to a new player. Saved
  // straight away, so updates shipped later still count as new.
  const first = { seen: UPDATES.map((u) => `update:${u.id}`), since: new Date().toISOString().slice(0, 10) }
  try { storage()?.setItem(INBOX_KEY, JSON.stringify(first)) } catch { /* blocked */ }
  return first
}

export const useInboxStore = create((set, get) => ({
  ...load(),
  persist() {
    const { seen, since } = get()
    try { storage()?.setItem(INBOX_KEY, JSON.stringify({ seen, since })) } catch { /* blocked */ }
  },
  /** Mark these item ids as seen. */
  markSeen(ids) {
    const seen = [...new Set([...get().seen, ...ids])].slice(-400)
    if (seen.length === get().seen.length && seen.every((id, i) => id === get().seen[i])) return
    set({ seen })
    get().persist()
  },
}))
