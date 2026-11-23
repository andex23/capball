/**
 * The Training Ground: running a skill (five tries, then stars) or Free play,
 * and the Free play tools. Nothing here counts towards records, coins,
 * streaks or goals; only your best score per skill is kept.
 */
import { create } from 'zustand'
import Matter from 'matter-js'
import { getSaveStorage } from '../utils/playerSave'
import { useMatchStore, SCREEN, PHASE, setTrainingHandler, clearMatchTimers } from './MatchStore'
import { setPendingBodies } from './savedMatch'
import { challengeBodies } from '../game/daily'
import { skillById, skillSetup, coachNote, TRIES, LEVELS, starsFor, SKILLS } from '../game/training'
import { lastFlickSnapshot, forgetFlickSnapshot } from '../game/flick'
import { getBodies, applyBodySnapshot, stopAllBodies, deOverlapBodies, chipInFlight } from '../physics/PhysicsWorld'
import { PHYSICS, PITCH, CAP_RADIUS } from '../data/TeamData'

export const TRAINING_KEY = 'capball:training:v1'
const NORMAL_TIME = PHYSICS.timeScale
const NOTE_MS = 1400 // how long a try's note shows before the next try

function load() {
  try {
    const v = JSON.parse(getSaveStorage()?.getItem(TRAINING_KEY) || 'null') || {}
    const best = {}
    for (const s of SKILLS) if (Number.isInteger(v.best?.[s.id])) best[s.id] = Math.max(0, Math.min(TRIES, v.best[s.id]))
    return { best, level: LEVELS.includes(v.level) ? v.level : 'medium' }
  } catch { return { best: {}, level: 'medium' } }
}

let round = 0
let nextTimer = null
const ms = () => useMatchStore.getState()

export const useTrainingStore = create((set, get) => ({
  ...load(),
  note: null, // { text, outcome, key } after a try
  tools: false, // Free play tools tray open
  moving: false, // Free play: drag caps and the ball around
  slow: false,

  _save() {
    const { best, level } = get()
    try { getSaveStorage()?.setItem(TRAINING_KEY, JSON.stringify({ best, level })) } catch { /* blocked */ }
  },

  /** The cone in your profile: open the Training Ground. */
  open() { ms().goToScreen(SCREEN.TRAINING) },

  setLevel(level) {
    if (!LEVELS.includes(level)) return
    set({ level })
    get()._save()
    const t = ms().training
    if (t) useMatchStore.setState({ training: { ...t, level } })
  },

  /** Start a skill: five tries. */
  startSkill(id) {
    if (!skillById(id)) return
    round++
    get()._try({ mode: 'skill', skill: id, n: 0, results: [], round, level: get().level, done: false })
  },

  /** Free play: the whole pitch, just you. */
  startFree() {
    get()._reset()
    forgetFlickSnapshot()
    ms().startTraining({ mode: 'free', level: get().level })
  },

  _try(training) {
    get()._reset()
    forgetFlickSnapshot()
    const c = skillSetup(training.skill, training.n, training.round)
    setPendingBodies(challengeBodies(c))
    ms().startTraining({ ...training, last: null })
    if (skillById(training.skill)?.chip) useMatchStore.setState({ chipArmed: 'team1_atk1' })
  },

  _reset() {
    clearTimeout(nextTimer)
    PHYSICS.timeScale = NORMAL_TIME
    set({ note: null, tools: false, moving: false, slow: false })
  },

  /** A flick has played out (MatchStore calls this through setTrainingHandler). */
  _ended(outcome) {
    const t = ms().training
    if (!t) return
    const chipped = !!lastFlickSnapshot() && wasChip
    const text = coachNote(outcome, chipped)
    set({ note: { text, outcome, key: Date.now() } })
    if (t.mode === 'free') {
      // A goal: everything back where it was so you can go again; otherwise play on from here
      if (outcome === 'goal' || outcome === 'own') get().undo(true)
      else useMatchStore.setState({ phase: PHASE.SELECT, activeTeam: 'team1', selectedCapId: null, shotCalled: false })
      return
    }
    const results = [...t.results, outcome === 'goal' ? 'goal' : 'miss']
    const last = t.n + 1 >= TRIES
    useMatchStore.setState({ training: { ...t, results, last: outcome, done: last }, phase: last ? PHASE.CHALLENGE_DONE : PHASE.SELECT })
    if (last) {
      const goals = results.filter((r) => r === 'goal').length
      if (goals > (get().best[t.skill] || 0) && (t.level !== 'easy')) { set({ best: { ...get().best, [t.skill]: goals } }); get()._save() }
      return
    }
    nextTimer = setTimeout(() => {
      const now = ms().training
      if (now && now.round === t.round && now.skill === t.skill) get()._try({ ...now, n: t.n + 1 })
    }, NOTE_MS)
  },

  /** Run the skill again from try one. */
  again() {
    const t = ms().training
    if (t?.mode === 'skill') get().startSkill(t.skill)
    else get().startFree()
  },

  /** Back to the Training Ground's home. */
  leave() {
    get()._reset()
    clearMatchTimers()
    stopAllBodies()
    useMatchStore.setState({ training: null, chipArmed: null, screen: SCREEN.TRAINING, phase: PHASE.SELECT, paused: false })
  },

  // ── Free play tools ──
  toggleTools() { set({ tools: !get().tools }) },
  toggleMove() { set({ moving: !get().moving }) },
  toggleSlow() {
    const slow = !get().slow
    PHYSICS.timeScale = slow ? NORMAL_TIME / 3 : NORMAL_TIME
    set({ slow })
  },
  /** Everything back to just before the last flick. */
  undo(quiet = false) {
    const snap = lastFlickSnapshot()
    if (!snap || ms().phase === PHASE.RESOLVE && chipInFlight()) return false
    clearMatchTimers()
    applyBodySnapshot(snap)
    stopAllBodies()
    useMatchStore.setState({ phase: PHASE.SELECT, activeTeam: 'team1', selectedCapId: null, shotCalled: false, chipArmed: null })
    if (!quiet) set({ note: null })
    return true
  },
  /** Free play from the start again (or this try again). */
  resetPitch() {
    const t = ms().training
    if (t?.mode === 'skill') get()._try({ ...t })
    else get().startFree()
  },
  /** A two-cap wall between the ball and the goal you attack. */
  addWall() {
    const B = getBodies()
    if (!B.ball) return
    const b = B.ball.position
    const dx = PITCH.halfW - b.x, dy = -b.y, l = Math.hypot(dx, dy) || 1
    const ux = dx / l, uy = dy / l, d = Math.min(3.6, l - 2)
    const cx = b.x + ux * d, cy = b.y + uy * d
    put(B.team2_def1, cx - uy * 0.82, cy + ux * 0.82)
    put(B.team2_def2, cx + uy * 0.82, cy - ux * 0.82)
    deOverlapBodies()
  },
  /** Just the ball, your nearest cap, and their keeper: the rest stand along the sides. */
  clearPitch() {
    const B = getBodies()
    if (!B.ball) return
    const b = B.ball.position
    const mine = Object.keys(B).filter((id) => id.startsWith('team1_') && !id.endsWith('_gk'))
    const keep = mine.sort((a, c) => dist(B[a], b) - dist(B[c], b))[0]
    let i = 0
    for (const id of Object.keys(B)) {
      if (id === 'ball' || id === keep || id.endsWith('_gk')) continue
      const side = id.startsWith('team1') ? 1 : -1
      put(B[id], -12 + (i++ % 10) * 2.6, side * (PITCH.halfH - CAP_RADIUS - 0.3))
    }
    deOverlapBodies()
  },
}))

let wasChip = false
/** Was the flick that just played out a chip? (the HUD's note says so) */
useMatchStore.subscribe((s, prev) => {
  if (s.phase === PHASE.RESOLVE && prev.phase !== PHASE.RESOLVE && s.training) wasChip = prev.chipArmed === prev.selectedCapId && !!prev.chipArmed
})

const dist = (body, p) => Math.hypot(body.position.x - p.x, body.position.y - p.y)
function put(body, x, y) {
  if (!body) return
  Matter.Body.setPosition(body, { x, y })
  Matter.Body.setVelocity(body, { x: 0, y: 0 })
}

/** Stars for a skill from your best score. */
export const skillStars = (best, id) => starsFor(best?.[id] || 0)

setTrainingHandler((outcome) => useTrainingStore.getState()._ended(outcome))

// Leaving the Training Ground any way (pause menu → quit) puts the speed back
useMatchStore.subscribe((s, prev) => {
  if (prev.training && !s.training && useTrainingStore.getState().slow) useTrainingStore.getState()._reset()
})
