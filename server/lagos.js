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
  'not-configured': 'The game server isn’t set up for Lagos Life yet.',
  'shop-not-configured': 'The shop server isn’t set up yet.',
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
/** Something upstream said no: log what (status and error code only, never keys), then fail. */
function upstream(where, status, body) {
  const why = body && typeof body === 'object' ? (body.code || body.error || '') + ' ' + String(body.message || body.hint || '').slice(0, 160) : ''
  console.error(`[lagos] ${where} failed: ${status} ${why}`.trim())
  throw new Error('upstream')
}
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
      if (body?.code === 'PGRST202' || body?.code === '42P01') { console.error('[lagos] database function missing: run supabase/lagos.sql'); fail('migration-needed') }
      upstream('database', res.status, body)
    }
    return Array.isArray(body) ? body.filter(isProduct) : []
  }
}

/** Each player's game save (supabase/lagos.sql), through its service-only function. */
export function makeSaveDb({ key = process.env.SUPABASE_SERVICE_ROLE_KEY, url = process.env.SUPABASE_URL || DATABASE_URL, fetchImpl = fetch } = {}) {
  if (!key) return null
  return async (action, mode, player, data = null) => {
    const res = await fetchImpl(`${url}/rest/v1/rpc/cb_lagos_save_service`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: action, p_mode: mode, p_player: player, p_data: data }),
      signal: AbortSignal.timeout?.(10000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      if (body?.code === 'PGRST202' || body?.code === '42P01') { console.error('[lagos] database function missing: run supabase/lagos.sql'); fail('migration-needed') }
      upstream('database', res.status, body)
    }
    return body
  }
}

/** Result reports for staked matches (supabase/lagos.sql): each player's say, once. */
export function makeReportDb({ key = process.env.SUPABASE_SERVICE_ROLE_KEY, url = process.env.SUPABASE_URL || DATABASE_URL, fetchImpl = fetch } = {}) {
  if (!key) return null
  return async (mode, matchId, player, winner) => {
    const res = await fetchImpl(`${url}/rest/v1/rpc/cb_lagos_report_service`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_mode: mode, p_match: matchId, p_player: player, p_winner: winner }),
      signal: AbortSignal.timeout?.(10000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      if (body?.code === 'PGRST202' || body?.code === '42P01') { console.error('[lagos] database function missing: run supabase/lagos.sql'); fail('migration-needed') }
      upstream('database', res.status, body)
    }
    return Array.isArray(body) ? body : []
  }
}

/**
 * What to post for a staked match, from the players' reports
 * ([{ player, winner }], at most one each). Money moves only on agreement:
 * - a player saying they lost is believed straight away (no one lies to lose);
 * - otherwise both must say the same; if they differ, it's a draw and
 *   Lagos Life gives both stakes back.
 * Returns the winner to post, 'draw', or null to wait for the other phone.
 */
export function stakedOutcome(reports, players) {
  for (const r of reports) {
    const other = players.find((p) => p !== r.player)
    if (other && r.winner === other) return other
  }
  if (reports.length < 2) return null
  const [a, b] = reports
  return a.winner === b.winner ? a.winner : 'draw'
}

/* ── Usage counts ──
   How the Lagos Life build is being used: opens, matches, how "find a player"
   goes, and the errors players hit. One small document a day, kept through the
   saves function under a reserved name no real player id can take. Counts only:
   players are remembered as a short one-way hash, to count different people. */
export const COUNT_EVENTS = ['open', 'match_start', 'match_end', 'find', 'find_ok', 'paired', 'find_cancel', 'pitch_lost', 'pitch_back', 'pitch_dead', 'error']
const DETAIL = /^[a-z0-9_]{1,40}$/
const statsKey = (day) => `__stats__:${day}`
export const dayOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
const emptyDay = () => ({ v: 1, counts: {}, players: [] })
const cleanDay = (d) => (d && d.v === 1 && d.counts && typeof d.counts === 'object' && Array.isArray(d.players) ? d : emptyDay())

/** Add one to today's count for this event (and remember that this player was here). Never throws. */
export async function countEvent(saves, mode, playerId, event, detail = null, now = Date.now()) {
  if (!saves || !COUNT_EVENTS.includes(event)) return false
  const name = typeof detail === 'string' && DETAIL.test(detail) ? `${event}:${detail}` : event
  try {
    const key = statsKey(dayOf(now))
    const day = cleanDay((await saves('get', mode, key))?.data)
    day.counts[name] = (day.counts[name] || 0) + 1
    const who = createHash('sha256').update(String(playerId)).digest('hex').slice(0, 10)
    if (!day.players.includes(who) && day.players.length < 5000) day.players.push(who)
    await saves('put', mode, key, day)
    return true
  } catch { return false }
}

/** The last `days` days of counts for one mode, newest first: [{ day, players, counts }]. */
export async function readStats(saves, mode, days = 14, now = Date.now()) {
  if (!saves) return []
  const out = []
  for (let i = 0; i < Math.min(60, Math.max(1, days)); i++) {
    const day = dayOf(now - i * 86400000)
    try {
      const d = (await saves('get', mode, statsKey(day)))?.data
      if (d) { const c = cleanDay(d); out.push({ day, players: c.players.length, counts: c.counts }) }
    } catch { /* skip a day that can't be read */ }
  }
  return out
}

/** Is this the stats key from the server's settings? (Stats are for the owner only.) */
export function statsAllowed(given, env = process.env) {
  const want = env.LAGOS_STATS_KEY
  if (!want || typeof given !== 'string' || !given) return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(String(want)).digest()
  return timingSafeEqual(a, b)
}

/** A save is the game's own storage entries: { v: 1, items: { key: string } }. */
export function cleanSave(data) {
  if (!data || data.v !== 1 || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) return null
  const items = {}
  for (const [k, v] of Object.entries(data.items)) {
    if (typeof k === 'string' && k.length <= 64 && /^(capball|counterball)[:.]/.test(k) && typeof v === 'string') items[k] = v
  }
  return { v: 1, items }
}

/** Can the server reach its database functions? 'ok', 'missing-key', 'migration-needed' or 'error'. */
export async function databaseCheck(db = makeOwnedDb()) {
  if (!db) return 'missing-key'
  try { await db('list', 'test', '__health_check__'); return 'ok' } catch (e) { return e.message === 'migration-needed' ? 'migration-needed' : 'error' }
}

/** Which settings the server has (true/false only). */
export function lagosConfigured(env = process.env) {
  return {
    lagosLifeKey: Boolean(env.VATAR_SECRET),
    // Which kind of key it is (live or test), never the key itself
    lagosLifeMode: env.VATAR_SECRET ? (String(env.VATAR_SECRET).startsWith('vtr_live_') ? 'live' : String(env.VATAR_SECRET).startsWith('vtr_test_') ? 'test' : 'unknown') : null,
    resultsSecret: Boolean(env.VATAR_RESULTS_SECRET),
    webhookSecret: Boolean(env.VATAR_WEBHOOK_SECRET),
    shopDatabaseKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
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
  if (!db) fail('shop-not-configured')
  if (!ID.test(purchaseId || '')) fail('bad-request')
  const { playerId, mode } = await whoIs(api, session)
  const p = await api.getPurchase(purchaseId)
  if (p.status === 404) fail('bad-purchase')
  if (p.status !== 200) upstream('get purchase', p.status, p.data)
  const buy = p.data || {}
  if (buy.playerId !== playerId || !isProduct(buy.productId)) fail('bad-purchase')
  if (buy.status === 'refunded') fail('refunded')
  if (buy.status !== 'paid' && buy.status !== 'delivered') fail('bad-purchase')
  // Record first: if delivery fails, Lagos Life offers it again and we record nothing twice
  const owned = await db('grant', buy.mode === 'live' ? 'live' : mode, playerId, buy.productId, buy.id || purchaseId)
  const d = await api.deliver(buy.id || purchaseId)
  if (d.status !== 200 && d.status !== 201 && d.status !== 204) upstream('deliver purchase', d.status, d.data)
  return { ok: true, productId: buy.productId, owned }
}

export async function handleLagos(input, api = makeApi(), db = makeOwnedDb(), saves = makeSaveDb(), reports = makeReportDb()) {
  if (!api) fail('not-configured')
  // The player's save: always the verified player's own, never anyone else's
  if (input?.action === 'loadSave' || input?.action === 'putSave') {
    if (!saves) fail('shop-not-configured')
    const { playerId, mode } = await whoIs(api, input.session)
    if (input.action === 'loadSave') {
      const r = await saves('get', mode, playerId)
      return { ok: true, data: cleanSave(r?.data) }
    }
    const data = cleanSave(input.data)
    if (!data) fail('bad-request')
    await saves('put', mode, playerId, data)
    return { ok: true }
  }
  // A Lagos Life error a player hit, for our logs only (never shown to players)
  if (input?.action === 'logError') {
    const code = typeof input.code === 'string' && /^[a-z_]{1,40}$/.test(input.code) ? input.code : 'unknown'
    const where = typeof input.where === 'string' && /^[a-z_]{1,24}$/.test(input.where) ? input.where : 'unknown'
    const { playerId, mode } = await whoIs(api, input.session)
    console.warn(JSON.stringify({ lagosError: code, where, mode, player: playerId }))
    await countEvent(saves, mode, playerId, 'error', `${where}_${code}`.slice(0, 40))
    return { ok: true }
  }
  // One more of something that happened in the game (see countEvent)
  if (input?.action === 'count') {
    if (!COUNT_EVENTS.includes(input.event) || input.event === 'error') fail('bad-request')
    const { playerId, mode } = await whoIs(api, input.session)
    await countEvent(saves, mode, playerId, input.event, input.detail)
    return { ok: true }
  }
  if (input?.action === 'claim') return claim(input, api, db)
  if (input?.action === 'owned') {
    if (!db) fail('shop-not-configured')
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
  if (m.status !== 200) upstream('get match', m.status, m.data)
  const match = m.data
  const players = (match.players || []).map((p) => p.playerId ?? p.id)
  if (!players.includes(playerId)) fail('not-in-match')
  // Already settled (the other phone got there first) counts as done
  if (match.status === 'done') return { ok: true, settled: true }
  if (match.status !== 'playing' || !match.nonce) fail('not-playing')
  if (winner !== 'draw' && !players.includes(winner)) fail('bad-winner')
  // A bet: post only what both players back (see stakedOutcome)
  let post = winner
  if (Number(match.stake) > 0) {
    if (!reports) fail('shop-not-configured')
    const said = await reports(match.mode === 'live' ? 'live' : who.data.mode === 'live' ? 'live' : 'test', match.id || matchId, playerId, winner)
    post = stakedOutcome(said, players)
    if (!post) return { ok: true, waiting: true }
  }

  const r = await api.postResult({ id: match.id || matchId, nonce: match.nonce }, post)
  if (r.status === 200 || r.status === 201) return { ok: true, posted: post }
  if (r.status === 409 && r.data?.error === 'already_settled') return { ok: true, settled: true }
  if (r.status === 409) fail('not-playing')
  upstream('post result', r.status, r.data)
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
  if (p.status !== 200) upstream('get purchase', p.status, p.data)
  const buy = p.data || {}
  if (!buy.playerId || !isProduct(buy.productId) || buy.status === 'refunded') return { ok: true, ignored: true }
  if (buy.status !== 'paid' && buy.status !== 'delivered') return { ok: true, ignored: true }
  await db('grant', buy.mode === 'live' ? 'live' : 'test', buy.playerId, buy.productId, buy.id || id)
  const d = await api.deliver(buy.id || id)
  if (d.status !== 200 && d.status !== 201 && d.status !== 204) upstream('deliver purchase', d.status, d.data)
  return { ok: true }
}
