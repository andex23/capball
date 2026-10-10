import { randomBytes } from 'node:crypto'
import { anytimeConfig, createAnytimeState, resolveAnytimeTurn } from '../src/game/anytime.js'
import { sanitizeTeam, sanitizeTournament, applyResults, readyFixtures, teamById } from '../src/game/tournament.js'

export const DATABASE_URL = 'https://tmbittgluvbpuoygrrqb.supabase.co'
export function makeDatabase({ key = process.env.SUPABASE_SERVICE_ROLE_KEY, url = process.env.SUPABASE_URL || DATABASE_URL, fetchImpl = fetch } = {}) {
  return async (action, token, code, data = {}) => {
    if (!key) throw new Error('not-configured')
    const response = await fetchImpl(`${url}/rest/v1/rpc/cb_anytime_service`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: action, p_token: token, p_code: code || null, p_data: data }),
      signal: AbortSignal.timeout(15000),
    })
    const body = await response.json()
    if (!response.ok) {
      if (body?.code === 'PGRST202' || body?.code === '42P01') throw new Error('migration-needed')
      throw new Error(body?.message || 'server-unavailable')
    }
    return body
  }
}
const code = () => randomBytes(5).toString('hex').toUpperCase()
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Public commands are deliberately separate from the privileged database RPC. */
export async function handleAnytime(input, db = makeDatabase()) {
  if (!input || typeof input !== 'object' || typeof input.token !== 'string' || input.token.length < 20 || input.token.length > 200) throw new Error('signed-out')
  const { action, token } = input
  if (action === 'list') return db('list', token)
  if (action === 'create') {
    // Casual games have no expiry. Deadlines are a hosted competition option.
    const config = anytimeConfig({ ...input.config, deadlineHours: 0, knockout: false })
    return db('create', token, null, { code: code(), config, state: createAnytimeState(config) })
  }
  if (action === 'fixture') {
    if (typeof input.deviceToken !== 'string' || input.deviceToken.length > 100) throw new Error('not-your-team')
    const snapshot = await db('fixture-context', token, input.code, { deviceToken: input.deviceToken })
    const t = applyResults(sanitizeTournament(snapshot.setup), snapshot.results)
    if (!t || t.playMode !== 'anytime' || snapshot.closed) throw new Error('closed')
    const f = readyFixtures(t).find(f => f.id === input.fixtureId)
    // A finished match remains resumable in My matches, never recreated.
    if (!f) throw new Error('fixture-not-ready')
    const mine = snapshot.seats.filter(s => s.mine).map(s => s.teamId)
    const role = mine.includes(f.home) ? 'team1' : mine.includes(f.away) ? 'team2' : null
    if (!role) throw new Error('not-your-team')
    if (mine.includes(f.home) && mine.includes(f.away)) throw new Error('different-account-needed')
    const teams = { team1: teamById(t, f.home), team2: teamById(t, f.away) }
    if (teams.team1.cpu || teams.team2.cpu) throw new Error('friends-only')
    const config = anytimeConfig({ teams, turnsPerPlayer: t.turnsPerPlayer, deadlineHours: t.deadlineHours, knockout: t.format === 'knockout' })
    return db('fixture', token, input.code, { code: code(), fixtureId: f.id, home: f.home, away: f.away, role, deviceToken: input.deviceToken, config, state: createAnytimeState(config) })
  }
  if (typeof input.code !== 'string' || !/^[A-Z0-9]{10}$/i.test(input.code)) throw new Error('bad-code')
  if (action === 'get' || action === 'resign') return db(action, token, input.code)
  if (action === 'join') return db('join', token, input.code, { team: sanitizeTeam(input.team, 1) })
  if (action === 'turn') {
    if (!uuid.test(input.requestId) || !Number.isInteger(input.version) || input.version < 0) throw new Error('bad-turn')
    const guard = { requestId: input.requestId, version: input.version }
    const match = await db('prepare', token, input.code, guard)
    if (match.alreadyApplied) return match
    const state = resolveAnytimeTurn(match.state, match.config, input.move)
    return db('commit', token, input.code, { ...guard, state })
  }
  throw new Error('bad-action')
}

export const ERRORS = {
  'not-configured': 'Play anytime is waiting for server configuration. Live matches are available.',
  'migration-needed': 'Play anytime needs its database update before matches can be saved.',
  'signed-out': 'Sign in to save and resume online matches.',
  'not-found': 'No saved match has that code.', 'bad-code': 'Enter the 10-character saved match code.',
  'taken': 'This match already has two players.', 'not-a-player': 'This match belongs to other players.',
  'stale-turn': 'The match has moved on. Refresh to see the saved turn.',
  'not-your-turn': 'It is your opponent’s turn.', 'not-your-cap': 'Choose one of your own caps.',
  'match-not-active': 'The match is waiting for a player or has finished. Refresh to see its status.',
  'match-finished': 'This match has finished.', 'bad-turn': 'This turn could not be submitted.',
  'bad-velocity': 'Try aiming the shot again.', 'set-piece-taker-only': 'Use the highlighted set-piece taker.',
  'keeper-out-of-range': 'The ball is too far from your goalkeeper.',
  'too-many-matches': 'Finish or resign an existing match before creating another.',
  'different-account-needed': 'Each side needs a different player account and team seat.',
  'not-your-team': 'Claim your team in the tournament before opening this match.',
  'fixture-not-ready': 'This fixture has finished or its round is not ready. Refresh the tournament.',
  'use-tournament': 'Open this fixture from its tournament.', 'closed': 'This competition is not available for Play anytime.',
  'friends-only': 'Play anytime competitions need a friend for each team.',
}
