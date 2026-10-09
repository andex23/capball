/**
 * The daily challenge: one set-up a day, the same for everyone, picked from
 * the date. Your caps against a few defenders and a keeper — score within the
 * flicks you're given. Team 1 attacks the right-hand goal (x = +15).
 */
import { PITCH } from '../data/TeamData'
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
const TEMPLATES = [
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

/** The challenge for a given day. */
export function challengeFor(key) {
  const r = seededRng(`daily:${key}`)
  const n = Math.floor(r() * TEMPLATES.length) % TEMPLATES.length
  const c = TEMPLATES[n](r)
  return { id: key, template: n, ...c }
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
