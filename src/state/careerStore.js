/**
 * Career mode in the app: the saved career, starting one, recording your
 * results and moving on a season. Matches are played through the normal
 * tournament fixture flow (tournamentStore.playFixture with kind 'career').
 */
import { create } from 'zustand'
import { newCareer, recordCareerResult, finishSeason, sanitizeCareer, seasonOver, buyPlayer } from '../game/career'
import { allFixtures } from '../game/tournament'
import { useAccountStore } from './accountStore'

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
    useAccountStore.getState().save({ force: true })
  },

  /** Your result for one fixture (home/away goals, as the tournament engine counts them). */
  record(fixtureId, result) {
    const { career } = get()
    if (!career) return
    const next = recordCareerResult(career, fixtureId, result)
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
  },

  /** The season's over: see it into the record books and start the next. */
  nextSeason() {
    const { career } = get()
    if (!career || !seasonOver(career.league)) return
    const next = finishSeason(career)
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
  },

  /** Change the club's kit — only before the season's first match. */
  updateClub(patch) {
    const { career } = get()
    if (!career) return
    if (allFixtures(career.league).some((f) => f.result && (f.home === 'T1' || f.away === 'T1'))) return
    const club = { ...career.club, ...patch }
    const teams = career.league.teams.map((t) => (t.id === 'T1' ? { ...t, ...patch } : t))
    const next = { ...career, club, league: { ...career.league, teams } }
    save(next)
    set({ career: next })
  },

  /** Sign a player from the open transfer window into `role`. True if the deal went through. */
  buy(playerId, role) {
    const { career } = get()
    if (!career) return false
    const next = buyPlayer(career, playerId, role)
    if (!next) return false
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
    return true
  },

  retire() {
    save(null)
    set({ career: null })
  },
}))
