/**
 * The daily challenge: one set-up a day, the same for everyone, picked from
 * the date. Your caps against a few defenders and a keeper — score within the
 * flicks you're given. Team 1 attacks the right-hand goal (x = +15).
 */
import { PITCH, CAP_RADIUS as CAP_R, GK_RADIUS as GK_R, BALL_RADIUS as BALL_R } from '../data/TeamData'
import { seededRng } from './tournament'

const GK_X = PITCH.halfW - 1.12

/** A spot `dist` behind the ball on the line from the ball to the middle of the goal (turned by `turn` radians). */
function behind([bx, by], dist = 1.9, turn = 0) {
  const a = Math.atan2(0 - by, PITCH.halfW - bx) + turn
  return [bx - Math.cos(a) * dist, by - Math.sin(a) * dist]
}

// Where caps that aren't part of today's puzzle wait, well out of the way
const PARK_MINE = { gk: [-PITCH.halfW + 1.2, 0], def1: [-11, -7.5], def2: [-11, 7.5], mid: [-8, -7.5], atk1: [-8, 7.5], atk2: [-5, -7.5] }
const PARK_THEIRS = { def1: [-2, 8.6], def2: [-4, 8.6], mid: [-6, 8.6], atk1: [-2, -8.6], atk2: [-4, -8.6] }

/**
 * Each template builds a puzzle from a 0..1 random source. Returns
 * { name, text, flicks, ball:[x,y], mine:{role:[x,y]}, theirs:{role:[x,y]}, keeperY }
 */
export const TEMPLATES = [
  (r) => {
    const y = (r() - 0.5) * 6
    const bx = 6.5 + r() * 1.5
    return {
      name: 'Free kick', text: 'Bend it round the wall — or play it short.', flicks: 2,
      ball: [bx, y],
      mine: { atk1: behind([bx, y]), mid: [bx - 2, y + 3 * -Math.sign(y || 1)] },
      theirs: { def1: [bx + 3, y * 0.55 + Math.sign(y || 1) * 0.6], def2: [bx + 1.5, y + 3.4 * -Math.sign(y || 1)] },
      keeperY: 0,
    }
  },
  (r) => {
    const side = r() < 0.5 ? -1 : 1
    return {
      name: 'Corner', text: 'Whip it in and finish it off.', flicks: 3,
      // Ball near the corner flag, the taker tucked in behind it, lined up to cross it into the box
      ball: [13.2, side * 7.8],
      mine: { atk1: [13.73, side * 8.98], atk2: [10.6, side * 1.2], mid: [8.4, -side * 1.8] },
      theirs: { def1: [12.4, -side * 2.2], def2: [9.4, side * 3.8] },
      keeperY: side * 0.5,
    }
  },
  (r) => {
    const y = (r() - 0.5) * 4
    return {
      name: 'Breakaway', text: 'Two defenders between you and glory.', flicks: 3,
      ball: [1.5, y],
      mine: { atk1: [-0.3, y], atk2: [0.5, y + (y > 0 ? -4 : 4)] },
      theirs: { def1: [7.5, y - 2.2], def2: [8, y + 2.2] },
      keeperY: 0,
    }
  },
  (r) => {
    const side = r() < 0.5 ? -1 : 1
    const ball = [11.4, side * (4.6 + r() * 0.8)]
    return {
      name: 'Tight angle', text: 'Not much goal to aim at. Squeeze it in.', flicks: 2,
      ball,
      mine: { atk1: behind(ball), mid: [8.2, side * 0.8] },
      theirs: { def1: [10.6, side * 2.2] },
      keeperY: side * 1.2,
    }
  },
  (r) => {
    const y = (r() - 0.5) * 8
    const bx = 1 + r() * 2
    return {
      name: 'Long range', text: 'From way out. Hit it sweet.', flicks: 2,
      ball: [bx, y],
      mine: { atk1: [bx - 1.9, y], mid: [bx + 1, y > 0 ? y - 4 : y + 4] },
      theirs: { def1: [8, y * 0.4] },
      keeperY: y * 0.15,
    }
  },
  (r) => {
    const y = (r() - 0.5) * 3
    return {
      name: 'Crowded box', text: 'Four defenders, one keeper. Find a gap.', flicks: 3,
      ball: [6.5, y],
      mine: { atk1: [4.6, y], atk2: [6, y + 4.5], mid: [5.5, y - 4.5] },
      theirs: { def1: [10, -2.6], def2: [10, 2.6], mid: [11.6, -0.2], atk1: [8.6, 0.2] },
      keeperY: 0,
    }
  },
]

/** Today's date as YYYY-MM-DD in the player's own time zone. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** The day before a YYYY-MM-DD key. */
export function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1))
}

/**
 * The week's schedule: the same set-up on the same day each week, getting
 * harder towards the weekend, so it never repeats from one day to the next.
 * Positions still change week to week. Sunday is the Sunday Special.
 * Indexed by getDay(): 0 = Sunday.
 */
export const WEEK = [
  { day: 'Sun', template: null, level: 'Hardest' },
  { day: 'Mon', template: 0, level: 'Easy' }, // Free kick
  { day: 'Tue', template: 2, level: 'Easy' }, // Breakaway
  { day: 'Wed', template: 1, level: 'Medium' }, // Corner
  { day: 'Thu', template: 4, level: 'Medium' }, // Long range
  { day: 'Fri', template: 3, level: 'Hard' }, // Tight angle
  { day: 'Sat', template: 5, level: 'Hard' }, // Crowded box
]
export const SPECIAL_NAME = 'Sunday Special'
/** Beating the Sunday Special pays this into your club budget (₦250k). */
export const SPECIAL_BONUS = 25

const dateOf = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
export const weekdayOf = (key) => dateOf(key).getDay()
export const nextDay = (key) => { const d = dateOf(key); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) }
/** Monday to Sunday of the week `key` is in. */
export function weekDays(key) {
  const d = dateOf(key)
  const back = (d.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back + i)))
}
/** What a day's challenge is called, without building it. */
export function challengeName(key) {
  const w = WEEK[weekdayOf(key)]
  return w.template == null ? SPECIAL_NAME : TEMPLATES[w.template](() => 0.5).name
}

const R = { ball: BALL_R, cap: CAP_R, gk: GK_R }
/** An extra defender for the Sunday Special: in the way, but leaving a gap. */
function extraDefender(c, r) {
  const free = Object.keys(PARK_THEIRS).find((role) => !c.theirs[role])
  if (!free) return c
  const taken = [[...c.ball, R.ball], ...Object.values(c.mine).map((p) => [...p, R.cap]), ...Object.values(c.theirs).map((p) => [...p, R.cap]), [GK_X, c.keeperY || 0, R.gk]]
  const [bx, by] = c.ball
  const side = r() < 0.5 ? -1 : 1
  const fits = (x, y) => Math.abs(x) <= PITCH.halfW - R.cap && Math.abs(y) <= PITCH.halfH - R.cap && taken.every(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) > tr + R.cap + 0.15)
  const put = (x, y) => ({ ...c, theirs: { ...c.theirs, [free]: [x, y] } })
  // Between the ball and the goal, a little to one side
  for (const t of [0.55, 0.45, 0.65, 0.35, 0.75]) {
    for (const off of [1.1, -1.1, 1.8, -1.8, 0.4, -0.4].map((o) => o * side)) {
      const x = bx + (GK_X - 1.5 - bx) * t
      const y = by * (1 - t) + off
      if (fits(x, y)) return put(x, y)
    }
  }
  // Somewhere in front of goal, then anywhere goal-side of the ball
  for (let x = GK_X - 2.2; x > bx; x -= 0.6) for (const y of [0, 1.2, -1.2, 2.4, -2.4, 3.6, -3.6, 4.8, -4.8].map((v) => v * side)) if (fits(x, y)) return put(x, y)
  return c
}

/** The challenge for a given day. */
export function challengeFor(key) {
  const r = seededRng(`daily:${key}`)
  const w = WEEK[weekdayOf(key)]
  if (w.template != null) return { id: key, template: w.template, level: w.level, ...TEMPLATES[w.template](r) }
  // Sunday Special: one of the week's set-ups, an extra defender, one flick fewer
  const n = Math.floor(r() * TEMPLATES.length) % TEMPLATES.length
  const base = TEMPLATES[n](r)
  const c = extraDefender(base, r)
  return { id: key, template: n, level: w.level, special: true, ...c, name: SPECIAL_NAME, base: base.name, flicks: Math.max(1, base.flicks - 1), text: `${base.name} with an extra defender and one flick fewer.` }
}

/** Body positions for a challenge: { id: [x, y] } for every cap and the ball. */
export function challengeBodies(c) {
  const bodies = { ball: c.ball }
  for (const [role, pos] of Object.entries(PARK_MINE)) bodies[`team1_${role}`] = c.mine[role] || pos
  for (const [role, pos] of Object.entries(PARK_THEIRS)) bodies[`team2_${role}`] = c.theirs[role] || pos
  bodies.team2_gk = [GK_X, c.keeperY || 0]
  return bodies
}

/** Streak after finishing the challenge on `today`, given the last day finished. */
export function nextStreak(prev, today) {
  if (prev.lastDone === today) return prev
  const streak = prev.lastDone === previousDay(today) ? prev.streak + 1 : 1
  return { lastDone: today, streak, best: Math.max(prev.best || 0, streak) }
}
