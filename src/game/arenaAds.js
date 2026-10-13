/**
 * The text on the Cap Arena ad boards. The admin console sets it on the
 * server (supabase/arena-ads.sql); the game reads it once per visit, keeps a
 * copy for offline, and falls back to the built-in boards.
 */
import { rpc } from '../online/supabase'

export const DEFAULT_ADS = {
  boards: ['COUNTERBALL', 'CAP CUP', 'FLICK IT', 'NAIJA FIZZ', 'EKO MOBILE', 'JOLLOF KINGS'],
  ribbon: ['PREMIER CAP LEAGUE', 'CAP ARENA', 'LIVE ON CAPTV', 'NAIJA FIZZ', 'COUNTERBALL', 'EKO MOBILE'],
}
export const AD_MAX = 24
export const ADS_MAX = 8
const CACHE_KEY = 'capball:arena-ads'

/** A clean list of board messages (upper case, 1–24 characters, at most 8), or null. */
export function cleanAdList(input) {
  if (!Array.isArray(input)) return null
  const out = input
    .filter((x) => typeof x === 'string')
    .map((x) => x.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, AD_MAX))
    .filter(Boolean)
    .slice(0, ADS_MAX)
  return out.length ? out : null
}

/** Both lists, each falling back to the built-in one. */
export function cleanAds(input) {
  return {
    boards: cleanAdList(input?.boards) || DEFAULT_ADS.boards,
    ribbon: cleanAdList(input?.ribbon) || DEFAULT_ADS.ribbon,
  }
}

const storage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }

/** The boards as last seen (or the built-in ones). */
export function cachedAds() {
  try { return cleanAds(JSON.parse(storage()?.getItem(CACHE_KEY) || 'null')) } catch { return cleanAds(null) }
}

let pending = null
/** The boards from the server, once per visit; resolves to the cached ones if it can't be reached. */
export function fetchAds() {
  if (!pending) {
    pending = rpc('cb_arena_ads', {}, { timeoutMs: 6000 })
      .then((v) => {
        const ads = cleanAds(v)
        try { if (v) storage()?.setItem(CACHE_KEY, JSON.stringify(ads)); else storage()?.removeItem(CACHE_KEY) } catch { /* fine */ }
        return ads
      })
      .catch(() => cachedAds())
  }
  return pending
}
