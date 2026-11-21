/**
 * The Training Ground: practise without anything counting. Skills are five
 * tries at one set-up (it shifts a little each try), scored in stars; Free
 * play is a sandbox. Set-ups use the daily challenge's templates (team1
 * attacks the right-hand goal), but here the keeper reacts at the level you
 * pick. Reached from the little cone in your profile.
 */
import { TEMPLATES } from './daily'
import { seededRng } from './tournament'
import { PITCH } from '../data/TeamData'

export const TRIES = 5
/** Goals out of TRIES for one, two and three stars. */
export const STAR_GOALS = [1, 3, 4]
export const starsFor = (goals) => STAR_GOALS.filter((g) => goals >= g).length
export const LEVELS = ['easy', 'medium', 'hard']

/** A two-cap wall square across the line from the ball to the goal, `dist` out. */
function wallOn(ball, dist = 3.6) {
  const gx = PITCH.halfW, dx = gx - ball[0], dy = -ball[1]
  const l = Math.hypot(dx, dy) || 1
  const ux = dx / l, uy = dy / l
  const cx = ball[0] + ux * dist, cy = ball[1] + uy * dist
  return { def1: [cx - uy * 0.82, cy + ux * 0.82], def2: [cx + uy * 0.82, cy - ux * 0.82] }
}
const behind = ([bx, by], d = 1.4) => {
  const dx = PITCH.halfW - bx, dy = -by, l = Math.hypot(dx, dy) || 1
  return [bx - (dx / l) * d, by - (dy / l) * d]
}

/** Each skill: id, name, sub, tip, and build(rng) → a set-up { ball, mine, theirs, keeperY }. chip: the taker starts set to chip. */
export const SKILLS = [
  {
    id: 'chip', name: 'Chip over the wall', sub: 'Lift it over, beat the keeper', chip: true,
    tip: 'Quick and low beats a keeper on his line; float it and he gets back to catch it.',
    build: (r) => { const ball = [5 + r() * 2.5, (r() - 0.5) * 3]; return { ball, mine: { atk1: behind(ball) }, theirs: wallOn(ball), keeperY: 0 } },
  },
  { id: 'bend', name: 'Bend round the wall', sub: 'Free kick, near post', tip: 'The wall covers the near post: go round it, or play it short to a teammate.', template: 0 },
  { id: 'one', name: 'One on one', sub: 'Breakaway', tip: 'Take it closer before you shoot: from far out the keeper has time to slide across.', template: 2 },
  { id: 'angle', name: 'Tight angle', sub: 'From the byline', tip: 'Aim for the far post, or cut it back to the cap in the middle.', template: 3 },
  { id: 'crowd', name: 'Through the crowd', sub: 'Find the gap in a packed box', tip: 'Look for the gap before you flick: a pass into space can beat four defenders.', template: 5 },
  { id: 'long', name: 'From distance', sub: 'Long range', tip: 'Hard shots from far out drift and give the keeper time. Work it closer, or chip it.', template: 4 },
]
export const skillById = (id) => SKILLS.find((s) => s.id === id) || null

/** The set-up for try `n` of a skill (the same for everyone, a little different each try). */
export function skillSetup(id, n, round = 0) {
  const s = skillById(id)
  if (!s) return null
  const r = seededRng(`training:${id}:${round}:${n}`)
  const base = s.build ? s.build(r) : TEMPLATES[s.template](r)
  return { id: `training-${id}-${n}`, name: s.name, ...base }
}

/** One line after a try: what happened and why. outcome: 'goal' | a shot call | 'none' | 'foul' | 'own'. */
export function coachNote(outcome, chipped = false) {
  switch (outcome) {
    case 'goal': return chipped ? 'Goal! Lovely chip.' : 'Goal!'
    case 'own': return 'Into your own net. Aim the other way!'
    case 'chipSave': return 'Caught: too much air. Hit it quicker.'
    case 'tipped': return 'Tipped over! Keep it lower under the bar.'
    case 'overBar': return 'Over the bar: too much power.'
    case 'save': return 'Saved: he read it. Pick a corner.'
    case 'post': return 'Off the post! So close.'
    case 'wide': return 'Just wide.'
    case 'block': return 'Blocked: find the gap first.'
    case 'foul': return 'Foul: you hit a defender before the ball.'
    default: return chipped ? 'Short: put more on the chip.' : 'No goal. Have another go.'
  }
}
