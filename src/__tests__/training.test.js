import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SKILLS, skillSetup, starsFor, coachNote, TRIES } from '../game/training'
import { challengeBodies } from '../game/daily'
import { PITCH, CAP_RADIUS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { useMatchStore, PHASE, clearMatchTimers } from '../state/MatchStore'
import { useTrainingStore } from '../state/trainingStore'
import { keeperReflex, REFLEX_LEVEL } from '../game/keeper'
import { chipError } from '../game/chip'

const radius = (id) => (id === 'ball' ? BALL_RADIUS : id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS)

describe('training skills', () => {
  it('every try of every skill puts everything on the pitch without overlaps', () => {
    for (const s of SKILLS) for (let round = 0; round < 6; round++) for (let n = 0; n < TRIES; n++) {
      const b = challengeBodies(skillSetup(s.id, n, round))
      const ids = Object.keys(b)
      for (const id of ids) {
        expect(Math.abs(b[id][0])).toBeLessThanOrEqual(PITCH.halfW - radius(id) + 0.01)
        expect(Math.abs(b[id][1])).toBeLessThanOrEqual(PITCH.halfH - radius(id) + 0.01)
      }
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        expect(Math.hypot(b[ids[i]][0] - b[ids[j]][0], b[ids[i]][1] - b[ids[j]][1])).toBeGreaterThan(radius(ids[i]) + radius(ids[j]) - 0.05)
      }
    }
  })
  it('the set-up shifts from try to try', () => {
    expect(skillSetup('chip', 0, 1).ball).not.toEqual(skillSetup('chip', 1, 1).ball)
  })
  it('stars: 1, 3 and 4 goals of 5', () => {
    expect([0, 1, 2, 3, 4, 5].map(starsFor)).toEqual([0, 1, 1, 2, 3, 3])
  })
  it('says why a try missed', () => {
    expect(coachNote('overBar')).toMatch(/too much power/)
    expect(coachNote('chipSave')).toMatch(/too much air/)
    expect(coachNote('goal', true)).toMatch(/chip/)
  })
})

describe('the Training Ground in play', () => {
  const initial = useMatchStore.getState()
  beforeEach(() => {
    vi.useFakeTimers()
    clearMatchTimers()
    useMatchStore.setState(initial, true)
    useTrainingStore.setState({ best: {}, level: 'medium', note: null })
  })
  const ms = () => useMatchStore.getState()

  it('five tries, then stars; your best is kept (not on Easy)', () => {
    useTrainingStore.getState().startSkill('chip')
    expect(ms().training).toMatchObject({ mode: 'skill', skill: 'chip', n: 0 })
    expect(ms().chipArmed).toBe('team1_atk1') // the chip skill starts set to chip
    for (const o of ['goal', 'chipSave', 'goal', 'goal', 'overBar']) {
      useTrainingStore.getState()._ended(o)
      vi.advanceTimersByTime(2000)
    }
    expect(ms().training).toMatchObject({ done: true, results: ['goal', 'miss', 'goal', 'goal', 'miss'] })
    expect(ms().phase).toBe(PHASE.CHALLENGE_DONE)
    expect(useTrainingStore.getState().best.chip).toBe(3)
    useTrainingStore.getState().setLevel('easy')
    useTrainingStore.getState().again()
    for (let i = 0; i < 5; i++) { useTrainingStore.getState()._ended('goal'); vi.advanceTimersByTime(2000) }
    expect(useTrainingStore.getState().best.chip).toBe(3)
  })

  it('a flick that plays out without a goal comes back to you (no other team, no turns)', () => {
    useTrainingStore.getState().startFree()
    useMatchStore.setState({ phase: PHASE.RESOLVE })
    ms().switchTurn()
    expect(ms()).toMatchObject({ activeTeam: 'team1', phase: PHASE.SELECT })
    expect(useTrainingStore.getState().note.text).toBeTruthy()
  })

  it('a foul or a goal kick ends the try, never a real restart', () => {
    useTrainingStore.getState().startSkill('bend')
    ms().callFoul({ x: 5, y: 0 }, 'team2', false)
    expect(ms().training.results).toEqual(['miss'])
    expect(ms().foulData).toBeFalsy()
  })

  it('the keeper plays at your level, and chips are unlimited', () => {
    useTrainingStore.getState().setLevel('hard')
    useTrainingStore.getState().startFree()
    expect(keeperReflex(ms(), 'team2')).toBe(REFLEX_LEVEL.hard)
    expect(chipError({ ...ms(), chipsLeft: { team1: 0, team2: 0 } }, 'team1_atk1', { x: 6, y: 0 }, { x: 4.6, y: 0 })).toBeNull()
  })

  it('leaving puts the game back to normal', () => {
    useTrainingStore.getState().startFree()
    useTrainingStore.getState().toggleSlow()
    useTrainingStore.getState().leave()
    expect(ms().training).toBeNull()
    expect(useTrainingStore.getState().slow).toBe(false)
  })
})
