import { create } from 'zustand'
import { useAccountStore } from './accountStore'
import { useMatchStore, SCREEN, PHASE, clearMatchTimers } from './MatchStore'
import { deviceToken } from '../online/supabase'
import { applyBodySnapshot } from '../physics/PhysicsWorld'
import { playbackTime, playbackDuration } from '../game/replay'

export async function anytimeRequest(action, data = {}) {
  const token = useAccountStore.getState().token
  if (!token) throw new Error('Sign in to save and resume online matches.')
  const response = await fetch('/api/anytime', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, action, token }), signal: AbortSignal.timeout(25000),
  })
  let result
  try { result = await response.json() } catch { throw new Error('The saved-match server is unavailable. Try again later.') }
  if (!response.ok) {
    const error = new Error(result.message || 'Could not load the saved match.')
    error.code = result.error
    throw error
  }
  return result
}
const pendingKey = code => `capball.turn.${useAccountStore.getState().username}.${code}`
function readPending(code) { try { return JSON.parse(localStorage.getItem(pendingKey(code))) } catch { return null } }
function clearPending(code) { try { localStorage.removeItem(pendingKey(code)) } catch { /* best effort */ } }
let viewEpoch = 0
let playback = null
let stash = null
let needsPositions = false

function ready(match) {
  const s = match.state
  useMatchStore.setState({
    phase: s.complete ? PHASE.MATCH_OVER : match.status === 'active' && !readPending(match.code) ? PHASE.SELECT : PHASE.KICKOFF,
    teamConfig: match.config.teams, formations: match.config.formations,
    activeTeam: s.activeTeam, score: s.score, kickoffGuard: s.kickoffGuard, goalKickGuard: s.goalKickGuard,
    freeKickCapId: s.freeKickCapId, penaltyKick: s.penaltyKick, penaltyShootout: s.shootout,
    penaltyKicks: s.penaltyKicks, penaltyScores: s.penaltyScores,
    selectedCapId: null, dragPower: 0, goalDecision: s.lastTurn?.decision || null,
  })
  needsPositions = true
}
function accept(match, animate = false) {
  const pending = readPending(match.code)
  if (pending && match.version > pending.version) clearPending(match.code)
  useAnytimeStore.setState({ match, error: null, pending: readPending(match.code) })
  if (animate && match.state.lastTurn) startPlayback(match)
  else { playback = null; useAnytimeStore.setState({ watching: false }); ready(match) }
}
function startPlayback(match, replayOnly = false) {
  const turn = match.state.lastTurn
  if (!turn?.frames?.length) return
  playback = { turn, elapsed: 0, duration: (turn.frames.length - 1) * turn.frameSeconds, replayOnly }
  useAnytimeStore.setState({ watching: true })
  useMatchStore.setState({ phase: PHASE.RESOLVE, selectedCapId: null, dragPower: 0 })
}

export const useAnytimeStore = create((set, get) => ({
  matches: [], match: null, busy: false, loading: false, error: null, pending: null, watching: false,
  async list() {
    const token = useAccountStore.getState().token
    set({ loading: true, error: null })
    try {
      const matches = await anytimeRequest('list')
      if (token === useAccountStore.getState().token) set({ matches })
    } catch (e) { set({ error: e.message }) }
    finally { set({ loading: false }) }
  },
  async open(action, data) {
    if (get().busy) return
    const epoch = ++viewEpoch
    set({ busy: true, error: null })
    try {
      const match = await anytimeRequest(action, data)
      if (epoch !== viewEpoch) return
      const ms = useMatchStore.getState()
      stash = Object.fromEntries(['teamConfig', 'formations', 'gameMode', 'team1Side', 'onlineMyTeam', 'stadium'].map(k => [k, ms[k]]))
      clearMatchTimers()
      useMatchStore.setState({ gameMode: 'anytime', onlineMyTeam: match.myTeam, screen: SCREEN.PLAYING,
        teamConfig: match.config.teams, formations: match.config.formations, team1Side: 'left',
        paused: false, replaying: false, challenge: null, matchKey: ms.matchKey + 1, stadium: 'arena',
      })
      accept(match)
    } catch (e) { if (epoch === viewEpoch) set({ error: e.message }) }
    finally { if (epoch === viewEpoch) set({ busy: false }) }
  },
  openFixture(code, fixtureId) { return get().open('fixture', { code, fixtureId, deviceToken: deviceToken() }) },
  async refresh() {
    const { match, busy, watching } = get()
    if (!match || busy || watching) return
    const epoch = viewEpoch
    try {
      const next = await anytimeRequest('get', { code: match.code })
      if (epoch !== viewEpoch || get().busy || get().watching) return
      if (next.version !== match.version) accept(next, !!next.state.lastTurn && !next.state.forfeited)
      else set({ error: null })
    } catch (e) { if (epoch === viewEpoch) set({ error: e.message }) }
  },
  async submit(capId, velocity) {
    const { match, busy, watching, pending } = get()
    if (!match || busy || watching || pending || match.status !== 'active' || match.myTeam !== match.state.activeTeam) return
    const request = { code: match.code, version: match.version, requestId: crypto.randomUUID(), move: { capId, velocity } }
    try { localStorage.setItem(pendingKey(match.code), JSON.stringify(request)) }
    catch { set({ error: 'Allow browser storage before sending a turn so interrupted submissions can be recovered.' }); return }
    set({ pending: request })
    await get().retry()
  },
  async retry() {
    const { pending, busy } = get()
    if (!pending || busy) return
    const epoch = viewEpoch
    set({ busy: true, error: null })
    useMatchStore.setState({ phase: PHASE.KICKOFF, selectedCapId: null, dragPower: 0 })
    try {
      const match = await anytimeRequest('turn', pending)
      clearPending(pending.code)
      if (epoch === viewEpoch) { set({ pending: null }); accept(match, !match.state.forfeited) }
    } catch (e) {
      if (epoch !== viewEpoch) return
      // A definite rejection is safe to discard; an uncertain network response
      // keeps exactly the same request id for a retry, including after reload.
      if (e.code && e.code !== 'server-unavailable') {
        clearPending(pending.code); set({ pending: null })
        ready(get().match)
      }
      set({ error: e.message || 'Connection interrupted. Retry to confirm this turn; it will not be played twice.' })
    } finally { if (epoch === viewEpoch) set({ busy: false }) }
  },
  async resign() {
    if (get().busy || !get().match) return
    const epoch = viewEpoch
    set({ busy: true })
    try {
      const match = await anytimeRequest('resign', { code: get().match.code })
      if (epoch === viewEpoch) accept(match)
    } catch (e) { set({ error: e.message }) }
    finally { if (epoch === viewEpoch) set({ busy: false }) }
  },
  replay() { if (!get().busy && !get().watching) startPlayback(get().match, true) },
  skip() { playback = null; set({ watching: false }); if (get().match) ready(get().match) },
  leave() {
    ++viewEpoch; playback = null; needsPositions = false
    clearMatchTimers()
    useMatchStore.setState({ ...stash, gameMode: ['anytime', 'online'].includes(stash?.gameMode) ? 'local' : stash?.gameMode || 'local',
      screen: SCREEN.ANYTIME, phase: PHASE.SELECT, paused: false, replaying: false, selectedCapId: null })
    stash = null
    set({ match: null, busy: false, watching: false, pending: null, error: null })
  },
}))

/** Positions from the server only: the browser never resolves an anytime turn. */
export function tickAnytime(delta) {
  const { match } = useAnytimeStore.getState()
  if (!match || useMatchStore.getState().paused) return
  if (!playback) {
    if (needsPositions) { applyBodySnapshot(match.state.bodies); needsPositions = false }
    return
  }
  const p = playback
  p.elapsed += Math.min(delta, 0.1)
  const decision = !!p.turn.decision
  const normal = p.replayOnly ? 0 : p.duration
  const replayStart = normal + (p.replayOnly ? 0 : 1)
  const celebrate = !p.replayOnly && p.turn.decision?.outcome === 'goal' && p.elapsed >= normal && p.elapsed < replayStart
  const phase = celebrate ? PHASE.GOAL : PHASE.RESOLVE
  if (useMatchStore.getState().phase !== phase) useMatchStore.setState({ phase, lastGoalOwn: false, replaying: false })
  const total = decision || p.replayOnly ? replayStart + playbackDuration(p.duration) + 1 : normal + 0.25
  let time = Math.min(p.elapsed, p.duration)
  if (p.elapsed >= replayStart && (decision || p.replayOnly)) time = playbackTime(p.elapsed - replayStart, 0, p.duration)
  const at = Math.min(p.turn.frames.length - 1, Math.max(0, time / p.turn.frameSeconds))
  const a = p.turn.frames[Math.floor(at)], b = p.turn.frames[Math.min(Math.floor(at) + 1, p.turn.frames.length - 1)], k = at % 1
  applyBodySnapshot(Object.fromEntries(Object.entries(a).map(([id, xy]) => [id, [xy[0] + (b[id][0] - xy[0]) * k, xy[1] + (b[id][1] - xy[1]) * k]])))
  if (p.elapsed >= total) useAnytimeStore.getState().skip()
}
