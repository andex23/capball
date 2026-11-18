/**
 * The extra bits of a career match report: the two sides' numbers, who was
 * on top when (momentum), the scorers with their minutes, and a newspaper
 * headline. Pure.
 */
import { footballMinute } from './matchStory'
import { playerOf } from './commentary'

const STAT_KEYS = ['shots', 'onTarget', 'saves', 'fouls']
const WEIGHT = { goal: 3, save: 2, post: 2, block: 1, wide: 1 }
export const MOMENTUM_SLOTS = 9 // ten football minutes each

const teamOfCap = (cap) => (String(cap || '').startsWith('team2') ? 'team2' : 'team1')

/**
 * @param {object} p
 * @param {'team1'|'team2'} p.side   your side in the match
 * @returns {{ stats: { mine, theirs }, momentum: number[], scorers: [{ min, name, mine, own }] }}
 */
export function reportExtras({ side, goalLog = [], matchEvents = [], stats = {}, teamConfig = {}, matchDuration = 120 }) {
  const other = side === 'team1' ? 'team2' : 'team1'
  const pick = (t) => Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(0, Math.floor(stats?.[t]?.[k] || 0))]))
  const momentum = Array(MOMENTUM_SLOTS).fill(0)
  const add = (min, team, w) => {
    if (!Number.isFinite(min)) return
    const i = Math.min(MOMENTUM_SLOTS - 1, Math.max(0, Math.floor((Math.min(min, 90) - 1) / 10)))
    momentum[i] += team === side ? w : -w
  }
  const scorers = []
  for (const g of goalLog) {
    if (g.shootout) continue
    const min = footballMinute(g.half, g.t, matchDuration)
    add(min, g.team, WEIGHT.goal)
    const who = playerOf(teamConfig, g.cap)
    scorers.push({ min, name: who?.name || teamConfig?.[g.team]?.name || '', mine: g.team === side, own: !!g.own })
  }
  for (const e of matchEvents) {
    if (!WEIGHT[e.type] || !Number.isInteger(e.half)) continue
    add(footballMinute(e.half, e.t, matchDuration), teamOfCap(e.cap), WEIGHT[e.type])
  }
  return { stats: { mine: pick(side), theirs: pick(other) }, momentum: momentum.map((v) => Math.max(-9, Math.min(9, v))), scorers }
}

/** Clean saved extras (from an old or edited save). */
export function sanitizeExtras(m) {
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(99, Math.floor(v)) : 0)
  const side = (s) => Object.fromEntries(STAT_KEYS.map((k) => [k, n(s?.[k])]))
  const out = {}
  if (m?.stats && typeof m.stats === 'object') out.stats = { mine: side(m.stats.mine), theirs: side(m.stats.theirs) }
  if (Array.isArray(m?.momentum) && m.momentum.length === MOMENTUM_SLOTS) out.momentum = m.momentum.map((v) => (Number.isFinite(v) ? Math.max(-9, Math.min(9, Math.round(v))) : 0))
  if (Array.isArray(m?.scorers)) {
    out.scorers = m.scorers.filter((s) => s && typeof s.name === 'string').slice(0, 20).map((s) => ({
      min: Number.isInteger(s.min) && s.min >= 1 && s.min <= 120 ? s.min : null, name: s.name.slice(0, 24), mine: s.mine === true, own: s.own === true,
    }))
  }
  return out
}

const surname = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0] || name

/**
 * A short newspaper headline for your result.
 * @param {object} p  { club, opp, gf, ga, pens ('win'|'loss'|null), scorers, pos (after), top (true if 1st) }
 */
export function headline({ club, opp, gf, ga, pens = null, scorers = [], top = false }) {
  const mine = scorers.filter((s) => s.mine && !s.own)
  const theirs = scorers.filter((s) => !s.mine && !s.own)
  const last = scorers[scorers.length - 1]
  const won = gf > ga || pens === 'win'
  const lost = gf < ga || pens === 'loss'
  if (won) {
    if (pens) return `${club} win it on penalties`
    const lateWinner = last && last.mine && !last.own && last.min >= 80 && gf - ga === 1
    if (lateWinner) return top ? `${surname(last.name)}’s late winner sends ${club} top` : `${surname(last.name)} wins it late for ${club}`
    const hat = Object.entries(mine.reduce((a, s) => ({ ...a, [s.name]: (a[s.name] || 0) + 1 }), {})).find(([, c]) => c >= 3)
    if (hat) return `${surname(hat[0])} hat-trick sinks ${opp}`
    if (gf - ga >= 3) return `${club} run riot against ${opp}`
    if (top) return `${club} go top with win over ${opp}`
    if (ga === 0 && mine.length === 1) return `${surname(mine[0].name)} the hero as ${club} edge ${opp}`
    return `${club} beat ${opp} ${gf}–${ga}`
  }
  if (lost) {
    if (pens) return `${club} out on penalties`
    if (last && !last.mine && last.min >= 80 && ga - gf === 1) return `Late heartbreak for ${club} against ${opp}`
    if (ga - gf >= 3) return `${opp} too strong for ${club}`
    if (theirs.length === 1 && gf === 0) return `${surname(theirs[0].name)} goal is enough for ${opp}`
    return `${club} lose ${gf}–${ga} to ${opp}`
  }
  if (gf === 0) return `No way through: ${club} and ${opp} share the points`
  if (last && last.mine && last.min >= 80) return `${surname(last.name)} rescues a point for ${club}`
  return `Honours even: ${club} ${gf}–${ga} ${opp}`
}
