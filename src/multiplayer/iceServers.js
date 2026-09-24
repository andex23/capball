/**
 * ICE servers for the WebRTC connection between the two players.
 *
 * STUN lets two browsers find a direct route to each other. When one of them
 * is behind a strict NAT (lots of mobile networks, office and school Wi-Fi)
 * there is no direct route and the traffic has to go through a relay — a TURN
 * server. Relays cost money to run, so none is hard-coded here: configure one
 * with VITE_ICE_SERVERS or VITE_TURN_URL / _USERNAME / _CREDENTIAL (see README).
 *
 * Everything in this file is pure so it can be unit tested.
 */

/** Public STUN servers, always included. */
export const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

const ICE_URL = /^(stun|stuns|turn|turns):\S+$/i
const isRelayUrl = (url) => /^turns?:/i.test(url)
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function cleanUrls(urls) {
  const list = Array.isArray(urls) ? urls : typeof urls === 'string' ? urls.split(',') : []
  return list
    .filter((u) => typeof u === 'string')
    .map((u) => u.trim())
    .filter((u) => ICE_URL.test(u))
}

/**
 * Validate one RTCIceServer-like entry. TURN urls need a username and
 * credential (RTCPeerConnection throws without them), so relay urls without
 * both are dropped. Returns null when nothing usable is left.
 */
export function normalizeIceServer(entry) {
  if (!isObj(entry)) return null
  let urls = cleanUrls(entry.urls ?? entry.url)
  const hasAuth = typeof entry.username === 'string' && typeof entry.credential === 'string'
  if (!hasAuth) urls = urls.filter((u) => !isRelayUrl(u))
  if (!urls.length) return null
  const server = { urls: urls.length === 1 ? urls[0] : urls }
  if (hasAuth && urls.some(isRelayUrl)) {
    server.username = entry.username
    server.credential = entry.credential
  }
  return server
}

/** VITE_ICE_SERVERS: a JSON array of RTCIceServer objects (a single object is accepted too). Bad JSON → []. */
export function parseIceServersJson(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list.map(normalizeIceServer).filter(Boolean)
}

/** VITE_TURN_URL (comma-separated for several) + VITE_TURN_USERNAME + VITE_TURN_CREDENTIAL. */
export function turnServerFromEnv(env) {
  if (!env?.VITE_TURN_URL) return []
  const server = normalizeIceServer({
    urls: env.VITE_TURN_URL,
    username: env.VITE_TURN_USERNAME,
    credential: env.VITE_TURN_CREDENTIAL,
  })
  return server ? [server] : []
}

/** Does this list include a relay (TURN) server? */
export function hasRelay(servers) {
  return Array.isArray(servers) && servers.some((s) => [].concat(s?.urls).some((u) => typeof u === 'string' && isRelayUrl(u)))
}

/**
 * The ICE servers to hand PeerJS: the public STUN defaults plus anything
 * configured in the environment. `fallback` (PeerJS's own defaults) is only
 * used when no relay is configured, so an operator's own TURN server isn't
 * mixed with someone else's. Duplicates are removed.
 */
export function buildIceServers(env = {}, { base = DEFAULT_ICE_SERVERS, fallback = [] } = {}) {
  const configured = [...parseIceServersJson(env?.VITE_ICE_SERVERS), ...turnServerFromEnv(env)]
  const extra = hasRelay(configured) ? [] : fallback
  const out = []
  const seen = new Set()
  for (const entry of [...base, ...configured, ...extra]) {
    const server = normalizeIceServer(entry)
    if (!server) continue
    const key = `${[].concat(server.urls).join(',')}|${server.username || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(server)
  }
  return out
}

/* ── Connection errors → something a player can act on ── */

/** PeerJS / our own error types that mean "signalling worked but no route was found". */
const ICE_ERRORS = new Set(['negotiation-failed', 'webrtc', 'ice-failed', 'connect-timeout'])
const SERVER_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected', 'server-timeout'])

export function isIceFailure(err) {
  return !!err && ICE_ERRORS.has(err.type)
}

export const ICE_FAILED_MSG = 'Couldn’t connect directly — one of you may be on a strict network (mobile data, office or school Wi-Fi). Try switching one of you to another network.'
const ICE_FAILED_RELAY_MSG = 'Couldn’t connect, even through the relay server — one of you may be on a very strict network. Try switching one of you to another network.'

/** A short, actionable message for a failed connection attempt. */
export function connectErrorMessage(err, { relay = false } = {}) {
  const type = err?.type
  if (isIceFailure(err)) return relay ? ICE_FAILED_RELAY_MSG : ICE_FAILED_MSG
  if (type === 'peer-unavailable') return 'Room not found. Check the code.'
  if (type === 'room-in-use') return 'That room already has two players.'
  if (type === 'connection-closed' || type === 'bad-welcome') return 'The connection closed before the match could start. Try again.'
  if (type === 'browser-incompatible') return 'This browser doesn’t support online play. Try an up-to-date Chrome, Safari or Firefox.'
  if (SERVER_ERRORS.has(type)) return 'Couldn’t reach the matchmaking server. Check your internet connection and try again.'
  return `Connection error (${type || 'unknown'}).`
}
