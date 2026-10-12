/**
 * Counterball inside Lagos Life: who the player is, their win count on the
 * Lagos Life leaderboard, pause/resume from the host app, and the friend
 * match they're in. The game itself is untouched — this only listens to the
 * match store and talks to the SDK.
 */
import { create } from 'zustand'
import { loadSdk, sdkMessage } from './sdk'
import { useMatchStore, SCREEN, DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { useAccountStore, collectSave, applySave } from '../state/accountStore'
import { holdAudio } from '../audio/SoundManager'
import { startMenuMusic, stopMenuMusic } from '../audio/MusicManager'
import { holdIosAudio } from './iosAudio'
import { isProduct, productIdFor, naira } from '../data/shop'
import { platformHooks } from '../platformHooks'
import { switchSaveTo, ownKit } from './ownership'
import { currentProgress } from '../state/unlocks'

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

/** Stakes a player can pick for a bet with a friend (in-game naira; 0 is a free match). */
export const STAKES = [0, 100, 500, 1000, 5000]
/** Lagos Life keeps 5% of the pot; the winner gets the rest. */
export const potFor = (stake) => Math.floor(stake * 2 * 0.95)

/** Our server (api/lagos.js), with a fresh Lagos Life session. */
async function server(body) {
  const { session } = await sdk.session()
  const res = await fetch('/api/lagos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, session }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Couldn’t reach the game server. Try again.'), { code: data?.error || 'server' })
  return data
}
const claiming = new Set()
const unclaimed = new Map() // purchaseId -> productId, paid but not unlocked yet
const FINAL_CLAIM_ERRORS = new Set(['bad-purchase', 'refunded'])
let retryTimer = null
/** Try paid-but-locked purchases again every 15 seconds until they unlock. */
function retryClaims(get) {
  if (retryTimer) return
  retryTimer = setTimeout(async () => {
    retryTimer = null
    for (const [purchaseId, productId] of [...unclaimed]) await get().claim(purchaseId, productId)
  }, 15_000)
}
let cloudReady = false
let cloudSaving = null
let lastCloud = ''
let autosaveOn = false

/** Save to the server after every match, every minute if something changed, and when the game is put away. */
function startCloudAutosave(save) {
  if (autosaveOn || typeof window === 'undefined') return
  autosaveOn = true
  setInterval(save, 60_000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save() })
  useMatchStore.subscribe((m, prev) => { if (m.screen === SCREEN.MATCH_END && prev.screen !== SCREEN.MATCH_END) setTimeout(save, 3000) })
}

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
  owned: [],         // product ids of caps bought (from our server)
  buying: null,      // product id being bought right now
  shopNote: null,    // { tone: 'good' | 'bad', text }
  betNote: null,     // { stake, outcome: 'won' | 'lost' | 'refund' } after a bet settles
  justBought: null,  // { productId, state: 'done' | 'pending' | 'failed', text } shows the purchase note

  /** Is this cap design bought? */
  owns: (designKey) => get().owned.includes(productIdFor(designKey)),

  /** Load the SDK and find out who's playing. */
  async boot() {
    set({ status: 'loading', error: null })
    try {
      sdk = await loadSdk()
      const launch = await sdk.init()
      const player = launch?.player
      if (!player?.id) throw Object.assign(new Error('no player'), { code: 'error' })
      // Each Lagos Life player has their own save on a shared phone
      if (switchSaveTo(player.id) && typeof location !== 'undefined') { location.reload(); return false }
      // The Lagos Life player counts as signed in for career, the daily
      // challenge and rewards. There's no Counterball account, so nothing is
      // copied to the Counterball server; progress stays on this phone.
      useAccountStore.setState({ username: player.name || 'Player', token: null })
      set({ status: 'ready', player, mode: launch.mode, wins: readWins(player.id) })
      sdk.onPause?.(() => get().pause())
      sdk.onResume?.(() => get().resume())
      sdk.match?.onUpdate?.((m) => {
        const before = get().match
        set({ match: m || null })
        // A bet settled: say what it came to
        if (m && Number(m.stake) > 0 && ['done', 'void', 'cancelled'].includes(m.status) && before?.id === m.id && before.status !== m.status && before.status === 'playing') {
          set({ betNote: { stake: Number(m.stake), outcome: m.status !== 'done' || !m.winner || m.winner === 'draw' ? 'refund' : m.winner === player.id ? 'won' : 'lost', at: Date.now() } })
        }
      })
      sdk.match?.current?.().then((m) => { if (m) set({ match: m }) }).catch(() => {})
      get().loadBoard()
      // Progress follows the player, not the phone
      if (await get().loadCloudSave()) return false
      // Caps bought before: from our server, and any paid but not yet unlocked
      get().loadOwned()
      sdk.onPurchase?.((p) => get().claim(p?.purchaseId, p?.productId))
      sdk.purchases?.().then((list) => { for (const p of list || []) get().claim(p?.purchaseId, p?.productId) }).catch(() => {})
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

  /* ── Cloud save: earned progress follows the player ── */

  /**
   * Bring this player's save from our server. Returns true when the page is
   * reloading to start from it. Uploads only start once we know what the
   * server has, so a fresh phone never overwrites a real save.
   */
  async loadCloudSave() {
    try {
      const { data } = await server({ action: 'loadSave' })
      const hasCloud = data && Object.keys(data.items || {}).some((k) => k !== 'capball.device')
      if (hasCloud && applySave(data) && typeof location !== 'undefined') { location.reload(); return true }
      lastCloud = hasCloud ? JSON.stringify(collectSave()) : ''
      cloudReady = true
      if (!hasCloud) get().saveCloud()
      startCloudAutosave(() => get().saveCloud())
    } catch { /* server not set up yet: progress stays on this phone for now */ }
    return false
  },

  async saveCloud() {
    if (!cloudReady) return
    // One upload at a time; a save asked for meanwhile runs right after
    if (cloudSaving) { await cloudSaving; return get().saveCloud() }
    const data = collectSave()
    const json = JSON.stringify(data)
    if (json === lastCloud) return
    cloudSaving = (async () => {
      try { await server({ action: 'putSave', data }); lastCloud = json } catch { /* try again next time */ }
    })()
    try { await cloudSaving } finally { cloudSaving = null }
  },

  /* ── Cap shop ── */

  async loadOwned() {
    try {
      const { owned } = await server({ action: 'owned' })
      if (Array.isArray(owned)) {
        set({ owned: owned.filter(isProduct) })
        get().enforceOwnership()
      }
    } catch { /* shop not set up yet: nothing owned shows (kits are left alone) */ }
  },

  /** Take off any cap or band this player hasn't bought or earned. */
  enforceOwnership() {
    const who = { owned: get().owned, progress: currentProgress() }
    const m = useMatchStore.getState()
    for (const team of ['team1', 'team2']) {
      const fixed = ownKit(m.teamConfig[team], DEFAULT_TEAM_CONFIG[team], who)
      if (fixed) m.setTeamConfig(team, { ...fixed, art: fixed.art })
    }
  },

  /**
   * Unlock a paid cap (our server checks it with Lagos Life first). The
   * purchase note shows how it went: complete, paid and still unlocking
   * (retried by itself until it works), or failed.
   */
  async claim(purchaseId, productId = null) {
    if (!purchaseId || claiming.has(purchaseId)) return false
    claiming.add(purchaseId)
    try {
      const r = await server({ action: 'claim', purchaseId })
      unclaimed.delete(purchaseId)
      set({ owned: Array.isArray(r.owned) ? r.owned.filter(isProduct) : [...new Set([...get().owned, r.productId])], justBought: { productId: r.productId, state: 'done', at: Date.now() } })
      get().enforceOwnership()
      return r.productId
    } catch (e) {
      const id = productId || unclaimed.get(purchaseId) || null
      if (FINAL_CLAIM_ERRORS.has(e?.code)) {
        unclaimed.delete(purchaseId)
        set({ justBought: { productId: id, state: 'failed', text: e.message, at: Date.now() }, shopNote: { tone: 'bad', text: e.message } })
      } else {
        // Paid, but our server couldn't unlock it yet: keep trying by itself
        const first = !unclaimed.has(purchaseId)
        unclaimed.set(purchaseId, id)
        retryClaims(get)
        if (first) set({ justBought: { productId: id, state: 'pending', at: Date.now() }, shopNote: { tone: 'good', text: 'Payment received. It unlocks in a moment; no need to pay again.' } })
      }
      return false
    } finally {
      claiming.delete(purchaseId)
    }
  },

  /** Open Lagos Life's pay sheet for a cap. */
  async buy(productId, name) {
    if (!sdk?.purchase || get().buying || !isProduct(productId)) return
    set({ buying: productId, shopNote: null })
    try {
      const p = await sdk.purchase(productId)
      if (!p?.purchaseId) {
        set({ justBought: { productId, state: 'pending', at: Date.now() } })
        return
      }
      const got = await get().claim(p.purchaseId, productId)
      if (got) set({ shopNote: { tone: 'good', text: `${name} is yours. Tap it to put it on your caps.` } })
    } catch (e) {
      if (e?.code === 'owned') get().loadOwned()
      else if (e?.code !== 'cancelled') {
        const text = e?.code === 'not_for_sale' ? 'That item isn’t on sale yet.' : e?.code === 'payment_failed' ? 'The payment didn’t go through. You weren’t charged.' : sdkMessage(e)
        set({ shopNote: { tone: 'bad', text }, justBought: { productId, state: 'failed', text, at: Date.now() } })
      }
    } finally {
      set({ buying: null })
    }
  },

  clearShopNote: () => set({ shopNote: null }),

  /* ── Friend matches ── */

  async findMatch(kind, code, stake = 0) {
    if (!sdk?.match) throw Object.assign(new Error('off'), { code: 'not_multiplayer' })
    const bet = STAKES.includes(stake) ? stake : 0
    const m = kind === 'quick' ? await sdk.match.quick({ stake: bet })
      : kind === 'create' ? await sdk.match.create({ stake: bet, seats: 2 })
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
    // A bet is worth retrying; an unreported friendly simply expires
    for (let i = 0; i < (Number(match.stake) > 0 ? 4 : 1); i++) {
      try { await server({ action: 'result', matchId: match.id, winner }); return } catch { await new Promise((r) => setTimeout(r, 5000)) }
    }
  },

  /** Leaving a bet before the end: you lose it (reported now, so your friend is paid). */
  concede() {
    const { match, player } = get()
    if (!match?.id || !player || match.status !== 'playing' || !(Number(match.stake) > 0) || resultSent.has(match.id)) return
    const other = match.players?.find((p) => p.id !== player.id)
    if (!other) return
    resultSent.add(match.id)
    server({ action: 'result', matchId: match.id, winner: other.id }).catch(() => {})
  },
}))

/** Count wins and report friend-match results as matches end. */
export function watchMatches() {
  // Leaving a bet mid-match loses it, and the pause menu says so first
  platformHooks.onOnlineQuit = () => useLagosStore.getState().concede()
  platformHooks.leaveWarning = () => {
    const m = useLagosStore.getState().match
    return m?.status === 'playing' && Number(m.stake) > 0 ? `Leaving now loses your ${naira(Number(m.stake))} bet.` : null
  }
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
