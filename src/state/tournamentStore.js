/**
 * Tournaments in the app: the one on this device, online ones from the
 * database, the winners' history, and the fixture being played right now.
 *
 * The rules live in game/tournament.js; this file wires them to storage,
 * the online API and the match store. A fixture is played with the normal
 * match flow — this store sets the two teams up beforehand, records the
 * result when the match ends, and puts the player's own set-up back after.
 */

import { create } from 'zustand'
import { useMatchStore, SCREEN, DEFAULT_TEAM_CONFIG } from './MatchStore'
import {
  createTournament, recordResult, settleCpu, applyResults, sanitizeTournament, historyEntry,
  teamById, readyFixtures,
} from '../game/tournament'
import { api } from '../online/supabase'
import { createRoom, joinRoom, disconnect, isConnected } from '../multiplayer/MultiplayerManager'
import { useCareerStore } from './careerStore'

const STORAGE_KEY = 'capball:tournaments:v1'
const HISTORY_MAX = 30
const RECENT_MAX = 10

// Prefs a tournament fixture borrows, given back afterwards
const BORROWED = ['teamConfig', 'formations', 'gameMode', 'aiTeam', 'aiDifficulty', 'matchDuration', 'goalTarget', 'chosenTeam1Side', 'team1Side']

const storage = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

function load() {
  const empty = { local: null, history: [], recentOnline: [], seenChampions: [] }
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw || raw.length > 400_000) return empty
    const data = JSON.parse(raw)
    return {
      local: sanitizeTournament(data.local),
      history: Array.isArray(data.history) ? data.history.filter((h) => h && typeof h.id === 'string' && h.champion?.name).slice(0, HISTORY_MAX) : [],
      recentOnline: Array.isArray(data.recentOnline)
        ? data.recentOnline.filter((r) => r && /^[A-Z0-9]{6}$/.test(r.code)).slice(0, RECENT_MAX) : [],
      seenChampions: Array.isArray(data.seenChampions) ? data.seenChampions.filter((x) => typeof x === 'string').slice(-50) : [],
    }
  } catch {
    return empty
  }
}

function save(state) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify({
      local: state.local,
      history: state.history,
      recentOnline: state.recentOnline,
      seenChampions: state.seenChampions,
    }))
  } catch { /* storage full or blocked: progress lasts this session */ }
}

/** Match kit for a tournament team. */
function kitFor(team, side) {
  const base = DEFAULT_TEAM_CONFIG[side]
  return {
    name: team.name,
    primary: team.primary,
    edge: team.edge,
    textColor: team.textColor || '',
    skirtColor: team.skirtColor || '',
    badge: team.badge || 'none',
    pattern: team.pattern || 'none',
    finish: team.finish || 'matte',
    capText: team.capText || '',
    showName: team.showName !== false,
    numbers: { ...base.numbers, ...(team.numbers || {}) },
  }
}

/** The fixture's result from the match store's point of view (team1 = home). */
export function resultFromMatch(matchResult, knockout) {
  if (!matchResult?.score) return null
  const result = { home: matchResult.score.team1, away: matchResult.score.team2 }
  if (matchResult.penaltyScore) result.pens = { home: matchResult.penaltyScore.team1, away: matchResult.penaltyScore.team2 }
  // A cup tie that ends level isn't finished until the shootout
  if (knockout && result.home === result.away && !result.pens) return null
  return result
}

export const useTournamentStore = create((set, get) => ({
  ...load(),

  // Online tournament on screen: { code, snapshot, tournament, loading, error }
  online: null,
  // Which tournament the hub shows, and which kind the set-up screen makes
  hubKind: 'local',
  setupKind: 'local',
  // Format picked on the menu (League or Cup) for the next new tournament
  setupFormat: 'knockout',
  setSetupFormat(f) { set({ setupFormat: f === 'league' ? 'league' : 'knockout' }) },
  // Fixture being played: { kind: 'local' | 'online', code?, fixture, knockout, live?, recorded? }
  playing: null,
  stash: null,
  busy: false,
  error: null,

  /* ── This device ── */

  /** Open the set-up screen for a tournament on this device or online. */
  startSetup(kind) {
    set({ setupKind: kind === 'online' ? 'online' : 'local', error: null })
    useMatchStore.getState().goToScreen(SCREEN.TOURNAMENT_SETUP)
  },

  /** Show a tournament's hub. */
  openHub(kind) {
    set({ hubKind: kind === 'online' ? 'online' : 'local', error: null })
    useMatchStore.getState().goToScreen(SCREEN.TOURNAMENT_HUB)
  },

  createLocal({ format, legs, teams, matchDuration }) {
    const t = settleCpu(createTournament({ format, legs, teams, matchDuration }))
    set({ local: t, error: null, hubKind: 'local' })
    get().noteChampion(t)
    save(get())
    return t
  },

  abandonLocal() {
    set({ local: null })
    save(get())
  },

  /** Remember a won tournament once (winners' history). */
  noteChampion(t) {
    if (!t?.championId || get().seenChampions.includes(t.id)) return
    const entry = historyEntry(t)
    if (!entry) return
    set((s) => ({ history: [entry, ...s.history].slice(0, HISTORY_MAX), seenChampions: [...s.seenChampions, t.id].slice(-50) }))
    save(get())
  },

  /* ── Online ── */

  async createOnline({ format, legs, teams, matchDuration }) {
    set({ busy: true, error: null })
    try {
      const t = createTournament({ format, legs, teams, matchDuration })
      const { code } = await api.create(t)
      // Seats the host picked as theirs
      for (let i = 0; i < teams.length; i++) {
        if (teams[i].mine && !teams[i].cpu) await api.claim(code, t.teams[i].id)
      }
      get().rememberOnline(code, t)
      await get().openOnline(code)
      return code
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ busy: false })
    }
  },

  rememberOnline(code, t) {
    const label = t ? `${t.format === 'league' ? 'League' : 'Cup'} · ${t.teams.length} teams` : 'Tournament'
    set((s) => ({ recentOnline: [{ code, label, at: Date.now() }, ...s.recentOnline.filter((r) => r.code !== code)].slice(0, RECENT_MAX) }))
    save(get())
  },

  forgetOnline(code) {
    set((s) => ({ recentOnline: s.recentOnline.filter((r) => r.code !== code) }))
    save(get())
  },

  /** Load (or reload) an online tournament by code. */
  async openOnline(code, { quiet = false } = {}) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!quiet) set({ hubKind: 'online', online: { code: clean, snapshot: null, tournament: null, loading: true, error: null } })
    try {
      const snapshot = await api.get(clean)
      const start = sanitizeTournament(snapshot.setup)
      if (!start) throw new Error('That tournament can’t be read by this version of the game.')
      const tournament = applyResults(start, snapshot.results)
      if (get().online?.code !== clean && quiet) return // switched away meanwhile
      set({ online: { code: clean, snapshot, tournament, loading: false, error: null } })
      get().rememberOnline(clean, tournament)
      get().noteChampion(tournament)
      return tournament
    } catch (e) {
      set((s) => ({ online: { ...(s.online || { code: clean }), loading: false, error: e.message } }))
      throw e
    }
  },

  closeOnlineView() { set({ online: null }) },

  async claimSeat(teamId) {
    const code = get().online?.code
    if (!code) return
    set({ busy: true, error: null })
    try { await api.claim(code, teamId); await get().openOnline(code, { quiet: true }) }
    catch (e) { set({ error: e.message }) }
    finally { set({ busy: false }) }
  },

  async releaseSeat(teamId) {
    const code = get().online?.code
    if (!code) return
    set({ busy: true, error: null })
    try { await api.release(code, teamId); await get().openOnline(code, { quiet: true }) }
    catch (e) { set({ error: e.message }) }
    finally { set({ busy: false }) }
  },

  /* ── Playing a fixture ── */

  /** Teams this device controls in the tournament on screen. */
  myTeams(kind) {
    if (kind === 'local') {
      const t = get().local
      return t ? t.teams.filter((x) => !x.cpu).map((x) => x.id) : []
    }
    return (get().online?.snapshot?.seats || []).filter((s) => s.mine).map((s) => s.teamId)
  },

  /** Set the match up for a fixture played on this device (vs CPU or pass-and-play). */
  playFixture(kind, fixture) {
    const t = kind === 'local' ? get().local : kind === 'career' ? useCareerStore.getState().career?.league : get().online?.tournament
    if (!t) return
    const home = teamById(t, fixture.home)
    const away = teamById(t, fixture.away)
    if (!home || !away) return
    const ms = useMatchStore.getState()
    const stash = get().stash || Object.fromEntries(BORROWED.map((k) => [k, ms[k]]))
    const cpuSide = home.cpu ? 'team1' : away.cpu ? 'team2' : null
    const cpuTeam = home.cpu ? home : away.cpu ? away : null
    set({ stash, playing: { kind, code: kind === 'online' ? get().online?.code : undefined, fixture: { id: fixture.id, home: fixture.home, away: fixture.away }, knockout: t.format === 'knockout', recorded: false } })
    useMatchStore.setState({
      teamConfig: { team1: kitFor(home, 'team1'), team2: kitFor(away, 'team2') },
      gameMode: cpuSide ? 'ai' : 'local',
      aiTeam: cpuSide || ms.aiTeam,
      aiDifficulty: cpuTeam?.difficulty || ms.aiDifficulty,
      matchDuration: t.matchDuration || ms.matchDuration,
      chosenTeam1Side: 'left',
      team1Side: 'left',
      formations: { team1: 'default', team2: 'default' },
    })
    useMatchStore.getState().goToScreen(SCREEN.FORMATION)
  },

  /**
   * Live online fixture between two devices. The home side opens a room and
   * posts its code; the away side joins it from the hub.
   */
  async hostLiveFixture(fixture) {
    const { online } = get()
    if (!online) return
    const t = online.tournament
    const home = teamById(t, fixture.home)
    const away = teamById(t, fixture.away)
    const ms = useMatchStore.getState()
    set({
      busy: true, error: null,
      stash: get().stash || Object.fromEntries(BORROWED.map((k) => [k, ms[k]])),
      playing: { kind: 'online', code: online.code, fixture: { id: fixture.id, home: fixture.home, away: fixture.away }, knockout: t.format === 'knockout', live: 'hosting', recorded: false },
    })
    useMatchStore.setState({
      teamConfig: { team1: kitFor(home, 'team1'), team2: kitFor(away, 'team2') },
      matchDuration: t.matchDuration || ms.matchDuration,
      chosenTeam1Side: 'left', team1Side: 'left',
      formations: { team1: 'default', team2: 'default' },
    })
    try {
      const room = await createRoom()
      await api.setRoom(online.code, fixture.id, fixture.home, room)
    } catch (e) {
      set({ error: e.message || 'Couldn’t open a match room.' })
      get().cancelLive()
    } finally {
      set({ busy: false })
    }
  },

  async joinLiveFixture(fixture, roomCode) {
    const { online } = get()
    if (!online) return
    const ms = useMatchStore.getState()
    set({
      busy: true, error: null,
      stash: get().stash || Object.fromEntries(BORROWED.map((k) => [k, ms[k]])),
      playing: { kind: 'online', code: online.code, fixture: { id: fixture.id, home: fixture.home, away: fixture.away }, knockout: online.tournament.format === 'knockout', live: 'joining', recorded: false },
    })
    try {
      await joinRoom(roomCode)
      // The host moves both phones on to the formation screen once connected
    } catch (e) {
      set({ error: e.message || 'Couldn’t join that match.' })
      get().cancelLive()
    } finally {
      set({ busy: false })
    }
  },

  /** Stop waiting for a live match (or give up joining). */
  cancelLive() {
    const p = get().playing
    if (p?.live === 'hosting' && get().online) {
      api.setRoom(get().online.code, p.fixture.id, p.fixture.home, null).catch(() => {})
    }
    if (isConnected() || useMatchStore.getState().gameMode === 'online') disconnect()
    get().restore()
  },

  /** Record the finished fixture (once). Called when the match store has a result. */
  async recordPlayed(matchResult) {
    const p = get().playing
    if (!p || p.recorded) return
    const result = resultFromMatch(matchResult, p.knockout)
    if (!result) return
    set({ playing: { ...p, recorded: true } })
    if (p.kind === 'career') {
      useCareerStore.getState().record(p.fixture.id, result)
      return
    }
    if (p.kind === 'local') {
      const t = get().local
      if (!t) return
      const after = settleCpu(recordResult(t, p.fixture.id, result))
      set({ local: after })
      save(get())
      get().noteChampion(after)
      return
    }
    try {
      await api.report(p.code, p.fixture, result)
    } catch (e) {
      // The other phone in a live match usually gets there first: fine
      if (e.code !== 'already-reported') {
        set({ error: `Couldn’t save the result: ${e.message}`, playing: { ...get().playing, recorded: false } })
        return
      }
    }
    get().openOnline(p.code, { quiet: true }).catch(() => {})
  },

  /** Retry saving a result that failed (e.g. no signal at full time). */
  retryRecord() {
    const mr = useMatchStore.getState().matchResult
    if (mr) get().recordPlayed(mr)
  },

  /** Give the player's own match set-up back and leave tournament play. */
  restore() {
    const { stash } = get()
    if (stash) useMatchStore.setState({ ...stash, gameMode: stash.gameMode === 'online' ? 'local' : stash.gameMode })
    set({ stash: null, playing: null })
  },

  /** From the full-time screen (or a cancelled set-up) back to the hub. */
  backToHub() {
    const p = get().playing
    if (useMatchStore.getState().gameMode === 'online' || isConnected()) disconnect()
    useMatchStore.getState().quitMatch(p?.kind === 'career' ? SCREEN.CAREER : SCREEN.TOURNAMENT_HUB)
    get().restore()
    if (p?.kind === 'online' && p.code) get().openOnline(p.code, { quiet: true }).catch(() => {})
  },
}))

/** Is a tournament fixture being set up or played right now? */
export const inTournamentPlay = () => !!useTournamentStore.getState().playing

/** Ready fixtures this device can act on, best first. */
export function actionableFixtures(t, mine) {
  return readyFixtures(t).filter((f) => mine.includes(f.home) || mine.includes(f.away))
}

let wired = false
/**
 * Watch the match store: record results as matches finish, and move a live
 * online fixture on to the formation screen once both phones are connected.
 */
export function initTournamentWatch() {
  if (wired) return
  wired = true
  useMatchStore.subscribe((s, prev) => {
    const ts = useTournamentStore.getState()
    const p = ts.playing
    if (!p) return
    if (s.matchResult && s.matchResult !== prev.matchResult) ts.recordPlayed(s.matchResult)
    // Host of a live fixture: opponent connected → straight to formations
    if (p.live === 'hosting' && s.onlineStatus?.status === 'connected' && prev.onlineStatus?.status !== 'connected') {
      useTournamentStore.setState({ playing: { ...p, live: 'connected' } })
      api.setRoom(p.code, p.fixture.id, p.fixture.home, null).catch(() => {})
      useMatchStore.getState().goToScreen(SCREEN.FORMATION)
    }
    if (p.live === 'joining' && s.onlineStatus?.status === 'connected' && prev.onlineStatus?.status !== 'connected') {
      useTournamentStore.setState({ playing: { ...p, live: 'connected' } })
    }
  })
}
