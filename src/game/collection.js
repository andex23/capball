/**
 * The Collection: the caps from Heritage Vol. 01, Street Vol. 02 and the art
 * editions, and how a player gets each one. Pure.
 *
 * - Weekend League prizes (earned only, never sold). Places stack: the
 *   champion also gets 2nd's, 3rd's and the top ten's caps, and so on down.
 *   The Kingmaker is the champion's for one week, then moves to the next champion.
 * - Weekend League feats: play all fifteen, or go unbeaten in all fifteen.
 * - The rest are bought with the wallet.
 */
import { HERITAGE_DESIGNS } from '../data/HeritageCaps.js'

export const KINGMAKER = 'kingmaker'
export const KINGMAKER_DAYS = 7

/** How each cap is had: { league: rank needed } | { feat } | { price } */
export const COLLECTION_WAYS = {
  kingmaker: { league: 1, hint: 'Win the Weekend League: yours for a week' },
  alaafin: { league: 2, hint: 'Finish top two in the Weekend League' },
  'edo-regalia': { league: 3, hint: 'Finish top three in the Weekend League' },
  'ife-dynasty': { league: 10, hint: 'Finish top ten in the Weekend League' },
  'ukwu-gold': { feat: 'unbeaten', hint: 'Go unbeaten in all 15 Weekend League matches' },
  'nok-ember': { feat: 'all', hint: 'Play all 15 Weekend League matches in one weekend' },
  'acid-racing': { price: 1500000 },
  'lagos-90': { price: 1500000 },
  'liquid-chrome': { price: 1500000 },
  'midnight-club': { price: 1500000 },
  'purple-hibiscus': { price: 5000000 },
  'confluence-town': { price: 5000000 },
}

/** The collection's caps, in the order they're shown, with how each is had. */
export const COLLECTION = Object.keys(COLLECTION_WAYS).map((k) => HERITAGE_DESIGNS.find((d) => d.key === k)).filter(Boolean).map((d) => ({ ...d, ...COLLECTION_WAYS[d.key] }))
export const collectionCap = (key) => COLLECTION.find((d) => d.key === key) || null
export const COLLECTION_PRICES = Object.fromEntries(COLLECTION.filter((d) => d.price).map((d) => [d.key, d.price]))

/** League caps a final place earns (places stack downwards). */
export const capsForRank = (rank) => COLLECTION.filter((d) => d.league && rank >= 1 && rank <= d.league).map((d) => d.key)

/** Feat caps from a weekend's results (15 entries, null for not played). */
export function capsForResults(results) {
  const played = (results || []).filter(Boolean)
  const out = []
  if (played.length === 15) out.push('nok-ember')
  if (played.length === 15 && played.every((r) => r.gf >= r.ga)) out.push('ukwu-gold')
  return out
}
