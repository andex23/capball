/**
 * CAPBALL Online Multiplayer — PeerJS WebRTC
 *
 * Flow:
 * 1. Host creates a room → gets a 6-char room code
 * 2. Guest joins with room code
 * 3. They connect peer-to-peer (no server for game data)
 * 4. Host runs physics, syncs state to guest
 * 5. Guest sends flick commands to host
 */

import Peer from 'peerjs'
import { useMatchStore } from '../state/MatchStore'

const ROOM_PREFIX = 'capball-'
let peer = null
let conn = null
let isHost = false
let onStatusChange = null

// Generate a 6-char room code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function setStatusCallback(cb) { onStatusChange = cb }
function updateStatus(status, msg) { if (onStatusChange) onStatusChange({ status, msg }) }

/**
 * HOST: Create a room and wait for guest
 */
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
        conn.on('close', () => updateStatus('disconnected', 'Opponent disconnected'))

        // Send initial game state
        setTimeout(() => {
          sendState()
        }, 500)
      })

      resolve(roomCode)
    })

    peer.on('error', (err) => {
      updateStatus('error', `Connection error: ${err.type}`)
      reject(err)
    })
  })
}

/**
 * GUEST: Join an existing room
 */
export function joinRoom(roomCode) {
  return new Promise((resolve, reject) => {
    const peerId = ROOM_PREFIX + 'guest-' + Math.random().toString(36).substr(2, 5)
    const hostId = ROOM_PREFIX + roomCode.toUpperCase()

    peer = new Peer(peerId)

    peer.on('open', () => {
      isHost = false
      updateStatus('connecting', 'Connecting to room...')

      conn = peer.connect(hostId, { reliable: true })

      conn.on('open', () => {
        updateStatus('connected', 'Connected to host!')
        conn.on('data', handleIncomingData)
        conn.on('close', () => updateStatus('disconnected', 'Host disconnected'))
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

/**
 * Send data to the other player
 */
export function sendToOpponent(type, data) {
  if (conn && conn.open) {
    conn.send({ type, data })
  }
}

/**
 * Send full game state (host → guest)
 */
export function sendState() {
  if (!isHost || !conn) return
  const state = useMatchStore.getState()
  sendToOpponent('state', {
    score: state.score,
    activeTeam: state.activeTeam,
    phase: state.phase,
    timeRemaining: state.timeRemaining,
    half: state.half,
    teamConfig: state.teamConfig,
  })
}

/**
 * Send a flick action (guest → host)
 */
export function sendFlick(capId, velocity) {
  sendToOpponent('flick', { capId, velocity })
}

/**
 * Handle incoming data
 */
function handleIncomingData(msg) {
  const { type, data } = msg

  if (type === 'state') {
    // Guest receives state update from host
    if (!isHost) {
      useMatchStore.setState({
        score: data.score,
        activeTeam: data.activeTeam,
        phase: data.phase,
        timeRemaining: data.timeRemaining,
        half: data.half,
      })
    }
  }

  if (type === 'flick') {
    // Host receives flick command from guest
    if (isHost) {
      const { applyFlick } = require('../physics/PhysicsWorld')
      applyFlick(data.capId, data.velocity)
      useMatchStore.getState().setLastFlickedCap(data.capId)
      useMatchStore.getState().startResolve()
    }
  }

  if (type === 'chat') {
    updateStatus('chat', data.message)
  }
}

/**
 * Check if we're the host
 */
export function getIsHost() { return isHost }

/**
 * Check if we're connected
 */
export function isConnected() { return conn && conn.open }

/**
 * Which team does this player control?
 * Host = team1, Guest = team2
 */
export function getMyTeam() { return isHost ? 'team1' : 'team2' }

/**
 * Is it my turn?
 */
export function isMyTurn() {
  const activeTeam = useMatchStore.getState().activeTeam
  return activeTeam === getMyTeam()
}

/**
 * Disconnect and cleanup
 */
export function disconnect() {
  if (conn) { conn.close(); conn = null }
  if (peer) { peer.destroy(); peer = null }
  isHost = false
  updateStatus('disconnected', 'Disconnected')
}
