/**
 * The Weekly Cup: a ready-made 8-club knockout against the computer, the same
 * for everyone that week (Monday to Sunday). It has a name, seven computer
 * clubs, and gets harder each round: easy, then medium, then hard in the final.
 * Winning it pays club money and that cup's trophy cap, once a week. Pure.
 */
import { CAP_DESIGNS, designPatch } from '../data/TeamOptions.js'
import { WEEKLY_CUPS, CUP_CAPS } from './rewards.js'

export { WEEKLY_CUPS, CUP_CAPS }

/** Round by round, the computer's level: easy, medium, then hard in the final. */
export const CUP_LEVELS = ['easy', 'medium', 'hard']
export const levelForRound = (round, rounds = 3) => CUP_LEVELS[Math.max(0, Math.min(CUP_LEVELS.length - 1, round - (rounds - CUP_LEVELS.length)))]

/** Club money for winning it (units: see squad.js money()). */
export const CUP_PRIZE = 150

const SUFFIX = ['United', 'Rovers', 'City', 'Stars', 'Athletic', 'Wanderers', 'Town']
const weekNum = (key) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key))
  return m ? Number(m[1]) * 53 + Number(m[2]) : 0
}

/** This week's cup: { key, name, cap (the winner's cap), clubs (seven computer teams) }. */
export function weeklyCup(key) {
  const n = weekNum(key)
  const i = n % WEEKLY_CUPS.length
  const designs = CAP_DESIGNS.filter((d) => d.key !== 'plain')
  const clubs = Array.from({ length: 7 }, (_, k) => {
    const d = designs[(n * 3 + k * 5) % designs.length]
    const full = `${d.name} ${SUFFIX[(n + k) % SUFFIX.length]}`
    return { ...designPatch(d), name: (full.length <= 16 ? full : `${d.name} FC`).slice(0, 16), cpu: true, difficulty: 'medium' }
  })
  return { key, name: WEEKLY_CUPS[i].name, cap: CUP_CAPS[i], clubs }
}

/** The teams for this week's cup: you, then the seven computer clubs. */
export function cupTeams(cup, myKit) {
  const me = { ...myKit, name: (myKit?.name || 'My team').slice(0, 16), cpu: false }
  return [me, ...cup.clubs]
}
