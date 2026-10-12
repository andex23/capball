/**
 * Server side of the Lagos Life integration: posting friend-match results.
 *
 * Lagos Life only takes match results from a game's server, signed with the
 * game's results secret. A phone sends { session, matchId, winner }; this
 * checks the session with Lagos Life, checks the player is in that match and
 * that the winner is one of its two players (or a draw), then posts it.
 *
 * It also unlocks caps players buy: it checks the purchase with Lagos Life,
 * records it (so the cap follows the player to any phone), then marks it
 * delivered. Nothing is unlocked from what a phone says alone.
 *
 * Environment (set in Vercel, never in the code):
 *   VATAR_SECRET               vtr_test_… or vtr_live_…
 *   VATAR_RESULTS_SECRET       the results signing secret
 *   SUPABASE_SERVICE_ROLE_KEY  for the bought-caps table (supabase/lagos.sql)
 *   VATAR_WEBHOOK_SECRET       vtr_whsec_… (checks webhooks really come from Lagos Life)
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { isProduct } from '../src/data/shop.js'

const DATABASE_URL = 'https://tmbittgluvbpuoygrrqb.supabase.co'

export const API_BASE = 'https://lagoslife.app/api/games/v1'
const API_PATH = new URL(API_BASE).pathname

export const ERRORS = {
  'not-configured': 'Friend matches aren’t set up on the server yet.',
  'bad-request': 'That request wasn’t understood.',
  'bad-session': 'Your Lagos Life session has expired. Open the game again.',
  'not-in-match': 'You’re not in that match.',
  'not-playing': 'That match isn’t in play.',
  'bad-winner': 'That winner isn’t in the match.',
  'bad-purchase': 'That purchase couldn’t be found for you.',
  'refunded': 'That purchase was refunded.',
  'migration-needed': 'The shop isn’t set up on the server yet.',
}

const fail = (code) => { throw new Error(code) }
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** The signature Lagos Life expects on a result (see their docs: method, path, timestamp, nonce, body hash). */
export function signResult({ secret, path, ts, nonce, body }) {
  return 'v1=' + createHmac('sha256', secret).update(['POST', path, String(ts), nonce, sha256(body)].join('\n')).digest('hex')
}

export function makeApi({ secret = process.env.VATAR_SECRET, resultsSecret = process.env.VATAR_RESULTS_SECRET, fetchImpl = fetch, now = Date.now } = {}) {
  if (!secret) return null
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
    getPurchase: (id) => call('GET', `/purchases/${encodeURIComponent(id)}`),
    deliver: (id) => call('POST', `/purchases/${encodeURIComponent(id)}/deliver`, { body: '{}' }),
    postResult: (match, winner) => {
      if (!resultsSecret) fail('not-configured')
      const path = `/matches/${encodeURIComponent(match.id)}/result`
      const body = JSON.stringify({ winner })
      const ts = Math.floor(now() / 1000)
      const sig = signResult({ secret: resultsSecret, path: API_PATH + path, ts, nonce: match.nonce, body })
      return call('POST', path, { body, headers: { 'x-vatar-timestamp': String(ts), 'x-vatar-signature': sig } })
    },
  }
}

/** The bought-caps table (supabase/lagos.sql), through its service-only function. */
export function makeOwnedDb({ key = process.env.SUPABASE_SERVICE_ROLE_KEY, url = process.env.SUPABASE_URL || DATABASE_URL, fetchImpl = fetch } = {}) {
  if (!key) return null
  return async (action, mode, player, product = null, purchase = null) => {
    const res = await fetchImpl(`${url}/rest/v1/rpc/cb_lagos_service`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: action, p_mode: mode, p_player: player, p_product: product, p_purchase: purchase }),
      signal: AbortSignal.timeout?.(10000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      if (body?.code === 'PGRST202' || body?.code === '42P01') fail('migration-needed')
      throw new Error('upstream')
    }
    return Array.isArray(body) ? body.filter(isProduct) : []
  }
}

const ID = /^[A-Za-z0-9_-]{1,80}$/

async function whoIs(api, session) {
  if (typeof session !== 'string' || !session || session.length > 4096) fail('bad-request')
  const who = await api.verifySession(session)
  if (who.status !== 200 || !who.data?.playerId) fail('bad-session')
  return { playerId: who.data.playerId, mode: who.data.mode === 'live' ? 'live' : 'test' }
}

/** A cap bought: check it with Lagos Life, record it, mark it delivered. */
async function claim({ session, purchaseId }, api, db) {
  if (!db) fail('not-configured')
  if (!ID.test(purchaseId || '')) fail('bad-request')
  const { playerId, mode } = await whoIs(api, session)
  const p = await api.getPurchase(purchaseId)
  if (p.status === 404) fail('bad-purchase')
  if (p.status !== 200) throw new Error('upstream')
  const buy = p.data || {}
  if (buy.playerId !== playerId || !isProduct(buy.productId)) fail('bad-purchase')
  if (buy.status === 'refunded') fail('refunded')
  if (buy.status !== 'paid' && buy.status !== 'delivered') fail('bad-purchase')
  // Record first: if delivery fails, Lagos Life offers it again and we record nothing twice
  const owned = await db('grant', buy.mode === 'live' ? 'live' : mode, playerId, buy.productId, buy.id || purchaseId)
  const d = await api.deliver(buy.id || purchaseId)
  if (d.status !== 200 && d.status !== 201 && d.status !== 204) throw new Error('upstream')
  return { ok: true, productId: buy.productId, owned }
}

export async function handleLagos(input, api = makeApi(), db = makeOwnedDb()) {
  if (!api) fail('not-configured')
  if (input?.action === 'claim') return claim(input, api, db)
  if (input?.action === 'owned') {
    if (!db) fail('not-configured')
    const { playerId, mode } = await whoIs(api, input.session)
    return { ok: true, owned: await db('list', mode, playerId) }
  }
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

/* ── Webhook: Lagos Life tells us a purchase was paid ── */

/** Is `header` (X-Vatar-Signature: sha256=<hex>) the HMAC of the raw body? Constant-time. */
export function webhookSigned(raw, header, secret) {
  if (!secret || typeof header !== 'string' || !header.startsWith('sha256=')) return false
  const want = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'))
  const got = Buffer.from(header.slice(7))
  return want.length === got.length && timingSafeEqual(want, got)
}

/**
 * A signed webhook. For purchase.paid we treat it as a nudge: look the
 * purchase up with Lagos Life ourselves, then record and deliver it, the same
 * as when the game claims it. So a cap reaches the player even if the game
 * closed straight after paying. Anything else is acknowledged and ignored.
 */
export async function handleWebhook(event, api = makeApi(), db = makeOwnedDb()) {
  if (event?.type !== 'purchase.paid') return { ok: true, ignored: true }
  if (!api || !db) fail('not-configured')
  const id = event.data?.purchaseId
  if (!ID.test(id || '')) fail('bad-request')
  const p = await api.getPurchase(id)
  if (p.status === 404) return { ok: true, ignored: true }
  if (p.status !== 200) throw new Error('upstream')
  const buy = p.data || {}
  if (!buy.playerId || !isProduct(buy.productId) || buy.status === 'refunded') return { ok: true, ignored: true }
  if (buy.status !== 'paid' && buy.status !== 'delivered') return { ok: true, ignored: true }
  await db('grant', buy.mode === 'live' ? 'live' : 'test', buy.playerId, buy.productId, buy.id || id)
  const d = await api.deliver(buy.id || id)
  if (d.status !== 200 && d.status !== 201 && d.status !== 204) throw new Error('upstream')
  return { ok: true }
}
