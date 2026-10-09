/**
 * Career mode in the app: the saved career, starting one, recording your
 * results and moving on a season. Matches are played through the normal
 * tournament fixture flow (tournamentStore.playFixture with kind 'career').
 */
import { create } from 'zustand'
import { newCareer, recordCareerResult, finishSeason, sanitizeCareer, seasonOver } from '../game/career'

export const CAREER_KEY = 'capball:career-mode:v1'

const storage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }

function load() {
  try {
    const raw = storage()?.getItem(CAREER_KEY)
    return raw ? sanitizeCareer(JSON.parse(raw)) : null
  } catch { return null }
}

function save(career) {
  try {
    if (career) storage()?.setItem(CAREER_KEY, JSON.stringify(career))
    else storage()?.removeItem(CAREER_KEY)
  } catch { /* storage full or blocked */ }
}

export const useCareerStore = create((set, get) => ({
  career: load(),

  start(club, matchDuration) {
    const career = newCareer(club, { matchDuration })
    save(career)
    set({ career })
  },

  /** Your result for one fixture (home/away goals, as the tournament engine counts them). */
  record(fixtureId, result) {
    const { career } = get()
    if (!career) return
    const next = recordCareerResult(career, fixtureId, result)
    save(next)
    set({ career: next })
  },

  /** The season's over: see it into the record books and start the next. */
  nextSeason() {
    const { career } = get()
    if (!career || !seasonOver(career.league)) return
    const next = finishSeason(career)
    save(next)
    set({ career: next })
  },

  /** Change the club's kit or name between matches. */
  updateClub(patch) {
    const { career } = get()
    if (!career) return
    const club = { ...career.club, ...patch }
    const teams = career.league.teams.map((t) => (t.id === 'T1' ? { ...t, ...patch } : t))
    const next = { ...career, club, league: { ...career.league, teams } }
    save(next)
    set({ career: next })
  },

  retire() {
    save(null)
    set({ career: null })
  },
}))
