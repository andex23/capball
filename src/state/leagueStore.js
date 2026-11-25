/**
 * The Weekend League, before it opens: your sign-up (the club you'll play it
 * with) and how many have signed up. The sign-up is kept with the player's
 * save; in Lagos Life our server also keeps the list, for the count.
 */
import { create } from 'zustand'
import { getSaveStorage as storage } from '../utils/playerSave'
import { isLagos } from '../platform'
import { useLagosStore } from '../lagos/lagosStore'
import { useSavedStore } from './savedMatch'

export const LEAGUE_KEY = 'capball:league:v1'
const LOOK = ['primary', 'edge', 'pattern', 'badge', 'finish', 'capText', 'textColor', 'skirtColor', 'art', 'capNames']

/** A clean copy of a club: a name and the look of its caps. */
export function cleanClub(c) {
  if (!c || typeof c !== 'object') return null
  const name = typeof c.name === 'string' ? c.name.replace(/\s+/g, ' ').trim().slice(0, 18) : ''
  if (!name || typeof c.primary !== 'string' || typeof c.edge !== 'string') return null
  return { name, ...Object.fromEntries(LOOK.filter((k) => typeof c[k] === 'string').map((k) => [k, c[k]])) }
}

function load() {
  try {
    const r = JSON.parse(storage()?.getItem(LEAGUE_KEY) || 'null')
    const club = cleanClub(r?.club)
    return club ? { club, at: Number(r.at) || 0 } : null
  } catch { return null }
}

/** Your wins towards entry: Lagos Life's count there, your account's elsewhere. */
export function leagueWins() {
  if (isLagos()) {
    const l = useLagosStore.getState()
    return Math.max(l.wins || 0, l.best || 0)
  }
  return useSavedStore.getState().career?.won || 0
}

export const useLeagueStore = create((set, get) => ({
  joined: load(),
  registered: null, // how many have signed up (Lagos Life)
  error: null,

  /** Sign up with a club. */
  async join(club) {
    const c = cleanClub(club)
    if (!c) return false
    const joined = { club: c, at: Date.now() }
    try { storage()?.setItem(LEAGUE_KEY, JSON.stringify(joined)) } catch { /* blocked */ }
    set({ joined, error: null })
    globalThis.__counterballCount?.('feature', 'league_join')
    if (isLagos()) {
      try {
        const r = await useLagosStore.getState().weekend('leagueJoin', { name: c.name })
        set({ registered: r.registered })
      } catch { /* the count catches up next time */ }
    }
    return true
  },

  /** How many have signed up (Lagos Life only). */
  async refresh() {
    if (!isLagos()) return
    try {
      const r = await useLagosStore.getState().weekend('leagueInfo')
      set({ registered: r.registered })
      // Signed up on another phone: the list knows, this phone's save will follow
      if (r.me && !get().joined) set({ joined: load() })
    } catch { /* offline: no count */ }
  },
}))
