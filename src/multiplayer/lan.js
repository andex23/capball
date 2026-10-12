import { zlibSync, unzlibSync, strToU8, strFromU8 } from 'fflate'

/** Offline WebRTC pairing. No signalling service, STUN or TURN is contacted. */
const PREFIX = 'COUNTERBALL-LAN2:'
const LEGACY_PREFIX = 'CAPBALL-LAN1:'
export const isLanSignal = value => typeof value === 'string' && (value.startsWith(PREFIX) || value.startsWith(LEGACY_PREFIX))
const LIMIT = 24000

// QR's alphanumeric alphabet packs compressed bytes more densely than base64.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
function pack(bytes) {
  let text = ''
  for (let i = 0; i < bytes.length; i += 2) {
    let value = bytes[i] * (i + 1 < bytes.length ? 256 : 1) + (bytes[i + 1] || 0)
    text += ALPHABET[value % 45]; value = Math.floor(value / 45)
    text += ALPHABET[value % 45]
    if (i + 1 < bytes.length) text += ALPHABET[Math.floor(value / 45)]
  }
  return text
}
function unpack(text) {
  const bytes = []
  if (text.length % 3 === 1) throw new Error('incomplete')
  for (let i = 0; i < text.length; i += 3) {
    const count = Math.min(3, text.length - i)
    let value = 0
    for (let n = 0; n < count; n++) {
      const digit = ALPHABET.indexOf(text[i + n])
      if (digit < 0) throw new Error('invalid')
      value += digit * 45 ** n
    }
    if (value > (count === 3 ? 65535 : 255)) throw new Error('invalid')
    if (count === 3) bytes.push(Math.floor(value / 256), value % 256)
    else bytes.push(value)
  }
  return new Uint8Array(bytes)
}

export function encodeLanSignal(description) {
  const bytes = zlibSync(strToU8(JSON.stringify({ type: description.type, sdp: description.sdp })), { level: 9 })
  return PREFIX + pack(bytes)
}

export function decodeLanSignal(text, expected) {
  const value = String(text).replace(/^[\r\n\t ]+/, '').replace(/[\r\n\t]+$/, '')
  if (!isLanSignal(value) || value.length > LIMIT * 2) throw new Error('Use a Counterball LAN pairing code.')
  let signal
  try {
    const legacy = value.startsWith(LEGACY_PREFIX)
    const raw = value.slice(legacy ? LEGACY_PREFIX.length : PREFIX.length)
    // Bound output allocation even for a malformed/compressed-bomb QR.
    const json = legacy ? atob(raw.trim()) : strFromU8(unzlibSync(unpack(raw), { out: new Uint8Array(LIMIT + 1024) }))
    signal = JSON.parse(json)
  } catch { throw new Error('That pairing code is incomplete. Scan or copy it again.') }
  if (!signal || signal.type !== expected || typeof signal.sdp !== 'string' || signal.sdp.length > LIMIT || !signal.sdp.startsWith('v=0')) {
    throw new Error(expected === 'offer' ? 'Scan the host’s invite code.' : 'Scan the guest’s reply code.')
  }
  if (/a=candidate:.* typ (?!host\b)/.test(signal.sdp)) throw new Error('This code is not a local-network connection.')
  return { type: signal.type, sdp: signal.sdp }
}

function gather(pc) {
  return new Promise((resolve, reject) => {
    const done = error => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', change)
      pc.removeEventListener('connectionstatechange', closed)
      if (error) reject(error)
      else if (!pc.localDescription?.sdp.includes('a=candidate:')) reject(new Error('No local connection is available. Join Wi-Fi or a hotspot and allow local-network access.'))
      else resolve(encodeLanSignal(pc.localDescription))
    }
    const change = () => { if (pc.iceGatheringState === 'complete') done() }
    const closed = () => { if (pc.connectionState === 'closed') done(new Error('Pairing cancelled.')) }
    const timer = setTimeout(() => done(new Error('Local pairing timed out. Check your Wi-Fi or hotspot and try again.')), 10000)
    pc.addEventListener('icegatheringstatechange', change)
    pc.addEventListener('connectionstatechange', closed)
    change()
  })
}

function channelAdapter(channel, pc) {
  const listeners = new Map()
  const emit = (event, data) => { for (const fn of listeners.get(event) || []) fn(data) }
  channel.addEventListener('open', () => emit('open'))
  channel.addEventListener('close', () => emit('close'))
  channel.addEventListener('error', () => emit('close'))
  channel.addEventListener('message', e => {
    if (typeof e.data !== 'string' || e.data.length > 128000) return
    try { emit('data', JSON.parse(e.data)) } catch { /* ignore malformed messages */ }
  })
  return {
    get open() { return channel.readyState === 'open' },
    on(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn) },
    send(message) { if (channel.readyState === 'open') channel.send(JSON.stringify(message)) },
    close() { channel.close(); pc.close() },
  }
}

export function createLanPeer({ onChannel, onFailure, onInterruption, PeerConnection = globalThis.RTCPeerConnection } = {}) {
  if (!PeerConnection) throw new Error('LAN play needs a browser with WebRTC support.')
  const pc = new PeerConnection({ iceServers: [] })
  let closed = false
  let connectTimer
  const attach = channel => onChannel(channelAdapter(channel, pc))
  pc.addEventListener('datachannel', e => {
    if (e.channel.label !== 'capball-lan') { e.channel.close(); return }
    attach(e.channel)
  })
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'connected') clearTimeout(connectTimer)
    if (!closed && pc.connectionState === 'disconnected') onInterruption?.()
    if (!closed && pc.connectionState === 'failed') onFailure?.('LAN connection failed. Check that both devices are on the same network and client isolation is off.')
  })
  const waitForConnection = () => {
    clearTimeout(connectTimer)
    connectTimer = setTimeout(() => {
      if (!closed && pc.connectionState !== 'connected') onFailure?.('Could not reach the other device. Use the same Wi-Fi or hotspot; some guest networks block device-to-device connections.')
    }, 30000)
  }
  return {
    get destroyed() { return closed },
    async offer() {
      attach(pc.createDataChannel('capball-lan', { ordered: true }))
      await pc.setLocalDescription(await pc.createOffer())
      return gather(pc)
    },
    async answer(code) {
      await pc.setRemoteDescription(decodeLanSignal(code, 'offer'))
      await pc.setLocalDescription(await pc.createAnswer())
      return gather(pc)
    },
    async accept(code) {
      await pc.setRemoteDescription(decodeLanSignal(code, 'answer'))
      waitForConnection()
    },
    destroy() { closed = true; clearTimeout(connectTimer); pc.close() },
  }
}

/** URL-safe form for phone camera apps; the invitation stays in the fragment. */
export function lanSignalToken(code) {
  const signal = decodeLanSignal(code, 'offer')
  const bytes = zlibSync(strToU8(JSON.stringify(signal)), { level: 9 })
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function lanSignalFromToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+$/.test(token) || token.length > LIMIT * 2) throw new Error('Invalid LAN invite.')
  const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const code = PREFIX + pack(bytes)
  decodeLanSignal(code, 'offer')
  return code
}
