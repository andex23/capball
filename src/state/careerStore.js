/**
 * Career mode in the app: the saved career, starting one, recording your
 * results and moving on a season. Matches are played through the normal
 * tournament fixture flow (tournamentStore.playFixture with kind 'career').
 */
import { create } from 'zustand'
import { CAREER_MODES, CAREER_DIFFICULTIES, newCareer, recordCareerResult, recordCupResult, finishSeason, sanitizeCareer, seasonOver, cupPending, swapLineup, signSponsor, buildFacility, setTickets } from '../game/career'
import { makeBid, sellTo, releasePlayer, loanOut, promoteYouth, releaseYouth, promoteReserve } from '../game/transfers'
import { afterMatch, renewContract, scoutPlayer, rejectOffer, hallEntry, sanitizeHall, HOF_KEY, negotiateContract, setTraining, setListed } from '../game/clubLife'
import { TRAINING } from '../game/club'
import { allFixtures } from '../game/tournament'
import { applyMatchToSquad, applyMatchByPlayer } from '../game/squad'
import { useAccountStore } from './accountStore'
import { useAchievementStore } from './achievementStore'

export const CAREER_KEY = 'capball:career-mode:v1'

const storage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }

function load() {
  try {
    const raw = storage()?.getItem(CAREER_KEY)
    return raw ? sanitizeCareer(JSON.parse(raw)) : null
  } catch { return null }
}

function loadHall() {
  try { return sanitizeHall(JSON.parse(storage()?.getItem(HOF_KEY) || '[]')) } catch { return [] }
}

function saveHall(hall) {
  try { storage()?.setItem(HOF_KEY, JSON.stringify(hall)) } catch { /* storage full or blocked */ }
}

/** The matchday report to show next: your result, the written commentary, and the round it was in. */
function withReport(career, fixtureId, result, perf, competition) {
  const t = competition === 'cup' ? career.cup?.tournament : career.league
  const f = t ? allFixtures(t).find((x) => x.id === fixtureId) : null
  if (!f) return career
  return {
    ...career,
    lastMatch: { fixtureId, competition, round: f.round, home: f.home, away: f.away, result, story: perf?.story || [], seen: false, season: career.season },
  }
}

/** Everyone who played: tired; everyone who didn't: rested. */
function withFitness(career, before, perf) {
  const ids = perf?.byPlayer ? Object.keys(perf.byPlayer) : Object.values(before.squad || {}).map((p) => p.id)
  return afterMatch(career, ids)
}

function save(career) {
  try {
    if (career) storage()?.setItem(CAREER_KEY, JSON.stringify(career))
    else storage()?.removeItem(CAREER_KEY)
  } catch { /* storage full or blocked */ }
}

/**
 * Put one match's performances into the squad: by player when we know who
 * played when (substitutes), else by role. Keeps a report for the screens.
 */
function withPerformance(career, perf, seed, fixtureId) {
  if (perf?.byPlayer) {
    const r = applyMatchByPlayer(career.squad, career.bench, perf.byPlayer, seed, TRAINING[career.biz?.training || 0]?.xp || 1)
    const played = Object.entries(perf.byPlayer).map(([id, v]) => ({ id, ...v }))
    const motm = played.slice().sort((a, b) => (b.rating - a.rating) || ((b.goals || 0) - (a.goals || 0)))[0]?.id || null
    return { ...career, squad: r.squad, bench: r.bench, lastReport: { fixtureId, players: played, motmId: motm, changes: r.changes, ratings: perf.ratings || {}, goals: perf.goalsByRole || {} } }
  }
  if (perf?.ratings) {
    const r = applyMatchToSquad(career.squad, { ...perf, seed })
    return { ...career, squad: r.squad, lastReport: { fixtureId, ratings: r.ratings, motm: r.motm, changes: r.changes, goals: perf.goalsByRole || {} } }
  }
  return career
}

export const useCareerStore = create((set, get) => ({
  career: load(),

  start(club, matchDuration, squad, mode = 'solo') {
    const career = newCareer(club, { matchDuration, squad, mode })
    save(career)
    set({ career })
    useAccountStore.getState().save({ force: true })
  },

  /** Your result for one fixture (home/away goals, as the tournament engine counts them). */
  record(fixtureId, result, perf = null) {
    const { career } = get()
    if (!career) return
    let next = recordCareerResult(career, fixtureId, result)
    next = withPerformance(next, perf, `${career.league.id}:${fixtureId}`, fixtureId)
    next = withFitness(next, career, perf)
    next = withReport(next, fixtureId, result, perf, 'league')
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
  },

  /** You've read the matchday report. */
  reportSeen() {
    const { career } = get()
    if (!career?.lastMatch || career.lastMatch.seen) return
    const next = { ...career, lastMatch: { ...career.lastMatch, seen: true } }
    save(next)
    set({ career: next })
  },

  /** Your result for a Cap Cup tie (penalties included when it went that far). */
  recordCup(fixtureId, result, perf = null) {
    const { career } = get()
    if (!career?.cup) return
    let next = recordCupResult(career, fixtureId, result)
    next = withPerformance(next, perf, `${career.cup.tournament.id}:${fixtureId}`, fixtureId)
    next = withFitness(next, career, perf)
    next = withReport(next, fixtureId, result, perf, 'cup')
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
  },

  /** The season's over: see it into the record books and start the next. */
  nextSeason() {
    const { career } = get()
    if (!career || career.sacked || !seasonOver(career.league) || cupPending(career)) return
    const next = finishSeason(career)
    const outcome = next.past[0]?.outcome
    if (outcome === 'promoted') useAchievementStore.getState().award(['promoted'])
    if (outcome === 'champions') useAchievementStore.getState().award(['premier'])
    if (next.past[0]?.cup === 'won') useAchievementStore.getState().award(['capcup'])
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
  },

  /** Switch between a solo career and playing a friend (online or LAN). */
  setMode(mode) {
    const { career } = get()
    if (!career || !CAREER_MODES.includes(mode)) return
    const next = { ...career, mode }
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
  },

  /** Career settings: time per half and the computer's level (any time; applies from the next match). */
  setSettings(patch) {
    const { career } = get()
    if (!career) return
    const next = { ...career }
    if ([60, 90, 120, 150, 180].includes(patch.matchDuration)) next.matchDuration = patch.matchDuration
    if (CAREER_DIFFICULTIES.includes(patch.difficulty)) next.difficulty = patch.difficulty
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

  /** Bid for a player in the market. Returns the club's answer ({ verdict, fee?, why? }). */
  bid(playerId, amount) {
    const { career } = get()
    if (!career) return { verdict: 'reject' }
    const { career: next, result } = makeBid(career, playerId, amount)
    if (next !== career) {
      save(next)
      set({ career: next })
      useAccountStore.getState().save({ force: true })
    }
    return result
  },

  /** Before a match: bring a bench player into the starting six. True if done. */
  swap(benchIndex, role) {
    const { career } = get()
    if (!career) return false
    const next = swapLineup(career, benchIndex, role)
    if (!next) return false
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
    return true
  },

  /** The business side: one helper for every club decision. */
  _apply(fn, ...args) {
    const { career } = get()
    if (!career) return false
    const next = fn(career, ...args)
    if (!next) return false
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
    return true
  },
  sponsor(index) { return get()._apply(signSponsor, index) },
  /** Squad moves: each returns true, or { error } saying why not. */
  _move(fn, ...args) {
    const { career } = get()
    if (!career) return { error: 'No career.' }
    const next = fn(career, ...args)
    if (!next || next.error) return next || { error: 'That can’t be done.' }
    save(next)
    set({ career: next })
    useAccountStore.getState().save({ force: true })
    return true
  },
  sell(slot, clubId) { return get()._move(sellTo, slot, clubId) },
  release(slot) { return get()._move(releasePlayer, slot) },
  loan(slot) { return get()._move(loanOut, slot) },
  promoteYouth(index) { return get()._move(promoteYouth, index) },
  renew(slot) { return get()._move(renewContract, slot) },
  train(slot, focus) { return get()._move(setTraining, slot, focus) },
  list(slot, listed) { return get()._move(setListed, slot, listed) },
  /** Offer a contract: true when he signs, else { error, wants } (the tries still count). */
  negotiate(slot, years, wageX) {
    const { career } = get()
    if (!career) return { error: 'No career.' }
    const r = negotiateContract(career, slot, years, wageX)
    const next = r && !r.error ? r : r?.career
    if (next) {
      save(next)
      set({ career: next })
      useAccountStore.getState().save({ force: true })
    }
    return r && !r.error ? true : { error: r?.error || 'That can’t be done.', wants: r?.wants }
  },
  scout(playerId) { return get()._move(scoutPlayer, playerId) },
  rejectOffer(playerId) { return get()._move(rejectOffer, playerId) },
  releaseYouth(index) { return get()._move(releaseYouth, index) },
  build(kind) { return get()._apply(buildFacility, kind) },
  tickets(level) { return get()._apply(setTickets, level) },
  promote(reserveIndex, slot) { return get()._apply(promoteReserve, reserveIndex, slot) },

  /** Every career you've finished (retired or sacked), newest first. */
  hall: loadHall(),

  /** End this career (retire, or start again after the sack); it goes into the Hall of Fame. */
  retire() {
    const { career, hall } = get()
    if (career && ((career.past || []).length > 0 || career.sacked)) {
      const next = [hallEntry(career, career.sacked ? 'sacked' : 'retired'), ...hall].slice(0, 20)
      saveHall(next)
      set({ hall: next })
    }
    save(null)
    set({ career: null })
    useAccountStore.getState().save({ force: true })
  },
}))
