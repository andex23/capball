/**
 * Tiny client for the CAPBALL Supabase project (online tournaments).
 *
 * Only calls the cb_* database functions (see supabase/tournaments.sql) over
 * plain fetch — no SDK, so it adds almost nothing to the download. The anon
 * key is public by design: the tables are locked and every function checks
 * this device's own secret token.
 */

const DEFAULT_URL = 'https://tmbittgluvbpuoygrrqb.supabase.co'
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtYml0dGdsdXZicHVveWdycnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTY0ODUsImV4cCI6MjEwNzAzMjQ4NX0.nSq0jgefoIPderkGoY-x_iFDMLshWRQtSvnwzU0ddkA'

const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {}
export const SUPABASE_URL = env.VITE_SUPABASE_URL || DEFAULT_URL
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY
// Only for the #dbcheck page, which proves the tables can't be read with it
export const ANON_KEY_FOR_CHECK = ANON_KEY

const DEVICE_KEY = 'capball.device'
let memoryToken = null

/** This device's secret (made once, kept in localStorage). */
export function deviceToken(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const saved = storage?.getItem(DEVICE_KEY)
    if (saved && /^[0-9a-f]{40}$/.test(saved)) return saved
  } catch { /* storage blocked */ }
  if (!memoryToken) {
    const bytes = new Uint8Array(20)
    globalThis.crypto.getRandomValues(bytes)
    memoryToken = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  try { storage?.setItem(DEVICE_KEY, memoryToken) } catch { /* fine: lasts this session */ }
  return memoryToken
}

/** Readable messages for the errors the database functions raise. */
const MESSAGES = {
  'bad-stats': 'Those numbers don’t add up, so they weren’t posted.',
  'bad-period': 'That leaderboard doesn’t exist.',
  'not-found': 'No tournament with that code.',
  'taken': 'Someone else already has that team.',
  'no-seat': 'That team is played by the computer.',
  'closed': 'That tournament has finished.',
  'already-reported': 'That result is already in.',
  'not-your-fixture': 'Only the two teams in a match can report it.',
  'not-your-team': 'That isn’t your team.',
  'needs-winner': 'A cup tie needs a winner — go to penalties.',
  'host-only': 'Only the tournament’s host can do that.',
  'match-in-progress': 'Wait until the current match finishes before editing teams.',
  'bad-setup': 'That tournament set-up isn’t valid.',
  'offline': 'You’re offline — check your connection.',
  'username-taken': 'That username is taken. Try another.',
  'bad-username': 'Usernames are 3–20 letters, numbers or _ (no spaces).',
  'bad-password': 'Passwords need at least 6 characters.',
  'wrong-login': 'Wrong username or password.',
  'too-many-tries': 'Too many wrong tries. Wait 15 minutes and try again.',
  'signed-out': 'You were signed out. Sign in again.',
  'bad-save': 'Your save is too big to upload.',
}

export class ApiError extends Error {
  constructor(code, detail) {
    super(MESSAGES[code] || detail || 'Something went wrong talking to the server.')
    this.code = code
  }
}

/** Call a database function. Resolves with its JSON result. */
export async function rpc(fn, args, { fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('offline')
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  let res
  try {
    res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctrl?.signal,
    })
  } catch {
    throw new ApiError('offline')
  } finally {
    if (timer) clearTimeout(timer)
  }
  let body = null
  try { body = await res.json() } catch { /* empty */ }
  if (!res.ok) {
    const code = typeof body?.message === 'string' ? body.message : `http-${res.status}`
    throw new ApiError(code, body?.message)
  }
  return body
}

/* ── Tournament calls ── */

export const api = {
  get: (code) => rpc('cb_get_tournament', { p_code: code, p_token: deviceToken() }),
  create: (setup) => rpc('cb_create_tournament', { p_setup: setup, p_token: deviceToken() }),
  claim: (code, teamId) => rpc('cb_claim_seat', { p_code: code, p_team_id: teamId, p_token: deviceToken() }),
  updateTeam: (code, teamId, config) => rpc('cb_update_team', { p_code: code, p_team_id: teamId, p_token: deviceToken(), p_config: config }),
  release: (code, teamId) => rpc('cb_release_seat', { p_code: code, p_team_id: teamId, p_token: deviceToken() }),
  report: (code, fixture, result) => rpc('cb_report_result', {
    p_code: code, p_token: deviceToken(), p_fixture_id: fixture.id,
    p_home_team: fixture.home, p_away_team: fixture.away,
    p_home: result.home, p_away: result.away,
    p_pens_home: result.pens?.home ?? null, p_pens_away: result.pens?.away ?? null,
  }),
  deleteResult: (code, fixtureId) => rpc('cb_delete_result', { p_code: code, p_token: deviceToken(), p_fixture_id: fixtureId }),
  setRoom: (code, fixtureId, teamId, roomCode) => rpc('cb_set_room', { p_code: code, p_token: deviceToken(), p_fixture_id: fixtureId, p_team_id: teamId, p_room_code: roomCode }),
  close: (code) => rpc('cb_close_tournament', { p_code: code, p_token: deviceToken() }),
}
