/**
 * The Weekend League for the website: the player is their Counterball
 * account (checked from their sign-in token), and the table is the website's own.
 */
import { DATABASE_URL } from './anytime.js'
import { isLeagueAction, runLeague, webSaves } from './league.js'
import { makeSaveDb } from './lagos.js'

/** The account behind a sign-in token, or null. */
export function makeAccountCheck({ key = process.env.SUPABASE_SERVICE_ROLE_KEY, url = process.env.SUPABASE_URL || DATABASE_URL, fetchImpl = fetch } = {}) {
  if (!key) return null
  return async (token) => {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null
    const res = await fetchImpl(`${url}/rest/v1/rpc/cb_account_by_token`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
      signal: AbortSignal.timeout?.(8000),
    })
    if (!res.ok) return null
    const a = await res.json().catch(() => null)
    return a?.id ? String(a.id) : null
  }
}

export async function handleLeagueWeb(input, check = makeAccountCheck(), saves = makeSaveDb()) {
  if (!check || !saves) throw new Error('not-configured')
  if (!isLeagueAction(input?.action)) throw new Error('bad-request')
  const account = await check(input.token)
  if (!account) throw new Error('signed-out')
  return runLeague(input.action, webSaves(saves), 'web', `acct:${account}`, input)
}
