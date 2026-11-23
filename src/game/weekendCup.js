/**
 * The Weekend Cup's five computer clubs: the same for everyone that weekend,
 * each harder than the last (see weekendRules.js for the rules). Pure.
 */
import { CAP_DESIGNS, designPatch } from '../data/TeamOptions.js'
import { LEVELS } from './weekendRules.js'

export * from './weekendRules.js'

// Lagos clubs: a district, then a nickname
const PLACES = ['Surulere', 'Yaba', 'Ikeja', 'Lekki', 'Eko', 'Ajegunle', 'Mushin', 'Oshodi', 'Ikoyi', 'Festac', 'Agege', 'Apapa', 'Ebute Metta', 'Victoria Is']
const NAMES = ['Strikers', 'Rovers', 'United', 'Lions', 'Kings', 'Stars', 'Eagles', 'City', 'Sharks', 'Bulls']

/** This weekend's five clubs, easiest first: [{ ...kit, name, cpu, difficulty }]. */
export function weekendClubs(key) {
  const n = Math.floor(Date.parse(`${key}T00:00:00Z`) / (7 * 86400000)) || 0
  const designs = CAP_DESIGNS.filter((d) => d.key !== 'plain')
  return LEVELS.map((difficulty, k) => {
    const d = designs[(n * 7 + k * 3) % designs.length]
    const place = PLACES[(n * 5 + k * 3) % PLACES.length]
    const name = `${place} ${NAMES[(n + k * 2) % NAMES.length]}`.slice(0, 16)
    return { ...designPatch(d), name, cpu: true, difficulty }
  })
}

/** What each round is called on screen. */
export const ROUND_NAMES = ['Round 1', 'Round 2', 'Round 3', 'Semi-final', 'Final']
