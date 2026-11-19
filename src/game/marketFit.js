/**
 * The transfer market from your side: how a player compares with the starter
 * he'd replace, the three offers you can make (and how likely each is), and
 * the market's tabs. Pure functions.
 */
import { ovrAt, POS_OF, priceOf } from './squad'
import { CAP_ROLES } from '../data/TeamOptions'

const ROLES_FOR = Object.fromEntries(['GK', 'DEF', 'MID', 'ATK'].map((pos) => [pos, CAP_ROLES.filter((r) => POS_OF[r] === pos)]))

/**
 * Where he'd fit: the starting role in his position held by your weakest
 * starter there. { role, pos, mine: { name, rating }, his, delta } or null.
 */
export function fitFor(career, player) {
  if (!player || !career?.squad) return null
  const roles = ROLES_FOR[player.pos] || []
  let best = null
  for (const role of roles) {
    const p = career.squad[role]
    if (!p) continue
    const mine = ovrAt(p, role)
    if (!best || mine < best.mine.rating) best = { role, pos: player.pos, mine: { name: p.name, rating: mine, attrs: p.attrs } }
  }
  if (!best) return null
  const his = ovrAt(player, best.role)
  return { ...best, his, delta: his - best.mine.rating }
}

/**
 * The three offers for a player at a club: cheeky, fair and the asking price.
 * A club accepts anything from about 85% to 100% of its asking price
 * (where exactly depends on the club, see world.js bidVerdict), counters from 70%.
 */
export function offerOptions(asking) {
  const round5 = (n) => Math.max(5, Math.round(n / 5) * 5)
  return [
    { key: 'cheeky', label: 'Cheeky', fee: round5(asking * 0.85), chance: 'low', note: 'Long shot' },
    { key: 'fair', label: 'Fair', fee: round5(asking * 0.95), chance: 'mid', note: 'Good chance' },
    { key: 'asking', label: 'Asking', fee: asking, chance: 'high', note: 'Sure thing' },
  ]
}

// "For you" leaves out players who'd want more than this times the usual wages to drop down
export const FOR_YOU_MAX_PREMIUM = 2

export const MARKET_TABS = { forYou: 'For you', best: 'Best', bargains: 'Bargains', young: 'Young', free: 'Free' }

/**
 * Rows for a tab. `rows` come from searchMarket (each { player, club, total, ... });
 * every row gets its `fit` (see fitFor).
 *  - forYou: players who'd start for you, that you can afford and who won't want more than double pay
 *    to drop down; the biggest upgrade first, with extra pay counting against him
 *  - best: highest rated
 *  - bargains: the most player for the money (rating against what he costs, cheaper than his value)
 *  - young: 21 or under, by potential
 *  - free: free agents
 */
export function tabRows(career, rows, tab) {
  const withFit = rows.map((r) => ({ ...r, fit: fitFor(career, r.player) }))
  const coins = Math.max(0, career.coins ?? 0)
  switch (tab) {
    case 'forYou': {
      const score = (r) => r.fit.delta - 6 * ((r.willing?.premium || 1) - 1)
      return withFit.filter((r) => r.fit && r.fit.delta > 0 && r.total <= coins && (r.willing?.premium || 1) <= FOR_YOU_MAX_PREMIUM)
        .sort((a, b) => (score(b) - score(a)) || (a.total - b.total))
    }
    case 'bargains':
      return withFit.filter((r) => r.total <= priceOf(r.player) * 0.95 || !r.club || r.standing === 'listed')
        .sort((a, b) => (b.player.rating / Math.max(5, b.total)) - (a.player.rating / Math.max(5, a.total)))
    case 'young':
      return withFit.filter((r) => r.player.age <= 21).sort((a, b) => (b.player.pot - a.player.pot) || (b.player.rating - a.player.rating))
    case 'free':
      return withFit.filter((r) => !r.club)
    default:
      return withFit
  }
}
