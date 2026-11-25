/**
 * A weekend's fifteen computer clubs: the Archive clubs, each with its own cap
 * (only ever seen in the league; players can't pick them). The same fifteen
 * every weekend, met in a different order each time. All on hard. Pure.
 */
import { ARCHIVE_DESIGNS } from '../data/ArchiveCaps.js'
import { FIXTURES } from './leagueRules.js'

/** A club's kit: its Archive cap, printed with just a number. */
const kit = (d) => ({
  name: d.name, primary: d.primary, edge: d.edge, skirtColor: d.skirtColor,
  pattern: 'none', badge: 'none', finish: 'matte', capText: '', textColor: '',
  art: d.key, capNames: 'none', difficulty: 'hard',
})

/** This weekend's clubs, in fixture order: [{ ...kit, name, difficulty: 'hard' }]. */
export function leagueClubs(key) {
  const n = Math.floor(Date.parse(`${key}T00:00:00Z`) / (7 * 86400000)) || 0
  const len = ARCHIVE_DESIGNS.length
  // 7 is coprime with 15, so every club comes up once a weekend
  return Array.from({ length: FIXTURES }, (_, k) => kit(ARCHIVE_DESIGNS[(n * 4 + k * 7) % len]))
}
