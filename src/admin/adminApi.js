/**
 * Calls for the admin console. It has its own logins (email + password,
 * see supabase/admin.sql), separate from game accounts. Everything after
 * sign-in goes through cb_admin(token, action, data).
 */
import { rpc } from '../online/supabase'

const KEY = 'capball:hq'

export const MESSAGES = {
  'signed-out': 'Your session ended. Sign in again.',
  'wrong-login': 'Wrong email or password.',
  'too-many-tries': 'Too many wrong tries. Wait 15 minutes and try again.',
  'bad-email': 'Enter a valid email address.',
  'weak-password': 'Use at least 10 characters for the password.',
  'bad-password': 'Player passwords need 6 to 72 characters.',
  'setup-done': 'An admin login already exists. Sign in instead.',
  'email-taken': 'That email already has an admin login.',
  'wrong-current': 'Your current password is wrong.',
  'not-found': 'That no longer exists.',
  'not-yourself': 'You can’t remove your own login.',
  'player-in-matches': 'This player is in Play anytime matches, so the account can’t be deleted. Sign them out instead.',
  'tournament-in-use': 'This tournament has Play anytime matches. Close it instead.',
  'ad-too-long': 'Each board message can be at most 24 characters.',
  'bad-ads': 'Each list needs 1 to 8 messages.',
  'ads-missing': 'The ad boards aren’t set up yet. Run supabase/arena-ads.sql in Supabase, then reload.',
  'bad-action': 'The admin database is out of date. Run supabase/admin.sql again.',
  missing: 'The admin database isn’t set up yet. Run supabase/admin.sql in Supabase, then reload.',
  offline: 'You’re offline. Check your connection.',
}

export function messageFor(error) {
  const code = error?.code || ''
  if (MESSAGES[code]) return MESSAGES[code]
  if (/cb_admin_ads|cb_arena_ads/i.test(`${code} ${error?.message}`)) return MESSAGES['ads-missing']
  if (/cb_admin|PGRST202|http-404|schema cache/i.test(`${code} ${error?.message}`)) return MESSAGES.missing
  return error?.message || 'Something went wrong.'
}

export function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s && typeof s.token === 'string' && typeof s.email === 'string') return s
  } catch { /* blocked */ }
  return null
}

export function saveSession(s) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch { /* fine: this visit only */ }
}

const fail = (r) => { if (r?.error) throw Object.assign(new Error(r.error), { code: r.error }); return r }
export const status = () => rpc('cb_admin_status', {})
export const setup = (email, password) => rpc('cb_admin_setup', { p_email: email, p_password: password }).then(fail)
export const login = (email, password) => rpc('cb_admin_login', { p_email: email, p_password: password }).then(fail)
export const logout = (token) => rpc('cb_admin_logout', { p_token: token }).catch(() => null)
export const call = (token, action, data = {}) => rpc('cb_admin', { p_token: token, p_action: action, p_data: data })
export const callAds = (token, action, data = {}) => rpc('cb_admin_ads', { p_token: token, p_action: action, p_data: data })

/** What a player's save says about them (their game's own localStorage, copied up). */
export function summariseSave(save) {
  const items = save?.items && typeof save.items === 'object' ? save.items : {}
  const parse = (k) => { try { return items[k] ? JSON.parse(items[k]) : null } catch { return null } }
  const career = parse('capball:career-mode:v1')
  const record = parse('capball:career:v1')
  const hall = parse('capball:career-hof:v1')
  return {
    keys: Object.keys(items).length,
    club: career?.club?.name || null,
    level: Number.isInteger(career?.level) ? career.level : null,
    season: career?.season ?? null,
    coins: Number.isFinite(career?.coins) ? career.coins : null,
    sacked: !!career?.sacked,
    played: record?.played ?? null,
    won: record?.won ?? null,
    drawn: record?.drawn ?? null,
    lost: record?.lost ?? null,
    goalsFor: record?.goalsFor ?? null,
    hall: Array.isArray(hall) ? hall.length : 0,
  }
}
