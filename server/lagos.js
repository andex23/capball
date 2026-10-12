/**
 * Server side of the Lagos Life integration: posting friend-match results.
 *
 * Lagos Life only takes match results from a game's server, signed with the
 * game's results secret. A phone sends { session, matchId, winner }; this
 * checks the session with Lagos Life, checks the player is in that match and
 * that the winner is one of its two players (or a draw), then posts it.
 *
 * Environment (set in Vercel, never in the code):
 *   VATAR_SECRET          vtr_test_… or vtr_live_…
 *   VATAR_RESULTS_SECRET  the results signing secret
 */
import { createHash, createHmac } from 'node:crypto'

export const API_BASE = 'https://lagoslife.app/api/games/v1'
const API_PATH = new URL(API_BASE).pathname

export const ERRORS = {
  'not-configured': 'Friend matches aren’t set up on the server yet.',
  'bad-request': 'That request wasn’t understood.',
  'bad-session': 'Your Lagos Life session has expired. Open the game again.',
  'not-in-match': 'You’re not in that match.',
  'not-playing': 'That match isn’t in play.',
  'bad-winner': 'That winner isn’t in the match.',
}

const fail = (code) => { throw new Error(code) }
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** The signature Lagos Life expects on a result (see their docs: method, path, timestamp, nonce, body hash). */
export function signResult({ secret, path, ts, nonce, body }) {
  return 'v1=' + createHmac('sha256', secret).update(['POST', path, String(ts), nonce, sha256(body)].join('\n')).digest('hex')
}

export function makeApi({ secret = process.env.VATAR_SECRET, resultsSecret = process.env.VATAR_RESULTS_SECRET, fetchImpl = fetch, now = Date.now } = {}) {
  if (!secret || !resultsSecret) return null
  const call = async (method, path, { body, headers = {} } = {}) => {
    const res = await fetchImpl(API_BASE + path, {
      method,
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout?.(8000),
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return {
    verifySession: (session) => call('POST', '/session/verify', { body: JSON.stringify({ session }) }),
    getMatch: (id) => call('GET', `/matches/${encodeURIComponent(id)}`),
    postResult: (match, winner) => {
      const path = `/matches/${encodeURIComponent(match.id)}/result`
      const body = JSON.stringify({ winner })
      const ts = Math.floor(now() / 1000)
      const sig = signResult({ secret: resultsSecret, path: API_PATH + path, ts, nonce: match.nonce, body })
      return call('POST', path, { body, headers: { 'x-vatar-timestamp': String(ts), 'x-vatar-signature': sig } })
    },
  }
}

const ID = /^[A-Za-z0-9_-]{1,80}$/

export async function handleLagos(input, api = makeApi()) {
  if (!api) fail('not-configured')
  const { action, session, matchId, winner } = input || {}
  if (action !== 'result' || typeof session !== 'string' || !session || session.length > 4096 || !ID.test(matchId || '') || typeof winner !== 'string' || !(winner === 'draw' || ID.test(winner))) fail('bad-request')

  const who = await api.verifySession(session)
  if (who.status !== 200 || !who.data?.playerId) fail('bad-session')
  const playerId = who.data.playerId

  const m = await api.getMatch(matchId)
  if (m.status === 404) fail('not-in-match')
  if (m.status !== 200) throw new Error('upstream')
  const match = m.data
  const players = (match.players || []).map((p) => p.playerId ?? p.id)
  if (!players.includes(playerId)) fail('not-in-match')
  // Already settled (the other phone got there first) counts as done
  if (match.status === 'done') return { ok: true, settled: true }
  if (match.status !== 'playing' || !match.nonce) fail('not-playing')
  if (winner !== 'draw' && !players.includes(winner)) fail('bad-winner')
  // Friend matches only: Counterball never posts a staked result
  if (Number(match.stake) !== 0) fail('not-playing')

  const r = await api.postResult({ id: match.id || matchId, nonce: match.nonce }, winner)
  if (r.status === 200 || r.status === 201) return { ok: true }
  if (r.status === 409 && r.data?.error === 'already_settled') return { ok: true, settled: true }
  if (r.status === 409) fail('not-playing')
  throw new Error('upstream')
}
