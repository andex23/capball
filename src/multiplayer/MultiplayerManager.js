/**
 * CAPBALL Online Multiplayer — Real-time State Sync
 *
 * Architecture:
 * - Host is the authority — runs physics, owns game state
 * - Guest receives state updates and sends input commands
 * - ALL state changes are broadcast immediately
 * - Screen navigation is synchronized
 * - Team config edits are synced live
 */

import Peer from 'peerjs'
import { useMatchStore } from '../state/MatchStore'

const ROOM_PREFIX = 'capball-'
let peer = null
let conn = null
let isHost = false
let onStatusChange = null
let syncInterval = null

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function setStatusCallback(cb) { onStatusChange = cb }
function updateStatus(status, msg) { if (onStatusChange) onStatusChange({ status, msg }) }

// ── State keys to sync ──
const SYNC_KEYS = [
  'screen', 'score', 'activeTeam', 'phase', 'timeRemaining', 'half',
  'teamConfig', 'formations', 'stadium', 'team1Side', 'matchDuration',
  'foulData', 'penaltyShootout', 'penaltyScores', 'penaltyRound',
  'penaltyTeam', 'matchResult', 'selectedCapId', 'freeKickCapId',
  'paused', 'ballColor',
  // NOTE: onlineReady is NOT in this list — it's handled separately
  // to prevent the host's sync loop from overwriting the guest's ready state
]

/** Get a snapshot of all syncable state */
function getStateSnapshot() {
  const state = useMatchStore.getState()
  const snap = {}
  for (const key of SYNC_KEYS) snap[key] = state[key]
  return snap
}

/** Apply a state snapshot from the other player */
function applyStateSnapshot(snap) {
  const update = {}
  for (const key of SYNC_KEYS) {
    if (snap[key] !== undefined) update[key] = snap[key]
  }
  // NEVER overwrite local-only state
  delete update.onlineMyTeam
  delete update.onlineReady
  useMatchStore.setState(update)
}

// ── PUBLIC API ──

export function createRoom() {
  return new Promise((resolve, reject) => {
    const roomCode = generateCode()
    const peerId = ROOM_PREFIX + roomCode

    peer = new Peer(peerId)

    peer.on('open', () => {
      isHost = true
      updateStatus('waiting', `Room: ${roomCode} — Waiting for opponent...`)

      peer.on('connection', (connection) => {
        conn = connection
        updateStatus('connected', 'Opponent connected!')

        conn.on('data', handleIncomingData)
        conn.on('close', () => {
          stopSync()
          updateStatus('disconnected', 'Opponent disconnected')
        })

        // Start continuous sync (host → guest)
        setTimeout(() => {
          sendFullState()
          startSync()
        }, 300)
      })

      resolve(roomCode)
    })

    peer.on('error', (err) => {
      updateStatus('error', `Connection error: ${err.type}`)
      reject(err)
    })
  })
}

export function joinRoom(roomCode) {
  return new Promise((resolve, reject) => {
    const peerId = ROOM_PREFIX + 'g-' + Math.random().toString(36).substr(2, 5)
    const hostId = ROOM_PREFIX + roomCode.toUpperCase()

    peer = new Peer(peerId)

    peer.on('open', () => {
      isHost = false
      updateStatus('connecting', 'Connecting to room...')

      conn = peer.connect(hostId, { reliable: true })

      conn.on('open', () => {
        updateStatus('connected', 'Connected to host!')
        conn.on('data', handleIncomingData)
        conn.on('close', () => {
          stopSync()
          updateStatus('disconnected', 'Host disconnected')
        })
        resolve()
      })

      conn.on('error', (err) => {
        updateStatus('error', `Join error: ${err.type}`)
        reject(err)
      })
    })

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        updateStatus('error', 'Room not found. Check the code.')
      } else {
        updateStatus('error', `Connection error: ${err.type}`)
      }
      reject(err)
    })
  })
}

/** Send a message to the other player */
export function send(type, data) {
  if (conn && conn.open) {
    conn.send({ type, data, t: Date.now() })
  }
}

/** Broadcast full state (host → guest) */
export function sendFullState() {
  if (!isHost) return
  send('fullState', getStateSnapshot())
}

/** Send a specific state change (either direction) */
export function sendStateChange(changes) {
  send('stateChange', changes)
}

/** Send a flick action (guest → host) */
export function sendFlick(capId, velocity) {
  send('flick', { capId, velocity })
}

/** Start continuous state sync from host */
function startSync() {
  if (!isHost) return
  stopSync()
  // Sync full state every 200ms
  syncInterval = setInterval(() => {
    if (conn && conn.open) {
      send('fullState', getStateSnapshot())
    }
  }, 200)
}

function stopSync() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
}

/** Handle incoming data from other player */
function handleIncomingData(msg) {
  const { type, data } = msg

  switch (type) {
    case 'fullState':
      // Guest receives full state from host — apply it
      if (!isHost) {
        applyStateSnapshot(data)
      }
      break

    case 'stateChange': {
      // Either player can send targeted state changes
      // NEVER overwrite local-only keys
      const safeData = { ...data }
      delete safeData.onlineMyTeam // never overwrite — local to each player
      delete safeData.onlineReady  // handled via dedicated 'ready' channel

      if (isHost) {
        useMatchStore.setState(safeData)
        sendFullState()
      } else {
        useMatchStore.setState(safeData)
      }
      break
    }

    case 'flick':
      // Guest sends flick → host executes it
      if (isHost) {
        const { applyFlick } = require('../physics/PhysicsWorld')
        applyFlick(data.capId, data.velocity)
        useMatchStore.getState().setLastFlickedCap(data.capId)
        useMatchStore.getState().startResolve()
      }
      break

    case 'capSelect':
      // Guest selects a cap → host applies
      if (isHost) {
        useMatchStore.getState().selectCap(data.capId)
      }
      break

    case 'ready':
      // Either player sends their ready state
      useMatchStore.getState().setOnlineReady(data.team, data.ready)
      break
  }
}

/** Send ready state — dedicated channel, not part of full sync */
export function sendReady(team, ready) {
  send('ready', { team, ready })
}

export function getIsHost() { return isHost }
export function isConnected() { return conn && conn.open }
export function getMyTeam() { return isHost ? 'team1' : 'team2' }

export function isMyTurn() {
  const activeTeam = useMatchStore.getState().activeTeam
  return activeTeam === getMyTeam()
}

export function disconnect() {
  stopSync()
  if (conn) { conn.close(); conn = null }
  if (peer) { peer.destroy(); peer = null }
  isHost = false
  updateStatus('disconnected', 'Disconnected')
}
