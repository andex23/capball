/**
 * Save a match half-way and carry on later — and a short history of finished
 * matches. Both live in localStorage, so a signed-in player's account copies
 * them across phones along with the rest of the save (see accountStore).
 */
import { create } from 'zustand'
import { useMatchStore, SCREEN, PHASE, INPUT_PHASES, clearMatchTimers } from './MatchStore'
import { useTournamentStore } from './tournamentStore'
import { snapshotBodies, applyBodySnapshot, stopAllBodies } from '../physics/PhysicsWorld'
import { formatClock } from '../game/rules'

export const SAVED_MATCH_KEY = 'capball:savedMatch:v1'
export const HISTORY_KEY = 'capball:history:v1'
const HISTORY_MAX = 20

// Everything about the match set-up and its progress that a save brings back
const MATCH_FIELDS = [
  'gameMode', 'aiTeam', 'aiDifficulty', 'teamConfig', 'ballColor', 'stadium', 'formations',
  'matchDuration', 'goalTarget', 'shotClock', 'timeRemaining', 'half', 'firstHalfKicker',
  'team1Side', 'chosenTeam1Side', 'score', 'stats', 'activeTeam', 'lastScorer',
]

const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }
const read = (key) => { try { const raw = store()?.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null } }
const write = (key, v) => {
  try { if (v == null) store()?.removeItem(key); else store()?.setItem(key, JSON.stringify(v)) } catch { /* full or blocked */ }
}

/** Short description of a saved match, e.g. "Lions 1–0 Tigers · 2nd half 0:45". */
export function describeSave(save) {
  if (!save?.match) return ''
  const m = save.match
  const names = `${m.teamConfig?.team1?.name || 'Home'} ${m.score?.team1 ?? 0}–${m.score?.team2 ?? 0} ${m.teamConfig?.team2?.name || 'Away'}`
  const when = m.goalTarget ? `first to ${m.goalTarget}` : `${m.half === 2 ? '2nd' : '1st'} half ${formatClock(Math.max(0, Math.round(m.timeRemaining || 0)))}`
  return `${names} · ${when}`
}

export const useSavedStore = create(() => ({
  saved: read(SAVED_MATCH_KEY),
  history: Array.isArray(read(HISTORY_KEY)) ? read(HISTORY_KEY) : [],
}))

/** Why the match on screen can't be saved right now, or null if it can. */
export function cantSaveReason() {
  const s = useMatchStore.getState()
  if (s.gameMode === 'online') return 'Online matches can’t be saved.'
  if (s.penaltyShootout) return 'A shootout can’t be saved — finish it!'
  const p = useTournamentStore.getState().playing
  if (p && p.kind !== 'local') return 'Online tournament matches can’t be saved.'
  if (s.screen !== SCREEN.PLAYING || ![...INPUT_PHASES, PHASE.KICKOFF].includes(s.phase)) return 'Wait for the caps to stop, then save.'
  return null
}

/** Save the match on screen (one slot: a new save replaces the old one). */
export function saveCurrentMatch() {
  if (cantSaveReason()) return false
  const s = useMatchStore.getState()
  const ts = useTournamentStore.getState()
  const save = {
    v: 1,
    savedAt: new Date().toISOString(),
    match: Object.fromEntries(MATCH_FIELDS.map((k) => [k, s[k]])),
    bodies: snapshotBodies(),
    tournament: ts.playing ? { playing: ts.playing, stash: ts.stash } : null,
  }
  write(SAVED_MATCH_KEY, save)
  useSavedStore.setState({ saved: save })
  return true
}

export function deleteSavedMatch() {
  write(SAVED_MATCH_KEY, null)
  useSavedStore.setState({ saved: null })
}

// Positions to put the caps back to once the match scene has built its world
let pendingBodies = null

/** Called by the scene right after it lays out a fresh world. */
export function applyPendingBodies() {
  if (!pendingBodies) return
  applyBodySnapshot(pendingBodies)
  stopAllBodies()
  pendingBodies = null
}

/** Pick the saved match back up where it was left. */
export function resumeSavedMatch() {
  const save = useSavedStore.getState().saved
  if (!save?.match) return false
  clearMatchTimers()
  if (save.tournament?.playing) {
    useTournamentStore.setState({ playing: { ...save.tournament.playing, recorded: false }, stash: save.tournament.stash || null })
  }
  pendingBodies = save.bodies || null
  const s = useMatchStore.getState()
  useMatchStore.setState({
    ...save.match,
    screen: SCREEN.PLAYING,
    matchKey: s.matchKey + 1,
    phase: PHASE.SELECT,
    selectedCapId: null,
    lastFlickedCapId: null,
    freeKickCapId: null,
    foulData: null,
    restart: null,
    kickoffGuard: false,
    timerRunning: !save.match.goalTarget,
    paused: false,
    matchResult: null,
    penaltyShootout: false,
    shotClockRemaining: save.match.shotClock,
  })
  deleteSavedMatch()
  return true
}

/** Remember a finished match (newest first). */
export function recordHistory(result, mode) {
  if (!result?.score) return
  const s = useMatchStore.getState()
  const kit = (t) => ({ name: s.teamConfig[t]?.name || t, primary: s.teamConfig[t]?.primary || '#888888' })
  const entry = {
    at: new Date().toISOString(),
    mode,
    team1: kit('team1'),
    team2: kit('team2'),
    score: { ...result.score },
    pens: result.penaltyScore ? { ...result.penaltyScore } : null,
    tournament: !!useTournamentStore.getState().playing,
  }
  const history = [entry, ...useSavedStore.getState().history].slice(0, HISTORY_MAX)
  write(HISTORY_KEY, history)
  useSavedStore.setState({ history })
}

/** Keep the history up to date as matches finish. */
export function initSavedMatches() {
  useMatchStore.subscribe((m, prev) => {
    if (m.screen === SCREEN.MATCH_END && prev.screen !== SCREEN.MATCH_END) recordHistory(m.matchResult, m.gameMode)
  })
}
