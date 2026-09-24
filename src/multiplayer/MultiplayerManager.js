/**
 * CAPBALL online multiplayer (PeerJS, peer-to-peer).
 *
 * - The host (team1) is the authority: it runs physics and the rules and
 *   streams store state + body positions to the guest.
 * - The guest (team2) only renders what the host sends and makes requests
 *   (see protocol.js), which the host validates before applying.
 * - Joining is a small handshake: the guest connects (with the room's session
 *   token if it's coming back), the host answers `welcome` with the token or
 *   `rejected`.
 * - If the link drops, the host keeps the room open and pauses; the guest
 *   retries with backoff (see reconnect.js). After the grace period the match
 *   ends as before.
 */

import Peer, { util as peerUtil } from 'peerjs'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { snapshotBodies, applyBodySnapshot } from '../physics/PhysicsWorld'
import { performFlick } from '../game/flick'
import {
  validateGuestMessage, validateJoin, makeSessionToken, readyValue, pickSynced, filterSynced,
  SESSION_TOKEN, GUEST_TEAM, HOST_TEAM,
} from './protocol'
import { buildIceServers, hasRelay, connectErrorMessage, ICE_FAILED_MSG } from './iceServers'
import { createReconnectMachine } from './reconnect'

const ROOM_PREFIX = 'capball-'
const SYNC_MS = 50
const HEARTBEAT_MS = 1000
// WebRTC can take ~30s to notice a vanished peer; this much silence means gone.
// Generous, so briefly switching apps on a phone doesn't end the match.
const TIMEOUT_MS = 20000
// A first join / one reconnect attempt that hasn't finished by now has failed
const CONNECT_TIMEOUT_MS = 15000
const RETRY_TIMEOUT_MS = 10000
// Host: how often to check the signalling server link while a room is open
const SIGNAL_CHECK_MS = 5000

let peer = null
let conn = null
let isHost = false
let syncTimer = null
let lastSentState = ''
let lastSentBodies = ''
let lastHeartbeat = 0
let lastReceived = 0
let watchdog = null
let signalTimer = null

let roomCode = ''        // host: our room; guest: the room we joined
let sessionToken = null  // host: this room's secret; guest: the one the host gave us
let roomBound = false    // host: a guest has joined, so the room is theirs
let reconnector = null   // reconnect state machine while a dropped link is being recovered
let pausedByDrop = false // host: we paused the match because the guest dropped
let lobbyHint = ''       // host: why the last join attempt failed

/* ── ICE / signalling configuration ── */

const ENV = import.meta.env || {}
// PeerJS's own defaults are kept as a fallback when no relay is configured
const ICE_SERVERS = buildIceServers(ENV, { fallback: peerUtil?.defaultConfig?.iceServers || [] })
const RELAY_CONFIGURED = hasRelay(buildIceServers(ENV))

/**
 * PeerJS options: signalling server (defaults to the free public PeerJS cloud;
 * set VITE_PEER_HOST and optionally _PORT, _PATH, _SECURE to use your own)
 * plus the ICE servers.
 */
function peerOptions() {
  const options = { config: { ...(peerUtil?.defaultConfig || {}), iceServers: ICE_SERVERS } }
  if (!ENV.VITE_PEER_HOST) return options
  return {
    ...options,
    host: ENV.VITE_PEER_HOST,
    port: Number(ENV.VITE_PEER_PORT) || 443,
    path: ENV.VITE_PEER_PATH || '/',
    secure: ENV.VITE_PEER_SECURE !== 'false',
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const connectError = (type) => Object.assign(new Error(type), { type })
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const errorMessage = (err) => connectErrorMessage(err, { relay: RELAY_CONFIGURED })

function setStatus(status, msg = '') {
  useMatchStore.setState({ onlineStatus: { status, msg } })
}

function send(type, data) {
  if (conn && conn.open) conn.send({ type, data })
}

function opponentName() {
  const team = isHost ? GUEST_TEAM : HOST_TEAM
  return useMatchStore.getState().teamConfig?.[team]?.name || (isHost ? 'your opponent' : 'the host')
}

/* ── Host → guest state stream ── */

function syncTick() {
  if (!isHost || !conn?.open) return
  const state = useMatchStore.getState()
  const now = Date.now()

  const stateJson = JSON.stringify(pickSynced(state))
  const bodiesJson = state.screen === SCREEN.PLAYING ? JSON.stringify(snapshotBodies()) : ''
  const stateChanged = stateJson !== lastSentState
  const bodiesChanged = bodiesJson !== lastSentBodies
  // Always send something at least once a second so a missed packet heals itself
  if (!stateChanged && !bodiesChanged && now - lastHeartbeat < HEARTBEAT_MS) return

  const payload = {}
  if (stateChanged || now - lastHeartbeat >= HEARTBEAT_MS) payload.state = JSON.parse(stateJson)
  if (bodiesJson && (bodiesChanged || now - lastHeartbeat >= HEARTBEAT_MS)) payload.bodies = JSON.parse(bodiesJson)
  send('sync', payload)
  lastSentState = stateJson
  lastSentBodies = bodiesJson
  lastHeartbeat = now
}

/** (Re)start streaming. Clearing the change-detection cache makes the next sync a full one. */
function startSync() {
  stopSync()
  lastSentState = ''
  lastSentBodies = ''
  syncTimer = setInterval(syncTick, SYNC_MS)
}

function stopSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
}

/* ── Incoming messages ── */

function handleAsHost(msg) {
  const store = useMatchStore.getState()
  const action = validateGuestMessage(msg, store)
  if (!action) return
  switch (action.type) {
    case 'teamConfig': store.setTeamConfig(GUEST_TEAM, action.config); break
    case 'formation': store.setFormation(GUEST_TEAM, action.key); break
    case 'ready': store.setOnlineReady(GUEST_TEAM, action.choice || action.ready); break
    case 'pause': store.setPaused(action.paused); break
    case 'select': store.selectCap(action.capId); break
    case 'cancel': store.cancelAim(); break
    case 'flick': performFlick(action.capId, action.velocity, GUEST_TEAM); break
    case 'bye': connectionLost('bye'); break
  }
}

function handleAsGuest(msg) {
  if (!isObj(msg)) return
  const store = useMatchStore.getState()
  if (msg.type === 'sync' && msg.data) {
    const update = filterSynced(msg.data.state)
    // A new screen means a new ready round
    if (update.screen && update.screen !== store.screen) update.onlineReady = { team1: false, team2: false }
    if (Object.keys(update).length) useMatchStore.setState(update)
    if (msg.data.bodies) applyBodySnapshot(msg.data.bodies)
  } else if (msg.type === 'ready') {
    store.setOnlineReady(HOST_TEAM, readyValue(msg.data))
  } else if (msg.type === 'bye') {
    connectionLost('bye')
  }
}

/* ── Losing and recovering the link ── */

function publishReconnect(s) {
  useMatchStore.setState({
    onlineReconnect: s.phase === 'idle' ? null : { phase: s.phase, deadline: s.deadline, attempts: s.attempts },
  })
}

function canReconnect() {
  if (useMatchStore.getState().screen === SCREEN.MENU) return false
  return isHost ? roomBound && !!peer && !peer.destroyed : !!roomCode && !!sessionToken
}

function connectionLost(reason) {
  stopSync()
  stopWatchdog()
  const c = conn
  conn = null
  if (c) c.close()

  // Host lobby: a join attempt that never got going — keep waiting for someone
  if (isHost && !roomBound) {
    if (peer) setStatus('waiting', lobbyHint || 'Waiting for opponent…')
    return
  }
  // Already waiting / retrying (e.g. a rejoin attempt fell through)
  if (reconnector?.active) return
  if (reason !== 'bye' && canReconnect()) { beginReconnect(); return }
  endSession(isHost ? 'Your opponent left the match.' : 'The host left the match.')
}

function beginReconnect() {
  const store = useMatchStore.getState()
  const name = opponentName()
  if (isHost) {
    // Freeze the match (clock and physics) until they're back
    pausedByDrop = store.screen === SCREEN.PLAYING && !store.paused
    if (pausedByDrop) store.setPaused(true)
  }
  store.resetOnlineReady()
  setStatus('reconnecting', isHost ? `Waiting for ${name} to reconnect…` : 'Reconnecting…')

  reconnector = createReconnectMachine({
    attempt: isHost ? null : attemptRejoin,
    onChange: publishReconnect,
    onSettled: resumeAfterDrop,
    onGiveUp: () => endSession(isHost ? `${name} didn’t come back.` : 'Couldn’t reach the host again.'),
  })
  reconnector.start()
}

/** Guest: one reconnect attempt with our session token. */
function attemptRejoin() {
  return connectToRoom(roomCode, sessionToken, RETRY_TIMEOUT_MS).then(
    () => onConnected(true),
    (err) => {
      // The room exists but won't have us back — no point retrying
      if (err?.type === 'room-in-use') endSession('The host’s room isn’t available any more.')
      throw err
    },
  )
}

/** Host: after the "opponent is back" notice, carry on if we were the ones who paused. */
function resumeAfterDrop() {
  if (!isHost || !pausedByDrop) return
  pausedByDrop = false
  const s = useMatchStore.getState()
  if (conn?.open && s.screen === SCREEN.PLAYING && s.paused) s.setPaused(false)
}

/** Give up on the session; the ConnectionLost modal takes it from here. */
function endSession(msg) {
  stopSync()
  stopWatchdog()
  stopSignalling()
  if (reconnector) { const r = reconnector; reconnector = null; r.stop() }
  useMatchStore.setState({ onlineReconnect: null })
  if (conn) { const c = conn; conn = null; c.close() }
  if (peer) { const p = peer; peer = null; p.destroy() }
  sessionToken = null
  pausedByDrop = false
  setStatus('disconnected', msg)
}

/* Both sides send something every second (host: sync heartbeat, guest: ping)
   and treat a peer that goes quiet as dropped. */
function startWatchdog() {
  stopWatchdog()
  lastReceived = Date.now()
  watchdog = setInterval(() => {
    if (!conn) return
    if (!isHost) send('ping', {})
    if (Date.now() - lastReceived > TIMEOUT_MS) connectionLost('timeout')
  }, HEARTBEAT_MS)
}

function stopWatchdog() {
  if (watchdog) { clearInterval(watchdog); watchdog = null }
}

/* Host: keep the room reachable on the signalling server so a dropped guest
   can find it again (phones lose the websocket when backgrounded). */
function startSignalling() {
  stopSignalling()
  signalTimer = setInterval(() => {
    if (!isHost || !peer || peer.destroyed || !peer.disconnected) return
    try { peer.reconnect() } catch { /* try again next tick */ }
  }, SIGNAL_CHECK_MS)
}

function stopSignalling() {
  if (signalTimer) { clearInterval(signalTimer); signalTimer = null }
}

function attachConnection(connection) {
  connection.on('data', (msg) => {
    if (conn !== connection) return
    lastReceived = Date.now()
    if (isHost) handleAsHost(msg)
    else handleAsGuest(msg)
  })
  connection.on('close', () => { if (conn === connection) connectionLost('closed') })
}

function onConnected(rejoin) {
  const myTeam = isHost ? HOST_TEAM : GUEST_TEAM
  useMatchStore.setState({
    gameMode: 'online',
    onlineMyTeam: myTeam,
    onlineReady: { team1: false, team2: false },
  })
  lobbyHint = ''
  if (rejoin) setStatus('connected', isHost ? `${opponentName()} is back!` : 'Reconnected!')
  else setStatus('connected', isHost ? 'Opponent connected!' : 'Connected to host!')
  if (isHost) startSync()
  startWatchdog()
  if (rejoin && reconnector?.active) reconnector.succeed()
}

/* ── Host: accepting guests ── */

function refuse(connection, reason) {
  connection.on('open', () => {
    connection.send({ type: 'rejected', data: { reason } })
    setTimeout(() => connection.close(), 500)
  })
  setTimeout(() => connection.close(), CONNECT_TIMEOUT_MS)
}

function onIncoming(connection) {
  const verdict = validateJoin(connection.metadata, { token: sessionToken, bound: roomBound, busy: !!conn })
  if (!verdict.ok) { refuse(connection, verdict.reason); return }

  // Our own guest on a new link — drop the stale one
  if (conn) { const stale = conn; conn = null; stale.close() }
  conn = connection
  attachConnection(connection)

  connection.on('iceStateChanged', (state) => {
    if (state !== 'failed' || roomBound) return
    lobbyHint = `Someone tried to join. ${ICE_FAILED_MSG}`
    setStatus('waiting', lobbyHint)
  })
  // A join that never opens (no route between the two) frees the room again
  setTimeout(() => {
    if (conn !== connection || connection.open) return
    if (!roomBound) lobbyHint = `Someone tried to join. ${ICE_FAILED_MSG}`
    connectionLost('timeout')
  }, CONNECT_TIMEOUT_MS)

  connection.on('open', () => {
    if (conn !== connection) return
    const rejoin = roomBound
    roomBound = true
    send('welcome', { token: sessionToken })
    onConnected(rejoin)
  })
}

/* ── Guest: connecting to a room ── */

/**
 * Open a fresh Peer, connect to the room and wait for the host's `welcome`.
 * Resolves once we're in (conn set, handlers attached); rejects with an error
 * whose `type` says why.
 */
function connectToRoom(code, token, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (peer) peer.destroy()
    const p = new Peer(peerOptions())
    peer = p
    let connection = null
    let iceFailed = false
    let done = false

    const finish = (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (!err) { resolve(); return }
      if (connection) connection.close()
      p.destroy()
      if (peer === p) peer = null
      reject(err)
    }
    const timer = setTimeout(() => finish(connectError(p.open ? 'connect-timeout' : 'server-timeout')), timeoutMs)

    p.on('open', () => {
      if (done) return
      setStatus(useMatchStore.getState().onlineStatus.status, token ? 'Reconnecting…' : 'Connecting to host…')
      connection = p.connect(ROOM_PREFIX + code, { reliable: true, metadata: token ? { token } : {} })
      connection.on('iceStateChanged', (state) => { if (state === 'failed') iceFailed = true })
      connection.on('error', (err) => finish(iceFailed ? connectError('ice-failed') : err))
      connection.on('close', () => finish(connectError(iceFailed ? 'ice-failed' : 'connection-closed')))
      const handshake = (msg) => {
        if (done || !isObj(msg)) return
        if (msg.type === 'rejected') { finish(connectError('room-in-use')); return }
        if (msg.type !== 'welcome') return
        const t = msg.data?.token
        if (typeof t !== 'string' || !SESSION_TOKEN.test(t)) { finish(connectError('bad-welcome')); return }
        connection.off('data', handshake)
        sessionToken = t
        conn = connection
        attachConnection(connection)
        finish()
      }
      connection.on('data', handshake)
    })
    // Errors after we're in (e.g. the signalling server going away) don't matter to the guest
    p.on('error', (err) => finish(err))
  })
}

/* ── Public API ── */

export function createRoom(attempt = 0) {
  disconnect()
  return new Promise((resolve, reject) => {
    const code = generateCode()
    const p = new Peer(ROOM_PREFIX + code, peerOptions())
    peer = p
    isHost = true
    roomCode = code
    sessionToken = makeSessionToken()
    roomBound = false
    let opened = false

    p.on('open', () => {
      if (peer !== p) return
      // Fires again after a signalling reconnect
      if (!roomBound && !conn) setStatus('waiting', lobbyHint || 'Waiting for opponent…')
      if (opened) return
      opened = true
      startSignalling()
      resolve(code)
    })
    p.on('connection', (connection) => { if (peer === p) onIncoming(connection) })
    p.on('error', (err) => {
      if (peer !== p) return
      if (!opened) {
        if (err.type === 'unavailable-id' && attempt < 3) {
          createRoom(attempt + 1).then(resolve, reject)
          return
        }
        setStatus('error', errorMessage(err))
        reject(err)
        return
      }
      // Room already open: a signalling hiccup doesn't affect a running match
      // (startSignalling reconnects), but tell a host still waiting in the lobby.
      if (!roomBound && !conn && p.disconnected) setStatus('waiting', 'Lost the matchmaking server — reconnecting…')
    })
  })
}

export function joinRoom(input) {
  disconnect()
  const code = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '')
  isHost = false
  roomCode = code
  setStatus('connecting', 'Connecting to room…')
  return connectToRoom(code, null, CONNECT_TIMEOUT_MS).then(
    () => onConnected(false),
    (err) => {
      if (roomCode === code && !isHost) setStatus('error', errorMessage(err))
      throw err
    },
  )
}

// Closing the tab tells the other side straight away where the browser allows it
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (conn) disconnect() })

/* Guest requests (the host ignores anything it doesn't allow) */
export function sendTeamConfig(config) { send('teamConfig', { config }) }
export function sendFormation(key) { send('formation', { key }) }
export function sendSelect(capId) { send('select', { capId }) }
export function sendFlick(capId, velocity) { send('flick', { capId, velocity }) }
export function sendCancel() { send('cancel', {}) }
export function sendPause(paused) { send('pause', { paused }) }
/** Either side: my ready state. On the full-time screen, `choice` is 'rematch' or 'penalties'. */
export function sendReady(ready, choice) { send('ready', ready && choice ? { ready, choice } : { ready }) }

export function getIsHost() { return isHost }
export function isConnected() { return !!conn?.open }

/** Leave on purpose: say goodbye (so the other side doesn't wait for us) and tear down. */
export function disconnect() {
  const c = conn
  const p = peer
  conn = null
  peer = null
  stopSync()
  stopWatchdog()
  stopSignalling()
  if (reconnector) { const r = reconnector; reconnector = null; r.stop() }
  const sayBye = !!c?.open
  if (sayBye) { try { c.send({ type: 'bye', data: {} }) } catch { /* already gone */ } }
  // Give the goodbye a moment to leave before closing the link
  if (c || p) setTimeout(() => { c?.close(); p?.destroy() }, sayBye ? 150 : 0)
  isHost = false
  roomCode = ''
  sessionToken = null
  roomBound = false
  pausedByDrop = false
  lobbyHint = ''
  useMatchStore.setState({ onlineMyTeam: null, onlineStatus: { status: 'idle', msg: '' }, onlineReconnect: null })
}
