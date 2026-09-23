/**
 * CAPBALL online multiplayer (PeerJS, peer-to-peer).
 *
 * - The host (team1) is the authority: it runs physics and the rules and
 *   streams store state + body positions to the guest.
 * - The guest (team2) only renders what the host sends and makes requests
 *   (see protocol.js), which the host validates before applying.
 */

import Peer from 'peerjs'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { snapshotBodies, applyBodySnapshot } from '../physics/PhysicsWorld'
import { performFlick } from '../game/flick'
import { validateGuestMessage, pickSynced, filterSynced, GUEST_TEAM, HOST_TEAM } from './protocol'

const ROOM_PREFIX = 'capball-'
const SYNC_MS = 50
const HEARTBEAT_MS = 1000
// WebRTC can take ~30s to notice a vanished peer; this much silence means gone.
// Generous, so briefly switching apps on a phone doesn't end the match.
const TIMEOUT_MS = 20000

let peer = null
let conn = null
let isHost = false
let syncTimer = null
let lastSentState = ''
let lastSentBodies = ''
let lastHeartbeat = 0
let lastReceived = 0
let watchdog = null

/**
 * PeerJS signalling server. Defaults to the free public PeerJS cloud; set
 * VITE_PEER_HOST (and optionally _PORT, _PATH, _SECURE) to use your own.
 */
function peerOptions() {
  const env = import.meta.env || {}
  if (!env.VITE_PEER_HOST) return {}
  return {
    host: env.VITE_PEER_HOST,
    port: Number(env.VITE_PEER_PORT) || 443,
    path: env.VITE_PEER_PATH || '/',
    secure: env.VITE_PEER_SECURE !== 'false',
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function setStatus(status, msg = '') {
  useMatchStore.setState({ onlineStatus: { status, msg } })
}

function send(type, data) {
  if (conn && conn.open) conn.send({ type, data })
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
    case 'ready': store.setOnlineReady(GUEST_TEAM, action.ready); break
    case 'pause': store.setPaused(action.paused); break
    case 'select': store.selectCap(action.capId); break
    case 'cancel': store.cancelAim(); break
    case 'flick': performFlick(action.capId, action.velocity, GUEST_TEAM); break
  }
}

function handleAsGuest(msg) {
  if (!msg || typeof msg !== 'object') return
  const store = useMatchStore.getState()
  if (msg.type === 'sync' && msg.data) {
    const update = filterSynced(msg.data.state)
    // A new screen means a new ready round
    if (update.screen && update.screen !== store.screen) update.onlineReady = { team1: false, team2: false }
    if (Object.keys(update).length) useMatchStore.setState(update)
    if (msg.data.bodies) applyBodySnapshot(msg.data.bodies)
  } else if (msg.type === 'ready') {
    store.setOnlineReady(HOST_TEAM, msg.data?.ready === true)
  }
}

function connectionLost() {
  stopSync()
  const c = conn
  conn = null
  if (c) c.close()
  setStatus('disconnected', isHost ? 'Your opponent left the match.' : 'The host left the match.')
}

/* Both sides send something every second (host: sync heartbeat, guest: ping)
   and give up on a peer that goes quiet. */
function startWatchdog() {
  stopWatchdog()
  lastReceived = Date.now()
  watchdog = setInterval(() => {
    if (!conn) return
    if (!isHost) send('ping', {})
    if (Date.now() - lastReceived > TIMEOUT_MS) connectionLost()
  }, HEARTBEAT_MS)
}

function stopWatchdog() {
  if (watchdog) { clearInterval(watchdog); watchdog = null }
}

function attachConnection(connection) {
  conn = connection
  conn.on('data', (msg) => {
    lastReceived = Date.now()
    if (isHost) handleAsHost(msg)
    else handleAsGuest(msg)
  })
  conn.on('close', () => { if (conn === connection) connectionLost() })
  conn.on('error', () => setStatus('error', 'Connection problem. Try again.'))
}

function onConnected() {
  const myTeam = isHost ? HOST_TEAM : GUEST_TEAM
  useMatchStore.setState({
    gameMode: 'online',
    onlineMyTeam: myTeam,
    onlineReady: { team1: false, team2: false },
  })
  setStatus('connected', isHost ? 'Opponent connected!' : 'Connected to host!')
  if (isHost) startSync()
  startWatchdog()
}

/* ── Public API ── */

export function createRoom(attempt = 0) {
  disconnect()
  return new Promise((resolve, reject) => {
    const roomCode = generateCode()
    peer = new Peer(ROOM_PREFIX + roomCode, peerOptions())
    isHost = true

    peer.on('open', () => {
      setStatus('waiting', 'Waiting for opponent…')
      resolve(roomCode)
    })
    peer.on('connection', (connection) => {
      // One guest per room
      if (conn) { connection.close(); return }
      attachConnection(connection)
      connection.on('open', onConnected)
    })
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && attempt < 3) {
        createRoom(attempt + 1).then(resolve, reject)
        return
      }
      setStatus('error', `Connection error (${err.type}).`)
      reject(err)
    })
  })
}

export function joinRoom(roomCode) {
  disconnect()
  return new Promise((resolve, reject) => {
    const code = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
    peer = new Peer(peerOptions())
    isHost = false

    peer.on('open', () => {
      setStatus('connecting', 'Connecting to room…')
      const connection = peer.connect(ROOM_PREFIX + code, { reliable: true })
      attachConnection(connection)
      connection.on('open', () => { onConnected(); resolve() })
    })
    peer.on('error', (err) => {
      setStatus('error', err.type === 'peer-unavailable' ? 'Room not found. Check the code.' : `Connection error (${err.type}).`)
      reject(err)
    })
  })
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
/** Either side: my ready state */
export function sendReady(ready) { send('ready', { ready }) }

export function getIsHost() { return isHost }
export function isConnected() { return !!conn?.open }

export function disconnect() {
  stopSync()
  stopWatchdog()
  if (conn) { const c = conn; conn = null; c.close() }
  if (peer) { peer.destroy(); peer = null }
  isHost = false
  useMatchStore.setState({ onlineMyTeam: null, onlineStatus: { status: 'idle', msg: '' } })
}
