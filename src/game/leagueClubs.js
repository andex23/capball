/**
 * A weekend's fifteen computer clubs: the same for everyone that weekend,
 * each with its own name and, for now, a ready-made cap (their own caps
 * are being designed). All on hard. Pure.
 */
import { CAP_DESIGNS, designPatch } from '../data/TeamOptions.js'
import { FIXTURES } from './leagueRules.js'

// The league's computer clubs: thirty of them, fifteen each weekend
export const LEAGUE_CLUB_NAMES = [
  'Midnight Kings', 'Iron Lions', 'Danfo Express', 'Lagoon Sharks', 'Harmattan FC',
  'Red Comets', 'Neon Strikers', 'Owambe United', 'Jollof Rovers', 'Black Mambas',
  'Atlantic Blaze', 'Okada Riders', 'Highlife FC', 'Sunset Royals', 'Thunder Drums',
  'Island Titans', 'Agbada Athletic', 'Gidi Stars', 'Molue Warriors', 'Asoebi City',
  'Afrobeat FC', 'Eko Electric', 'Lekki Lightning', 'Naija Nomads', 'Suya Spice',
  'Golden Hour FC', 'Bridge Boys', 'Rainmakers', 'Night Market', 'Masquerades FC',
]

/** This weekend's clubs, in fixture order: [{ ...kit, name, difficulty: 'hard' }]. */
export function leagueClubs(key) {
  const n = Math.floor(Date.parse(`${key}T00:00:00Z`) / (7 * 86400000)) || 0
  const designs = CAP_DESIGNS.filter((d) => d.key !== 'plain')
  return Array.from({ length: FIXTURES }, (_, k) => {
    const d = designs[(n * 5 + k * 7) % designs.length]
    const name = LEAGUE_CLUB_NAMES[(n * 15 + k * 7) % LEAGUE_CLUB_NAMES.length]
    return { ...designPatch(d), name, capNames: 'none', difficulty: 'hard' }
  })
}
