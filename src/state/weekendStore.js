/**
 * The Weekend Cup (Lagos Life): your runs this weekend, the match being
 * played, the shared table, and Monday's result. Rules in game/weekendRules.js.
 *
 * Runs are kept on the phone and sent to our server after every match, which
 * checks them and keeps the table. A match left before full time doesn't
 * count either way: you play that round again.
 */
import { create } from 'zustand'
import { getSaveStorage as storage } from '../utils/playerSave'
import { useMatchStore, SCREEN } from './MatchStore'
import { kitFor } from './tournamentStore'
import { useLagosStore } from '../lagos/lagosStore'
import { useRewardsStore } from './rewardsStore'
import {
  weekendKey, lastWeekendKey, isOpen, weekendClubs, runOver, runComplete, cleanRun, RUNS,
} from '../game/weekendCup'

export const WEEKEND_KEY = 'capball:weekend:v1'
// Settings a Weekend Cup match borrows, given back afterwards
const BORROWED = ['stadium', 'tableFinish', 'teamConfig', 'formations', 'gameMode', 'aiTeam', 'aiDifficulty', 'matchDuration', 'goalTarget', 'chosenTeam1Side', 'team1Side']
const MATCH_SECONDS = 120

function clean(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const runs = Array.isArray(r.runs) ? r.runs.slice(0, RUNS).map((x) => cleanRun(x) || []) : []
  return {
    key: typeof r.key === 'string' ? r.key : null,
    runs,
    // Weekends you played, so Monday knows to show a result: { [key]: true }
    played: r.played && typeof r.played === 'object' ? Object.fromEntries(Object.entries(r.played).slice(-8)) : {},
    // Results already shown (and prizes paid): { [key]: rank }
    shown: r.shown && typeof r.shown === 'object' ? Object.fromEntries(Object.entries(r.shown).slice(-8)) : {},
    // Runs that got through all five and were paid for: 'key:run'
    paid: Array.isArray(r.paid) ? r.paid.filter((x) => typeof x === 'string').slice(-12) : [],
  }
}

function load() {
  try { return clean(JSON.parse(storage()?.getItem(WEEKEND_KEY) || 'null')) } catch { return clean(null) }
}

/** The run you're on (index) and the round next up, or null when all three runs are done. */
export function nextUp(runs) {
  const i = runs.length && !runOver(runs[runs.length - 1]) ? runs.length - 1 : runs.length
  if (i >= RUNS) return null
  return { run: i, round: (runs[i] || []).length }
}

export const useWeekendStore = create((set, get) => ({
  ...load(),
  playing: null, // { run, round } while a Weekend Cup match is on
  stash: null,
  table: null, // { players, top, me }
  tableAt: 0,
  error: null,

  _save() {
    const { key, runs, played, shown, paid } = get()
    try { storage()?.setItem(WEEKEND_KEY, JSON.stringify({ key, runs, played, shown, paid })) } catch { /* blocked */ }
  },

  /** A new weekend starts with no runs. */
  roll(now = Date.now()) {
    const key = weekendKey(now)
    if (get().key === key) return
    set({ key, runs: [], table: null })
    get()._save()
  },

  async refreshTable() {
    try {
      const t = await useLagosStore.getState().weekend('weekendTable')
      set({ table: { players: t.players, top: t.top, me: t.me }, tableAt: Date.now(), error: null })
    } catch { set({ error: 'Couldn’t load the table. Check your connection.' }) }
  },

  /** Kick off the next round. */
  play() {
    get().roll()
    if (!isOpen()) return false
    const up = nextUp(get().runs)
    if (!up) return false
    const club = weekendClubs(get().key)[up.round]
    const ms = useMatchStore.getState()
    const stash = get().stash || Object.fromEntries(BORROWED.map((k) => [k, ms[k]]))
    const mine = { ...ms.teamConfig.team1 }
    set({ playing: up, stash })
    useMatchStore.setState({
      teamConfig: { team1: mine, team2: kitFor(club, 'team2') },
      gameMode: 'ai',
      aiTeam: 'team2',
      aiDifficulty: club.difficulty,
      matchDuration: MATCH_SECONDS,
      goalTarget: null,
      chosenTeam1Side: 'left',
      team1Side: 'left',
      formations: { team1: ms.formations?.team1 || 'default', team2: 'default' },
    })
    useMatchStore.getState().goToScreen(SCREEN.FORMATION)
    return true
  },

  /**
   * Full time (after penalties, for a draw): record it, send it, and go back to
   * the Weekend Cup. `result` is the match store's matchResult.
   */
  finish(result) {
    const p = get().playing
    if (!p || !result) return
    const gf = result.score?.team1 ?? 0
    const ga = result.score?.team2 ?? 0
    const pens = gf === ga ? (result.penaltyScore && result.penaltyScore.team1 > result.penaltyScore.team2 ? 'won' : 'lost') : null
    const runs = get().runs.map((r) => [...r])
    runs[p.run] = [...(runs[p.run] || []), { gf, ga, pens }]
    set({ runs, played: { ...get().played, [get().key]: true } })
    get()._save()
    // Got through all five: ₦100k, once a run
    const id = `${get().key}:${p.run}`
    if (runComplete(runs[p.run]) && !get().paid.includes(id)) {
      set({ paid: [...get().paid, id] })
      get()._save()
      useRewardsStore.getState().weekendRun(get().key)
    }
    get().send(p.run)
    get().leave()
  },

  /** Back to the Weekend Cup screen, with your own settings back. */
  leave() {
    const { stash } = get()
    if (stash) useMatchStore.setState({ ...stash })
    set({ playing: null, stash: null })
    useMatchStore.getState().quitMatch(SCREEN.WEEKEND)
  },

  /** Send a run to the server (it keeps the table). Tries again once if it fails. */
  async send(run, tries = 2) {
    const name = useLagosStore.getState().player?.name || 'Player'
    try {
      const t = await useLagosStore.getState().weekend('weekendSubmit', { key: get().key, run: run + 1, matches: get().runs[run], name })
      set({ table: { players: t.players, top: t.top, me: t.me }, tableAt: Date.now(), error: null })
    } catch {
      if (tries > 1) setTimeout(() => get().send(run, tries - 1), 4000)
      else set({ error: 'Your result is saved on this phone; the table will catch up.' })
    }
  },

  /** Monday: where you finished last weekend, once (prizes for the top three). */
  async checkLast(now = Date.now()) {
    const last = lastWeekendKey(now)
    if (!get().played[last] || get().shown[last] !== undefined) return
    try {
      const t = await useLagosStore.getState().weekend('weekendTable', { which: 'last' })
      if (!t.me) return
      set({ shown: { ...get().shown, [last]: t.me.rank } })
      get()._save()
      useRewardsStore.getState().weekendResult({ key: last, rank: t.me.rank, players: t.players, points: t.me.points })
    } catch { /* try again next time */ }
  },
}))

export const inWeekendPlay = () => !!useWeekendStore.getState().playing

// Left a Weekend Cup match some other way (the pause menu, or back from the formation
// screen): it doesn't count, your own settings come back, and that round is played again
const MATCH_SCREENS = [SCREEN.FORMATION, SCREEN.PLAYING, SCREEN.MATCH_END]
useMatchStore.subscribe((s, prev) => {
  const w = useWeekendStore.getState()
  if (!w.playing || s.screen === prev.screen || MATCH_SCREENS.includes(s.screen)) return
  const { stash } = w
  useWeekendStore.setState({ playing: null, stash: null })
  if (stash) useMatchStore.setState({ ...stash })
})
