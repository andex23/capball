/**
 * Rivals: in every division one club is your rival, and matches against them
 * are derbies. A derby pulls a bigger crowd, pays double prize money for a win,
 * and the record between you is kept for good (head to head, across seasons).
 * Pure functions over the career.
 */
import { DIVISIONS } from './divisions'
import { teamById } from './tournament'

const ME = 'T1'
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

/** Your rival in a division: one of its four strongest clubs, the same every time for your club. */
export function rivalFor(career, level = career?.level ?? 0) {
  const clubs = DIVISIONS[level]?.clubs || []
  if (!clubs.length) return null
  let h = 0
  for (const ch of `${career?.club?.name || 'My Club'}:${level}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return clubs[h % Math.min(4, clubs.length)].name
}

/** "The Bottle Derby": named after the rival's first word. */
export function derbyName(rival) {
  const word = String(rival || '').split(' ')[0] || 'Local'
  return `The ${word} Derby`
}

/** Is this fixture (league or cup) against your rival? */
export function isDerby(career, comp, fixture) {
  if (!career || !comp || !fixture) return false
  const other = fixture.home === ME ? fixture.away : fixture.home
  const team = teamById(comp, other)
  return !!team && team.name === rivalFor(career)
}

/** Head to head with a club, across every season: { w, d, l }. */
export const headToHead = (career, name) => ({ w: 0, d: 0, l: 0, ...(career?.h2h?.[name] || {}) })

/** Add one result against a club to the head-to-head record. */
export function noteHeadToHead(career, name, gf, ga) {
  if (!name || !Number.isFinite(gf) || !Number.isFinite(ga)) return career
  const r = headToHead(career, name)
  const k = gf > ga ? 'w' : gf === ga ? 'd' : 'l'
  return { ...career, h2h: { ...(career.h2h || {}), [name]: { ...r, [k]: r[k] + 1 } } }
}

/** A saved head-to-head record, cleaned. */
export function sanitizeH2h(input) {
  if (!isObj(input)) return {}
  const out = {}
  const n = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, 9999) : 0)
  for (const [name, r] of Object.entries(input).slice(0, 80)) {
    if (typeof name === 'string' && name.length <= 24 && isObj(r)) out[name] = { w: n(r.w), d: n(r.d), l: n(r.l) }
  }
  return out
}

/** A derby pays double prize money for a win; the crowd comes out in force. */
export const DERBY_PRIZE = 2
export const DERBY_CROWD = 1.3
