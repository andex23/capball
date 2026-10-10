/**
 * Save a match half-way and carry on later — and a short history of finished
 * matches. Both live in localStorage, so a signed-in player's account copies
 * them across phones along with the rest of the save (see accountStore).
 */
import { create } from 'zustand'
import { useMatchStore, SCREEN, PHASE, INPUT_PHASES, clearMatchTimers } from './MatchStore'
import { useTournamentStore } from './tournamentStore'
import { snapshotBodies, applyBodySnapshot, stopAllBodies, deOverlapBodies } from '../physics/PhysicsWorld'
import { formatClock } from '../game/rules'
import { isSignedIn } from './accountStore'
import { useAchievementStore } from './achievementStore'
import { matchAchievements } from '../game/achievements'

export const SAVED_MATCH_KEY = 'capball:savedMatch:v1'
export const HISTORY_KEY = 'capball:history:v1'
export const CAREER_KEY = 'capball:career:v1'
export const RIVALS_KEY = 'capball:rivals:v1'
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

// Running totals over every match this player has finished
export const EMPTY_CAREER = {
  played: 0, won: 0, drawn: 0, lost: 0,
  goalsFor: 0, goalsAgainst: 0, shots: 0, cleanSheets: 0,
  bestWin: null, // { for, against, vs }
  week: null,    // this week's numbers for the leaderboard: { key, played, won, goals }
  local: 0,      // pass-and-play matches (two players on one phone: no win or loss for "you")
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
  career: { ...EMPTY_CAREER, ...(read(CAREER_KEY) || {}) },
  rivals: cleanRivals(read(RIVALS_KEY)),
}))

/** Head-to-head records by opponent name: { [name]: { w, d, l, gf, ga, online, primary, last } }. */
function cleanRivals(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out
  for (const [name, r] of Object.entries(input).slice(0, 60)) {
    if (!r || typeof r !== 'object') continue
    const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0)
    out[String(name).slice(0, 24)] = { w: n(r.w), d: n(r.d), l: n(r.l), gf: n(r.gf), ga: n(r.ga), online: !!r.online, primary: typeof r.primary === 'string' ? r.primary.slice(0, 7) : '#888888', last: typeof r.last === 'string' ? r.last : '' }
  }
  return out
}

/** One more result against this opponent. Pure, for testing. */
export function addRivalResult(rivals, opponent, { gf, ga, won, lost, online, primary, at = new Date().toISOString() }) {
  const cur = rivals[opponent] || { w: 0, d: 0, l: 0, gf: 0, ga: 0, online: false, primary, last: '' }
  const next = { ...cur, gf: cur.gf + gf, ga: cur.ga + ga, online: cur.online || online, primary: primary || cur.primary, last: at }
  if (won) next.w += 1; else if (lost) next.l += 1; else next.d += 1
  const all = { ...rivals, [opponent]: next }
  // Keep the 60 most recent rivals
  return Object.fromEntries(Object.entries(all).sort((a, b) => (b[1].last > a[1].last ? 1 : -1)).slice(0, 60))
}

/** Why the match on screen can't be saved right now, or null if it can. */
export function cantSaveReason() {
  const s = useMatchStore.getState()
  if (s.gameMode === 'online') return 'Online matches can’t be saved.'
  if (s.challenge) return 'The daily challenge can’t be saved.'
  if (s.penaltyShootout) return 'A shootout can’t be saved — finish it!'
  const p = useTournamentStore.getState().playing
  if (p && p.kind === 'online') return 'Online tournament matches are played live — they can’t be saved.'
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
/** Put the caps at these positions when the next match scene builds its world. */
export function setPendingBodies(snap) { pendingBodies = snap }

export function applyPendingBodies() {
  if (!pendingBodies) return
  applyBodySnapshot(pendingBodies)
  stopAllBodies()
  deOverlapBodies()
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
    goalKickGuard: false,
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
  // Stats only count for signed-in players (they live on the account)
  if (!isSignedIn()) return
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
  const me = myTeamFor(s)
  const career = addToCareer(useSavedStore.getState().career, result, me, s.teamConfig)
  write(CAREER_KEY, career)
  useSavedStore.setState({ history, career })
  // Achievements for this match (only when it was clearly "you" playing)
  if (me) {
    const them = me === 'team1' ? 'team2' : 'team1'
    const pens = result.penaltyScore
    const won = result.score[me] > result.score[them] || (result.score[me] === result.score[them] && !!pens && pens[me] > pens[them])
    const opp = s.teamConfig[them]
    if (opp?.name) {
      const rivals = addRivalResult(useSavedStore.getState().rivals, opp.name, {
        gf: result.score[me], ga: result.score[them], won,
        lost: result.score[them] > result.score[me] || (result.score[them] === result.score[me] && !!pens && pens[them] > pens[me]),
        online: s.gameMode === 'online', primary: opp.primary,
      })
      write(RIVALS_KEY, rivals)
      useSavedStore.setState({ rivals })
    }
    const ach = useAchievementStore.getState()
    const { winStreak, tables } = ach.noteMatch({ won, table: s.stadium })
    ach.award(matchAchievements({
      me, result, goalLog: s.goalLog, matchEvents: s.matchEvents, stats: s.stats, gameMode: s.gameMode,
      aiDifficulty: s.aiDifficulty, goalTarget: s.goalTarget, streak: winStreak, tables, goalsTotal: career.goalsFor,
    }))
  }
}

/** Which side is "you" this match: null when two people shared the phone. */
function myTeamFor(s) {
  if (s.gameMode === 'online') return s.onlineMyTeam || null
  if (s.gameMode === 'ai') return s.aiTeam === 'team1' ? 'team2' : 'team1'
  return null
}

/** ISO week key for a date, e.g. '2026-W41' (weeks start on Monday). */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Career totals after one more finished match. Pure, for testing. */
export function addToCareer(prev, result, me, teamConfig = {}, now = new Date()) {
  const c = { ...EMPTY_CAREER, ...(prev || {}) }
  c.played += 1
  if (!me) { c.local += 1; return c }
  // This week's numbers (a new week starts from zero)
  const wk = weekKey(now)
  const w = c.week?.key === wk ? { ...c.week } : { key: wk, played: 0, won: 0, goals: 0 }
  w.played += 1
  w.goals += result.score?.[me] ?? 0
  const them = me === 'team1' ? 'team2' : 'team1'
  const gf = result.score?.[me] ?? 0
  const ga = result.score?.[them] ?? 0
  c.goalsFor += gf
  c.goalsAgainst += ga
  c.shots += result.stats?.[me]?.shots ?? 0
  if (ga === 0) c.cleanSheets += 1
  // A shootout decides the winner of a level match
  const pens = result.penaltyScore
  const won = gf > ga || (gf === ga && pens && pens[me] > pens[them])
  const lost = ga > gf || (gf === ga && pens && pens[them] > pens[me])
  if (won) { c.won += 1; w.won += 1 }
  else if (lost) c.lost += 1
  else c.drawn += 1
  if (gf > ga && (!c.bestWin || gf - ga > c.bestWin.for - c.bestWin.against || (gf - ga === c.bestWin.for - c.bestWin.against && gf > c.bestWin.for))) {
    c.bestWin = { for: gf, against: ga, vs: teamConfig?.[them]?.name || 'CPU' }
  }
  c.week = w
  return c
}

/** Keep the history up to date as matches finish. */
export function initSavedMatches() {
  useMatchStore.subscribe((m, prev) => {
    if (m.screen === SCREEN.MATCH_END && prev.screen !== SCREEN.MATCH_END) recordHistory(m.matchResult, m.gameMode)
  })
}
