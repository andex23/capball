/** Offline WebRTC pairing. No signalling service, STUN or TURN is contacted. */
const PREFIX = 'CAPBALL-LAN1:'
const LIMIT = 24000

export function encodeLanSignal(description) {
  return PREFIX + btoa(JSON.stringify({ type: description.type, sdp: description.sdp }))
}

export function decodeLanSignal(text, expected) {
  const value = String(text).trim()
  if (!value.startsWith(PREFIX) || value.length > LIMIT * 2) throw new Error('Use a CapBall LAN pairing code.')
  let signal
  try { signal = JSON.parse(atob(value.slice(PREFIX.length))) } catch { throw new Error('That pairing code is incomplete. Scan or copy it again.') }
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

export function createLanPeer({ onChannel, onFailure, PeerConnection = globalThis.RTCPeerConnection } = {}) {
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
