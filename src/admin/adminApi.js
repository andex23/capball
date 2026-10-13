/**
 * Calls for the admin page. Everything goes through one database function,
 * cb_admin(token, action, data), which only answers admin accounts (see
 * supabase/admin.sql). The admin session is kept apart from the game's.
 */
import { rpc } from '../online/supabase'

const KEY = 'capball:admin'

export const MESSAGES = {
  'not-admin': 'This account isn’t an admin. Add it to cb_admins in Supabase first (see supabase/admin.sql).',
  'signed-out': 'Your session ended. Sign in again.',
  'wrong-login': 'Wrong username or password.',
  'too-many-tries': 'Too many wrong tries. Wait 15 minutes and try again.',
  'bad-username': 'Usernames are 3–20 letters, numbers or _.',
  'bad-password': 'Passwords need 6 to 72 characters.',
  'not-found': 'That no longer exists.',
  'not-yourself': 'You can’t delete your own account here.',
  'last-admin': 'There has to be at least one admin.',
  'player-in-matches': 'This player is in Play anytime matches, so the account can’t be deleted. Sign them out instead.',
  'tournament-in-use': 'This tournament has Play anytime matches. Close it instead.',
  'bad-action': 'The admin database is out of date. Run supabase/admin.sql again.',
  'missing': 'The admin database isn’t set up. Run supabase/admin.sql in Supabase.',
  offline: 'You’re offline. Check your connection.',
}

export function messageFor(error) {
  const code = error?.code || ''
  if (MESSAGES[code]) return MESSAGES[code]
  if (/function .*cb_admin|PGRST202|http-404/i.test(`${code} ${error?.message}`)) return MESSAGES.missing
  return error?.message || 'Something went wrong.'
}

export function readSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (s && typeof s.token === 'string') return s
  } catch { /* blocked */ }
  // Signed in to the game on this browser? Try that account.
  try {
    const g = JSON.parse(localStorage.getItem('capball:account') || 'null')
    if (g && typeof g.token === 'string') return { token: g.token, username: g.username, fromGame: true }
  } catch { /* blocked */ }
  return null
}

export function saveSession(s) {
  try {
    if (s && !s.fromGame) sessionStorage.setItem(KEY, JSON.stringify(s))
    else sessionStorage.removeItem(KEY)
  } catch { /* fine: this tab only */ }
}

export const login = (username, password) => rpc('cb_account_login', { p_username: username, p_password: password })
export const logout = (token) => rpc('cb_account_logout', { p_token: token }).catch(() => null)
export const call = (token, action, data = {}) => rpc('cb_admin', { p_token: token, p_action: action, p_data: data })

/** What a player's save says about them (their game's own localStorage, copied up). */
export function summariseSave(save) {
  const items = save?.items && typeof save.items === 'object' ? save.items : {}
  const parse = (k) => { try { return items[k] ? JSON.parse(items[k]) : null } catch { return null } }
  const career = parse('capball:career-mode:v1')
  const record = parse('capball:career:v1')
  const settings = parse('capball:v1') || parse('capball:settings:v1')
  const history = parse('capball:history:v1')
  const hall = parse('capball:career-hof:v1')
  return {
    keys: Object.keys(items).length,
    club: career?.club?.name || null,
    level: Number.isInteger(career?.level) ? career.level : null,
    season: career?.season ?? null,
    coins: Number.isFinite(career?.coins) ? career.coins : null,
    mode: career?.mode || null,
    sacked: !!career?.sacked,
    played: record?.played ?? null,
    won: record?.won ?? null,
    drawn: record?.drawn ?? null,
    lost: record?.lost ?? null,
    goalsFor: record?.goalsFor ?? null,
    recent: Array.isArray(history) ? history.length : 0,
    hall: Array.isArray(hall) ? hall.length : 0,
    team: settings?.teamConfig?.team1?.name || null,
  }
}
