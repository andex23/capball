/**
 * A weekend's fifteen computer clubs: the same for everyone that weekend,
 * a Lagos district and a nickname each, in a ready-made cap. All on hard. Pure.
 */
import { CAP_DESIGNS, designPatch } from '../data/TeamOptions.js'
import { FIXTURES } from './leagueRules.js'

const PLACES = ['Surulere', 'Yaba', 'Ikeja', 'Lekki', 'Eko', 'Ajegunle', 'Mushin', 'Oshodi', 'Ikoyi', 'Festac', 'Agege', 'Apapa', 'Ebute Metta', 'Ojota', 'Ketu', 'Ikorodu', 'Badagry', 'Epe']
const NAMES = ['Strikers', 'Rovers', 'United', 'Lions', 'Kings', 'Stars', 'Eagles', 'City', 'Sharks', 'Bulls', 'Rangers', 'Warriors']

/** This weekend's clubs, in fixture order: [{ ...kit, name, difficulty: 'hard' }]. */
export function leagueClubs(key) {
  const n = Math.floor(Date.parse(`${key}T00:00:00Z`) / (7 * 86400000)) || 0
  const designs = CAP_DESIGNS.filter((d) => d.key !== 'plain')
  return Array.from({ length: FIXTURES }, (_, k) => {
    const d = designs[(n * 5 + k * 7) % designs.length]
    const place = PLACES[(n * 7 + k) % PLACES.length]
    const name = `${place} ${NAMES[(n * 3 + k * 5) % NAMES.length]}`.slice(0, 16)
    return { ...designPatch(d), name, capNames: 'none', difficulty: 'hard' }
  })
}
