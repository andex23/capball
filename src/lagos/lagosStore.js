/**
 * Counterball inside Lagos Life: who the player is, their win count on the
 * Lagos Life leaderboard, pause/resume from the host app, and the friend
 * match they're in. The game itself is untouched — this only listens to the
 * match store and talks to the SDK.
 */
import { create } from 'zustand'
import { loadSdk, sdkMessage } from './sdk'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useAccountStore } from '../state/accountStore'
import { holdAudio } from '../audio/SoundManager'
import { startMenuMusic, stopMenuMusic } from '../audio/MusicManager'
import { holdIosAudio } from './iosAudio'

const SCORE_GAP_MS = 21_000 // the SDK takes one score every 20 s
const winsKey = (playerId) => `counterball:lagos:wins:${playerId}`

const storage = () => { try { return globalThis.localStorage ?? null } catch { return null } }
const readWins = (playerId) => { const n = Number(storage()?.getItem(winsKey(playerId))); return Number.isInteger(n) && n > 0 ? n : 0 }
const writeWins = (playerId, n) => { try { storage()?.setItem(winsKey(playerId), String(n)) } catch { /* blocked in the frame: the leaderboard keeps the count */ } }

/**
 * Which team the person holding this phone plays, or null when a win here
 * shouldn't count (two players on one phone, the daily challenge, replays).
 */
export function myTeamFor(state) {
  if (state.challenge) return null
  if (state.gameMode === 'ai') return state.aiTeam === 'team1' ? 'team2' : 'team1'
  if (state.gameMode === 'online') return state.onlineMyTeam || null
  return null
}

/** The leaderboard score is a running total of wins. */
export const nextWinTotal = (wins, best) => Math.max(wins || 0, best || 0) + 1

let sdk = null
let scoreTimer = null
let lastScoreAt = 0
let resultSent = new Set()

export const useLagosStore = create((set, get) => ({
  status: 'loading', // 'loading' | 'ready' | 'error'
  error: null,
  player: null,      // { id, name, avatar }
  mode: null,        // 'test' | 'live'
  wins: 0,           // total wins, as counted on this phone
  best: 0,           // what the leaderboard holds
  board: null,       // { top, me }
  boardError: null,
  match: null,       // the Lagos Life friend match, if any

  /** Load the SDK and find out who's playing. */
  async boot() {
    set({ status: 'loading', error: null })
    try {
      sdk = await loadSdk()
      const launch = await sdk.init()
      const player = launch?.player
      if (!player?.id) throw Object.assign(new Error('no player'), { code: 'error' })
      // The Lagos Life player counts as signed in for career, the daily
      // challenge and rewards. There's no Counterball account, so nothing is
      // copied to the Counterball server; progress stays on this phone.
      useAccountStore.setState({ username: player.name || 'Player', token: null })
      set({ status: 'ready', player, mode: launch.mode, wins: readWins(player.id) })
      sdk.onPause?.(() => get().pause())
      sdk.onResume?.(() => get().resume())
      sdk.match?.onUpdate?.((m) => set({ match: m || null }))
      sdk.match?.current?.().then((m) => { if (m) set({ match: m }) }).catch(() => {})
      get().loadBoard()
      return true
    } catch (e) {
      set({ status: 'error', error: sdkMessage(e) })
      return false
    }
  },

  /** The host app went to the background or opened a sheet. */
  pause() {
    const m = useMatchStore.getState()
    if (m.screen === SCREEN.PLAYING && !m.paused && m.gameMode !== 'online') m.setPaused(true)
    holdAudio(true)
    holdIosAudio(true)
    stopMenuMusic()
  },

  resume() {
    holdAudio(false)
    holdIosAudio(false)
    if (useMatchStore.getState().screen !== SCREEN.PLAYING) startMenuMusic()
    // A paused match stays paused until the player taps Resume
  },

  async loadBoard() {
    if (!sdk?.leaderboard) return
    try {
      const board = await sdk.leaderboard()
      const best = Number(board?.me?.score ?? board?.me?.best ?? 0) || 0
      set((s) => ({ board, boardError: null, best: Math.max(s.best, best) }))
    } catch (e) {
      set({ boardError: sdkMessage(e) })
    }
  },

  /** One more win: add it to the total and send it to the leaderboard. */
  addWin() {
    const { player, wins, best } = get()
    if (!player) return
    const total = nextWinTotal(wins, best)
    writeWins(player.id, total)
    set({ wins: total })
    get().sendScore()
  },

  sendScore() {
    if (scoreTimer || !sdk?.submitScore) return
    const wait = Math.max(0, lastScoreAt + SCORE_GAP_MS - Date.now())
    scoreTimer = setTimeout(async () => {
      scoreTimer = null
      lastScoreAt = Date.now()
      const n = get().wins
      try {
        const res = await sdk.submitScore(n)
        set((s) => ({ best: Math.max(s.best, Number(res?.best) || 0) }))
        get().loadBoard()
      } catch (e) {
        if (e?.code === 'too_soon' || e?.code === 'rate_limited' || e?.code === 'timeout') get().sendScore()
      }
      // More wins came in while this one was being sent
      if (get().wins > n) get().sendScore()
    }, wait)
  },

  /* ── Friend matches ── */

  async findMatch(kind, code) {
    if (!sdk?.match) throw Object.assign(new Error('off'), { code: 'not_multiplayer' })
    const m = kind === 'quick' ? await sdk.match.quick({ stake: 0 })
      : kind === 'create' ? await sdk.match.create({ stake: 0, seats: 2 })
        : await sdk.match.join(code)
    set({ match: m || null })
    return m
  },

  async leaveMatch() {
    try { await sdk?.match?.leave?.() } catch { /* already gone */ }
    set({ match: null })
  },

  /** Tell our server how the friend match ended; it posts the result to Lagos Life. */
  async sendResult(team) {
    const { match, player } = get()
    if (!match?.id || !player || resultSent.has(match.id) || match.status !== 'playing') return
    const myTeam = useMatchStore.getState().onlineMyTeam
    const other = match.players?.find((p) => p.id !== player.id)
    const winner = !team ? 'draw' : team === myTeam ? player.id : other?.id
    if (!winner) return
    resultSent.add(match.id)
    try {
      const { session } = await sdk.session()
      await fetch('/api/lagos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'result', session, matchId: match.id, winner }),
      })
    } catch { /* the other phone reports too; an unreported friendly simply expires */ }
  },
}))

/** Count wins and report friend-match results as matches end. */
export function watchMatches() {
  const counted = new Set()
  let pendingDraw = null
  return useMatchStore.subscribe((m, prev) => {
    const lagos = useLagosStore.getState()
    // A drawn friend match can go to penalties; report the draw only once that's not happening
    if (pendingDraw && m.screen !== prev.screen && m.screen !== SCREEN.MATCH_END && !(m.screen === SCREEN.PLAYING && m.penaltyShootout)) {
      pendingDraw = null
      lagos.sendResult(null)
    }
    if (m.screen !== SCREEN.MATCH_END || prev.screen === SCREEN.MATCH_END || !m.matchResult) return
    const team = myTeamFor(m)
    const winner = m.matchResult.winner
    const key = `${m.matchKey}:${winner}`
    if (team && winner === team && !counted.has(key)) { counted.add(key); lagos.addWin() }
    if (m.gameMode === 'online' && lagos.match) {
      if (winner) { pendingDraw = null; lagos.sendResult(winner) }
      else pendingDraw = true
    }
  })
}

/** For tests. */
export function _resetLagos() { sdk = null; clearTimeout(scoreTimer); scoreTimer = null; lastScoreAt = 0; resultSent = new Set() }
export function _setSdk(s) { sdk = s }
