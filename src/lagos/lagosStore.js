/**
 * Counterball inside Lagos Life: who the player is, their win count on the
 * Lagos Life leaderboard, pause/resume from the host app, and the friend
 * match they're in. The game itself is untouched — this only listens to the
 * match store and talks to the SDK.
 */
import { collectSave, getSaveStorage as storage } from '../utils/playerSave'
import { create } from 'zustand'
import { sdkMessage } from './sdk'
import { acknowledgeClaims, pendingClaims, rememberClaim } from './rewardClaims'
import { useRewardsStore, REWARDS_KEY } from '../state/rewardsStore'
import { lagosRequest, readCloudSave } from './launch'
import { useMatchStore, SCREEN, DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { useAccountStore } from '../state/accountStore'
import { holdAudio } from '../audio/SoundManager'
import { startMenuMusic, stopMenuMusic } from '../audio/MusicManager'
import { holdIosAudio } from './iosAudio'
import { isProduct, productIdFor, naira } from '../data/shop'
import { platformHooks } from '../platformHooks'
import { sendBet } from '../multiplayer/MultiplayerManager'
import { ownKit } from './ownership'
import { currentProgress } from '../state/unlocks'

const SCORE_GAP_MS = 21_000 // the SDK takes one score every 20 s
const winsKey = (playerId) => `counterball:lagos:wins:${playerId}`

const goalsKey = (playerId) => `counterball:lagos:goals:${playerId}`
const readCount = (key) => { const n = Number(storage()?.getItem(key)); return Number.isInteger(n) && n > 0 ? n : 0 }
const writeCount = (key, n) => { try { storage()?.setItem(key, String(n)) } catch { /* blocked in the frame: the leaderboard keeps the count */ } }
const readWins = (playerId) => readCount(winsKey(playerId))
const writeWins = (playerId, n) => writeCount(winsKey(playerId), n)

/*
 * The leaderboard holds one number a player. It carries wins first and goals
 * as the tie-breaker: wins × 1000 + goals (up to 999). Only wins are ever shown.
 * A number under 1000 is from before goals counted: all wins, no goals.
 */
export const GOAL_SLOT = 1000
export const boardScore = (wins, goals) => Math.max(0, wins | 0) * GOAL_SLOT + Math.min(GOAL_SLOT - 1, Math.max(0, goals | 0))
export const winsOf = (raw) => { const n = Math.max(0, Number(raw) || 0); return n >= GOAL_SLOT ? Math.floor(n / GOAL_SLOT) : n }
export const goalsOf = (raw) => { const n = Math.max(0, Number(raw) || 0); return n >= GOAL_SLOT ? n % GOAL_SLOT : 0 }
/** For ordering: older wins-only numbers read as wins with no goals. */
export const rankValue = (raw) => boardScore(winsOf(raw), goalsOf(raw))

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
let matchPoll = null
let boardCounted = false

/** Make or join the bet's match; if Lagos Life says you're already in one, leave the free match and try again. */
async function openStaked(make) {
  try { return await make() } catch (e) {
    if (e?.code === 'cancelled' || e?.code === 'limit' || e?.code === 'friendly_only' || e?.code === 'not_found' || e?.code === 'not_open') throw e
    await sdk.match.leave().catch(() => {})
    return make()
  }
}

/** A match from Lagos Life, whatever wrapper it arrives in, with players as { id, name }. */
export function normaliseMatch(raw) {
  const m = raw?.match ?? raw
  if (!m || typeof m !== 'object' || !m.id) return null
  const players = Array.isArray(m.players) ? m.players.map((p) => ({ ...p, id: p.id ?? p.playerId, name: p.name ?? p.displayName ?? 'Player' })) : []
  return { ...m, players }
}

/** Bets with a friend, in Lagos Life money (0 is a free match). */
export const BET_MIN = 10_000
export const BET_MAX = 100_000 // Lagos Life's limit per match (and ₦500,000 a day per player)
export const BET_STEP = 5_000
export const BET_PICKS = [10_000, 20_000, 50_000, 100_000]
/** A bet amount the platform accepts: whole thousands, within the limits. */
export function cleanStake(n, clamp = true) {
  const v = Math.round((Number(n) || 0) / 1000) * 1000
  return clamp ? Math.min(BET_MAX, Math.max(BET_MIN, v)) : Math.min(BET_MAX, Math.max(0, v))
}
const CODE = /^[A-Z0-9]{6}$/
/** Lagos Life keeps 5% of the pot; the winner gets the rest. */
export const potFor = (stake) => Math.floor(stake * 2 * 0.95)

/** Our server (api/lagos.js), with a fresh Lagos Life session. */
const server = (body) => lagosRequest(sdk, body)
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
function sameProgress(a, b) {
  const keys = new Set([...Object.keys(a?.items || {}), ...Object.keys(b?.items || {})])
  return [...keys].every((k) => a?.items?.[k] === b?.items?.[k])
}

let localBeforeCloud = null
let cloudReady = false
let cloudSaving = null
let lastCloud = ''
let autosaveOn = false

/** Save to the server after every match, every minute if something changed, and when the game is put away. */
function startCloudAutosave(save) {
  if (autosaveOn || typeof window === 'undefined') return
  autosaveOn = true
  setInterval(save, 60_000)
  window.addEventListener('pagehide', save)
  window.addEventListener('online', save)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save() })
  useMatchStore.subscribe((m, prev) => { if (m.screen === SCREEN.MATCH_END && prev.screen !== SCREEN.MATCH_END) setTimeout(save, 3000) })
}

export const useLagosStore = create((set, get) => ({
  status: 'loading', // 'loading' | 'ready' | 'error'
  error: null,
  player: null,      // { id, name, avatar }
  mode: null,        // 'test' | 'live'
  wins: 0,           // total wins, as counted on this phone
  goals: 0,          // total goals in matches that count (the board's tie-breaker)
  bestGoals: 0,      // goals the board holds
  best: 0,           // what the leaderboard holds
  board: null,       // { top, me }
  boardError: null,
  match: null,       // the Lagos Life friend match, if any
  owned: [],         // product ids of caps bought (from our server)
  buying: null,      // product id being bought right now
  shopNote: null,    // { tone: 'good' | 'bad', text }
  bet: null,         // a bet being agreed with the other phone: { side: 'mine' | 'theirs', stake, code?, step }
  botMatch: null,    // the sandbox test match being played against the computer on this phone
  betNote: null,
  betError: null,     // { stake, outcome: 'won' | 'lost' | 'refund' } after a bet settles
  justBought: null,  // { productId, state: 'done' | 'pending' | 'failed', text } shows the purchase note

  /** Is this cap design bought? */
  owns: (designKey) => get().owned.includes(productIdFor(designKey)),

  /** Attach the host callbacks after the game has opened the selected save. */
  async boot({ sdk: client, launch, cloudBaseline, localAtLaunch, error }) {
    if (error) {
      useAccountStore.setState({ username: null, token: null })
      set({ status: 'error', error: sdkMessage(error) })
      return false
    }
    try {
      sdk = client
      const player = launch.player
      useAccountStore.setState({ username: player.name || 'Player', token: null })
      set({ status: 'ready', player, mode: launch.mode, wins: readWins(player.id), goals: readCount(goalsKey(player.id)) })
      get().count('open')
      sdk.onPause?.(() => get().pause())
      sdk.onResume?.(() => get().resume())
      sdk.match?.onUpdate?.((raw) => {
        const m = normaliseMatch(raw)
        const before = get().match
        set({ match: m || null })
        // A bet settled: say what it came to
        if (m && Number(m.stake) > 0 && ['done', 'void', 'cancelled'].includes(m.status) && before?.id === m.id && before.status !== m.status && before.status === 'playing') {
          set({ betNote: { stake: Number(m.stake), outcome: m.status !== 'done' || !m.winner || m.winner === 'draw' ? 'refund' : m.winner === player.id ? 'won' : 'lost', at: Date.now() } })
        }
      })
      sdk.match?.current?.().then((m) => { const x = normaliseMatch(m); if (x) set({ match: x }) }).catch(() => {})
      get().loadBoard()
      localBeforeCloud = localAtLaunch
      cloudReady = cloudBaseline !== null
      lastCloud = cloudBaseline || ''
      platformHooks.saveProgress = () => get().saveCloud()
      platformHooks.onDailyClaim = (day) => rememberClaim(launch.mode, player.id, day)
      startCloudAutosave(platformHooks.saveProgress)
      const pending = pendingClaims(launch.mode, player.id)
      const rewards = useRewardsStore.getState
      for (const day of pending) {
        if (!rewards().daily?.last || rewards().daily.last < day) rewards().claim(day)
      }
      if (cloudReady && (pending.length || cloudBaseline === '')) get().saveCloud()
      // Caps bought before: from our server, and any paid but not yet unlocked
      // Leftovers from earlier visits unlock quietly: a note only if something new actually arrives
      await get().loadOwned()
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
    if (get().player) get().saveCloud()
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
      const raw = Number(board?.me?.score ?? board?.me?.best ?? 0) || 0
      set((s) => ({ board, boardError: null, best: Math.max(s.best, winsOf(raw)), bestGoals: Math.max(s.bestGoals || 0, goalsOf(raw)) }))
      // A score from before goals counted (wins only, under 1000) ranks below everyone who has
      // played since, and can drop off the board: send it again in today's form straight away.
      if (raw > 0 && raw < GOAL_SLOT) get().sendScore()
      // How long a list Lagos Life sends, and how many old-form scores are in it (once a session)
      if (!boardCounted) {
        boardCounted = true
        const top = Array.isArray(board?.top) ? board.top : []
        get().count('board', `top_${top.length}`)
        const legacy = top.filter((r) => { const n = Number(r?.score) || 0; return n > 0 && n < GOAL_SLOT }).length
        if (legacy) get().count('board', `legacy_${legacy}`)
      }
    } catch (e) {
      set({ boardError: sdkMessage(e) })
    }
  },

  /** Goals scored in a match that counts: they settle ties on the board. */
  addGoals(n) {
    const { player, goals, bestGoals } = get()
    if (!player || !(n > 0)) return
    const total = Math.max(goals || 0, bestGoals || 0) + n
    writeCount(goalsKey(player.id), total)
    set({ goals: total })
    get().sendScore()
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
      const { wins, goals, best, bestGoals } = get()
      const n = boardScore(Math.max(wins, best), Math.max(goals || 0, bestGoals || 0))
      try {
        const res = await sdk.submitScore(n)
        set((s) => ({ best: Math.max(s.best, winsOf(res?.best)), bestGoals: Math.max(s.bestGoals || 0, goalsOf(res?.best)) }))
        get().loadBoard()
      } catch (e) {
        if (e?.code === 'too_soon' || e?.code === 'rate_limited' || e?.code === 'timeout') get().sendScore()
      }
      // More wins came in while this one was being sent
      if (boardScore(Math.max(get().wins, get().best), Math.max(get().goals || 0, get().bestGoals || 0)) > n) get().sendScore()
    }, wait)
  },

  /* ── Cloud save: earned progress follows the player ── */

  saveCloud() {
    const { player, mode } = get()
    if (!player) return Promise.resolve(false)
    if (cloudSaving) return cloudSaving
    useAccountStore.setState({ saving: true, error: null })
    // Taking a reward can change the balance, scouting credits and the claim
    // date in one tap. Collect them together after that action finishes.
    cloudSaving = Promise.resolve().then(async () => {
      if (!cloudReady) {
        const remote = await readCloudSave(sdk, player.id)
        if (remote && !sameProgress(remote, localBeforeCloud)) {
          throw new Error('Reopen Counterball to sync with your latest career.')
        }
        cloudReady = true
        lastCloud = remote ? JSON.stringify(localBeforeCloud) : ''
      }
      let data = collectSave()
      let json = JSON.stringify(data)
      while (json !== lastCloud) {
        const reply = await server({ action: 'putSave', expectedPlayerId: player.id, data })
        if (reply.ok !== true) throw new Error('The server hasn’t confirmed this save.')
        lastCloud = json
        data = collectSave()
        json = JSON.stringify(data)
      }
      let rewardDay
      try { rewardDay = JSON.parse(data.items[REWARDS_KEY] || 'null')?.daily?.last } catch { /* old save */ }
      acknowledgeClaims(mode, player.id, rewardDay)
      return true
    }).catch((e) => {
      useAccountStore.setState({ error: e.message || 'Couldn’t sync this save.' })
      return false
    }).finally(() => {
      cloudSaving = null
      useAccountStore.setState({ saving: false })
    })
    return cloudSaving
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
  async claim(purchaseId, productId = null, { announce = false } = {}) {
    if (!purchaseId || claiming.has(purchaseId)) return false
    claiming.add(purchaseId)
    const had = new Set(get().owned)
    try {
      const r = await server({ action: 'claim', purchaseId })
      const wasPending = unclaimed.has(purchaseId)
      unclaimed.delete(purchaseId)
      set({ owned: Array.isArray(r.owned) ? r.owned.filter(isProduct) : [...new Set([...get().owned, r.productId])] })
      // Say so only when it's news: just bought, or it arrives now after waiting
      if (announce || wasPending || !had.has(r.productId)) set({ justBought: { productId: r.productId, state: 'done', at: Date.now() } })
      get().enforceOwnership()
      return r.productId
    } catch (e) {
      const id = productId || unclaimed.get(purchaseId) || null
      if (FINAL_CLAIM_ERRORS.has(e?.code)) {
        unclaimed.delete(purchaseId)
        if (announce) set({ justBought: { productId: id, state: 'failed', text: e.message, at: Date.now() }, shopNote: { tone: 'bad', text: e.message } })
      } else {
        // Paid, but our server couldn't unlock it yet: keep trying quietly
        const first = !unclaimed.has(purchaseId)
        unclaimed.set(purchaseId, id)
        retryClaims(get)
        if (first && announce) set({ justBought: { productId: id, state: 'pending', at: Date.now() }, shopNote: { tone: 'good', text: 'Payment received. It unlocks in a moment; no need to pay again.' } })
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
      const got = await get().claim(p.purchaseId, productId, { announce: true })
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

  /** Count something that happened (opens, matches, how finding a player went). Our server only; never shown to players. */
  count(event, detail) {
    if (!sdk) return
    server({ action: 'count', event, ...(detail ? { detail } : {}) }).catch(() => {})
  },

  /** Send the exact Lagos Life code behind a failure to our server's logs. Players only see the friendly message. */
  reportError(code, where) {
    if (!sdk || !code) return
    server({ action: 'logError', code, where }).catch(() => {})
  },

  async findMatch(kind, code, stake = 0) {
    if (!sdk?.match) throw Object.assign(new Error('off'), { code: 'not_multiplayer' })
    const bet = stake > 0 ? cleanStake(stake) : 0
    const m = kind === 'quick' ? await sdk.match.quick({ stake: bet })
      : kind === 'create' ? await sdk.match.create({ stake: bet, seats: 2 })
        : await sdk.match.join(code)
    const x = normaliseMatch(m)
    set({ match: x })
    get().watchMatch()
    return x
  },

  /** While a match waits for its second player, ask Lagos Life every few seconds too (in case an update is missed). */
  watchMatch() {
    clearInterval(matchPoll)
    matchPoll = setInterval(async () => {
      const cur = get().match
      if (!cur || cur.status !== 'open' || !sdk?.match?.current) { clearInterval(matchPoll); matchPoll = null; return }
      try {
        const m = normaliseMatch(await sdk.match.current())
        if (m && m.id === cur.id && (m.status !== cur.status || (m.players?.length || 0) !== (cur.players?.length || 0))) set({ match: m })
      } catch { /* try again next tick */ }
    }, 3000)
  },

  async leaveMatch() {
    try { await sdk?.match?.leave?.() } catch { /* already gone */ }
    set({ match: null })
  },

  /** Tell our server how the friend match ended; it posts the result to Lagos Life. */
  async sendResult(team) {
    const { match, player } = get()
    if (!match?.id || !player || resultSent.has(match.id) || match.status !== 'playing') return
    const myTeam = myTeamFor(useMatchStore.getState())
    const other = match.players?.find((p) => p.id !== player.id)
    const winner = !team ? 'draw' : team === myTeam ? player.id : other?.id
    if (!winner) return
    resultSent.add(match.id)
    // A bet is worth retrying; an unreported friendly simply expires
    for (let i = 0; i < (Number(match.stake) > 0 ? 4 : 1); i++) {
      try { await server({ action: 'result', matchId: match.id, winner }); return } catch { await new Promise((r) => setTimeout(r, 5000)) }
    }
  },

  /* ── Betting with the player you're matched with ── */

  /**
   * Offer a bet. Lagos Life fixes a match's stake when it's made, so this makes
   * a new match at that stake (Lagos Life asks you to confirm the money), then
   * sends its code to the other phone to accept.
   */
  async offerBet(amount) {
    const stake = cleanStake(amount)
    if (!sdk?.match || get().bet) return
    set({ bet: { side: 'mine', stake, step: 'confirming' } })
    try {
      const m = normaliseMatch(await openStaked(() => sdk.match.create({ stake, seats: 2 })))
      if (!m?.code) throw Object.assign(new Error('no code'), { code: 'error' })
      set({ match: m, bet: { side: 'mine', stake, code: m.code, step: 'waiting' } })
      sendBet({ kind: 'offer', stake, code: m.code })
    } catch (e) {
      set({ bet: null, shopNote: null, betError: e?.code === 'cancelled' ? null : sdkMessage(e) })
    }
  },

  /** The other phone offered a bet. */
  receiveBet(data) {
    const { kind } = data || {}
    const bet = get().bet
    if (kind === 'offer' && CODE.test(data.code || '') && Number(data.stake) >= BET_MIN && Number(data.stake) <= BET_MAX && !bet) {
      set({ bet: { side: 'theirs', stake: cleanStake(data.stake), code: data.code, step: 'asking' } })
    } else if (kind === 'accept' && bet?.side === 'mine') {
      set({ bet: { ...bet, step: 'on' } })
    } else if ((kind === 'decline' || kind === 'withdraw') && bet && bet.step !== 'on') {
      if (bet.side === 'mine') sdk?.match?.leave?.().catch(() => {}) // not started: Lagos Life gives the stake back
      set({ bet: null, betError: kind === 'decline' ? 'They said no to the bet. Play on for free.' : 'They took the bet back.' })
    }
  },

  async acceptBet() {
    const bet = get().bet
    if (bet?.side !== 'theirs' || bet.step !== 'asking') return
    set({ bet: { ...bet, step: 'confirming' } })
    try {
      const m = normaliseMatch(await openStaked(() => sdk.match.join(bet.code)))
      set({ match: m, bet: { ...bet, step: 'on' } })
      sendBet({ kind: 'accept' })
    } catch (e) {
      sendBet({ kind: 'decline' })
      set({ bet: null, betError: e?.code === 'cancelled' ? null : sdkMessage(e) })
    }
  },

  declineBet() {
    if (get().bet?.side === 'theirs') sendBet({ kind: 'decline' })
    set({ bet: null })
  },

  /** Take back an offer nobody has accepted yet. */
  withdrawBet() {
    const bet = get().bet
    if (bet?.side !== 'mine' || bet.step === 'on') return
    sendBet({ kind: 'withdraw' })
    sdk?.match?.leave?.().catch(() => {})
    set({ bet: null })
  },

  /** Sandbox only: play the test opponent's seat against the computer on this phone. */
  playTestOpponent() {
    const { match, mode } = get()
    if (mode !== 'test' || !match || match.status !== 'playing') return
    set({ botMatch: match.id })
    const m = useMatchStore.getState()
    m.setGameMode('ai')
    m.goToScreen(SCREEN.TEAM_SELECT)
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
  platformHooks.onOnlineQuit = () => { useLagosStore.getState().concede(); useLagosStore.setState({ bet: null }) }
  platformHooks.onPeerBet = (data) => useLagosStore.getState().receiveBet(data)
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
    if (team && !counted.has(key)) {
      counted.add(key)
      if (winner === team) lagos.addWin()
      lagos.addGoals(m.matchResult.score?.[team] || 0)
    }
    // A friend match, or the sandbox's test match played against the computer here
    const reportable = lagos.match && (m.gameMode === 'online' || (m.gameMode === 'ai' && lagos.botMatch === lagos.match.id))
    if (reportable) {
      if (winner) { pendingDraw = null; lagos.sendResult(winner) }
      else pendingDraw = true
    }
  })
}

/** For tests. */
export function _resetLagos() { sdk = null; boardCounted = false; clearTimeout(scoreTimer); scoreTimer = null; lastScoreAt = 0; resultSent = new Set() }
export function _setSdk(s) { sdk = s }
