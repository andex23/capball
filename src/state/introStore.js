/**
 * The "how this mode works" cards: shown once, the first time someone opens a
 * mode they've never played. Players who already play a mode never get them
 * popped up (they're marked as seen the first time we check), but anyone can
 * open them from the mode's "?".
 */
import { create } from 'zustand'
import { getSaveStorage as storage } from '../utils/playerSave'
import { MODE_INTROS } from '../data/modeIntros'
import { allFixtures, teamById } from '../game/tournament'
import { useCareerStore } from './careerStore'
import { useTournamentStore } from './tournamentStore'
import { useRewardsStore } from './rewardsStore'
import { useDailyStore } from './dailyStore'
import { useSavedStore } from './savedMatch'

export const INTRO_KEY = 'capball:intros:v1'

const read = () => {
  try {
    const v = JSON.parse(storage()?.getItem(INTRO_KEY) || 'null')
    return v && typeof v.seen === 'object' && v.seen ? Object.fromEntries(Object.entries(v.seen).filter(([k, x]) => MODE_INTROS[k] && x === true)) : {}
  } catch { return {} }
}
const write = (seen) => { try { storage()?.setItem(INTRO_KEY, JSON.stringify({ seen })) } catch { /* blocked */ } }

/**
 * Has this player already played the mode? Then they don't need the cards popped up.
 * facts: { career, hall, tournamentHistory, localTournament, cupsWon, daily, matchHistory }
 */
export function playedBefore(mode, f) {
  switch (mode) {
    case 'career': return !!f.career || (f.hall || []).length > 0
    case 'tournament': return (f.tournamentHistory || []).length > 0 || !!(f.localTournament && !f.localTournament.weekly)
    // (a cup only counts once you've played in it: starting one isn't playing it)
    case 'weekly': return (f.cupsWon || []).length > 0 || (!!f.localTournament?.weekly && playedIn(f.localTournament))
    case 'daily': return !!f.daily?.lastDone || (f.daily?.best || 0) > 0 || Object.keys(f.daily?.tries || {}).length > 0
    case 'local': return (f.matchHistory || []).some((h) => h?.mode === 'local' && !h.tournament)
    default: return true
  }
}

/** Has a human side played a match in this tournament yet? */
const playedIn = (t) => allFixtures(t).some((x) => x.result && [x.home, x.away].some((id) => teamById(t, id)?.cpu === false))

function facts() {
  const ts = useTournamentStore.getState()
  return {
    career: useCareerStore.getState().career,
    hall: useCareerStore.getState().hall,
    tournamentHistory: ts.history,
    localTournament: ts.local,
    cupsWon: useRewardsStore.getState().cups,
    daily: useDailyStore.getState(),
    matchHistory: useSavedStore.getState().history,
  }
}

export const useIntroStore = create((set, get) => ({
  seen: read(),
  open: null,     // the mode whose cards are showing
  then: null,     // what to do once they're closed

  /** Opening a mode: show its cards if this player has never played it. Returns true when they're showing. */
  maybeShow(mode, then = null) {
    const { seen, open } = get()
    if (!MODE_INTROS[mode] || open || seen[mode]) return false
    if (playedBefore(mode, facts())) { get()._mark(mode); return false }
    set({ open: mode, then })
    return true
  },

  /** The "?": show a mode's cards again. */
  show(mode) {
    if (MODE_INTROS[mode]) set({ open: mode, then: null })
  },

  close() {
    const { open, then } = get()
    if (open) get()._mark(open)
    set({ open: null, then: null })
    then?.()
  },

  _mark(mode) {
    const seen = { ...get().seen, [mode]: true }
    write(seen)
    set({ seen })
  },
}))
