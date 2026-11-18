/**
 * The extra bits of a career match report: the two sides' numbers, who was
 * on top when (momentum), the scorers with their minutes, and a newspaper
 * headline. Pure.
 */
import { eventMinute } from './matchStory'
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
export function reportExtras({ side, goalLog = [], matchEvents = [], stats = {}, teamConfig = {}, matchDuration = 120, extraTime = false }) {
  const other = side === 'team1' ? 'team2' : 'team1'
  const pick = (t) => Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(0, Math.floor(stats?.[t]?.[k] || 0))]))
  const momentum = Array(extraTime ? 12 : MOMENTUM_SLOTS).fill(0)
  const add = (min, team, w) => {
    if (!Number.isFinite(min)) return
    const i = Math.min(momentum.length - 1, Math.max(0, Math.floor((min - 1) / 10)))
    momentum[i] += team === side ? w : -w
  }
  const scorers = []
  for (const g of goalLog) {
    if (g.shootout) continue
    const min = eventMinute(g, matchDuration)
    add(min, g.team, WEIGHT.goal)
    const who = playerOf(teamConfig, g.cap)
    scorers.push({ min, name: g.playerName || who?.name || teamConfig?.[g.team]?.name || '', mine: g.team === side, own: !!g.own, fromOwnHalf: !!g.fromOwnHalf, sub: !!g.sub })
  }
  for (const e of matchEvents) {
    if (!WEIGHT[e.type] || !Number.isInteger(e.half)) continue
    add(eventMinute(e, matchDuration), teamOfCap(e.cap), WEIGHT[e.type])
  }
  return { stats: { mine: pick(side), theirs: pick(other) }, momentum: momentum.map((v) => Math.max(-9, Math.min(9, v))), scorers }
}

/** Clean saved extras (from an old or edited save). */
export function sanitizeExtras(m) {
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(99, Math.floor(v)) : 0)
  const side = (s) => Object.fromEntries(STAT_KEYS.map((k) => [k, n(s?.[k])]))
  const out = {}
  if (m?.stats && typeof m.stats === 'object') out.stats = { mine: side(m.stats.mine), theirs: side(m.stats.theirs) }
  if (Array.isArray(m?.momentum) && [MOMENTUM_SLOTS, 12].includes(m.momentum.length)) out.momentum = m.momentum.map((v) => (Number.isFinite(v) ? Math.max(-9, Math.min(9, Math.round(v))) : 0))
  if (Array.isArray(m?.scorers)) {
    out.scorers = m.scorers.filter((s) => s && typeof s.name === 'string').slice(0, 20).map((s) => ({
      min: Number.isInteger(s.min) && s.min >= 1 && s.min <= 120 ? s.min : null, name: s.name.slice(0, 24), mine: s.mine === true, own: s.own === true, fromOwnHalf: s.fromOwnHalf === true, sub: s.sub === true,
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
    let lead = 0
    let trailed = false
    for (const goal of scorers) {
      lead += goal.mine ? 1 : -1
      if (lead < 0) trailed = true
    }
    if (trailed) return club + ' come back to beat ' + opp + ' ' + gf + '–' + ga
    if (last?.mine && !last.own && gf - ga === 1 && last.sub) return 'Substitute ' + surname(last.name) + ' scores the winner for ' + club
    if (last?.mine && !last.own && gf - ga === 1 && last.fromOwnHalf) return surname(last.name) + ' wins it from inside their own half'
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
  if (last && last.mine && !last.own && last.min >= 80) return `${surname(last.name)} rescues a point for ${club}`
  return `Honours even: ${club} ${gf}–${ga} ${opp}`
}
