import { describe, it, expect } from 'vitest'
import { flickError, controllableTeams, capSelectable, powerFraction, fullPowerPixels, MIN_FLICK_PX } from '../game/flick'
import { keeperCanPlay } from '../game/rules'
import { PITCH } from '../data/TeamData'

const ok = { paused: false, phase: 'SELECT', activeTeam: 'team1', freeKickCapId: null }
const v = { x: 2, y: 1 }

describe('flickError', () => {
  it('allows the active team to flick its own cap', () => {
    expect(flickError(ok, { capId: 'team1_atk1', velocity: v })).toBeNull()
    expect(flickError({ ...ok, phase: 'AIM' }, { capId: 'team1_gk', velocity: v })).toBeNull()
  })

  it('refuses out-of-turn, paused and mid-resolve flicks', () => {
    expect(flickError(ok, { capId: 'team2_atk1', velocity: v })).toBe('not-your-cap')
    expect(flickError({ ...ok, paused: true }, { capId: 'team1_atk1', velocity: v })).toBe('paused')
    expect(flickError({ ...ok, phase: 'RESOLVE' }, { capId: 'team1_atk1', velocity: v })).toBe('wrong-phase')
    expect(flickError({ ...ok, phase: 'KICKOFF' }, { capId: 'team1_atk1', velocity: v })).toBe('wrong-phase')
    expect(flickError(ok, { capId: 'team1_atk1', velocity: v, byTeam: 'team2' })).toBe('not-your-turn')
  })

  it('only the designated taker can take a set piece', () => {
    const fk = { ...ok, freeKickCapId: 'team1_atk1' }
    expect(flickError(fk, { capId: 'team1_def1', velocity: v })).toBe('set-piece-taker-only')
    expect(flickError(fk, { capId: 'team1_atk1', velocity: v })).toBeNull()
  })

  it('keepers only play with the ball in or near their own box', () => {
    const left = { ...ok, team1Side: 'left' } // team1 defends the left goal
    const nearOwnBox = { x: -PITCH.halfW + 4, y: 1 }
    const edgeOfReach = { x: -PITCH.halfW + PITCH.penAreaW + 2, y: 0 } // just outside the box
    const midfield = { x: 0, y: 0 }
    const otherEnd = { x: PITCH.halfW - 3, y: 0 }
    expect(flickError(left, { capId: 'team1_gk', velocity: v, ball: nearOwnBox })).toBeNull()
    expect(flickError(left, { capId: 'team1_gk', velocity: v, ball: edgeOfReach })).toBeNull()
    expect(flickError(left, { capId: 'team1_gk', velocity: v, ball: midfield })).toBe('keeper-out-of-range')
    expect(flickError(left, { capId: 'team1_gk', velocity: v, ball: otherEnd })).toBe('keeper-out-of-range')
    // Outfield caps are unaffected
    expect(flickError(left, { capId: 'team1_def1', velocity: v, ball: midfield })).toBeNull()
    // After half time the ends swap, and so does where the keeper may play
    const swapped = { ...left, team1Side: 'right' }
    expect(flickError(swapped, { capId: 'team1_gk', velocity: v, ball: nearOwnBox })).toBe('keeper-out-of-range')
    expect(flickError(swapped, { capId: 'team1_gk', velocity: v, ball: otherEnd })).toBeNull()
    // team2's keeper uses team2's box
    const t2 = { ...left, activeTeam: 'team2' }
    expect(flickError(t2, { capId: 'team2_gk', velocity: v, ball: otherEnd })).toBeNull()
    expect(flickError(t2, { capId: 'team2_gk', velocity: v, ball: nearOwnBox })).toBe('keeper-out-of-range')
    // A keeper named as the set-piece taker may always take it
    expect(flickError({ ...left, freeKickCapId: 'team1_gk' }, { capId: 'team1_gk', velocity: v, ball: midfield })).toBeNull()
    // Same answer for picking the cap up
    expect(capSelectable(left, 'team1_gk', midfield)).toBe(false)
    expect(capSelectable(left, 'team1_gk', nearOwnBox)).toBe(true)
    expect(capSelectable(left, 'team1_atk1', otherEnd)).toBe(true)
  })

  it('keeper reach: the box plus a few units, nowhere else', () => {
    expect(keeperCanPlay(-PITCH.halfW + 1, 0, -1)).toBe(true)
    expect(keeperCanPlay(-PITCH.halfW + 1, PITCH.halfH - 0.5, -1)).toBe(false) // out by the corner flag
    expect(keeperCanPlay(-PITCH.halfW + PITCH.penAreaW + 4, 0, -1)).toBe(false)
    expect(keeperCanPlay(PITCH.halfW - 1, 0, 1)).toBe(true)
    expect(keeperCanPlay(PITCH.halfW - 1, 0, -1)).toBe(false)
  })

  it('rejects bad velocities', () => {
    expect(flickError(ok, { capId: 'team1_atk1', velocity: { x: NaN, y: 0 } })).toBe('bad-velocity')
    expect(flickError(ok, { capId: 'team1_atk1', velocity: { x: 0, y: 0 } })).toBe('bad-velocity')
    expect(flickError(ok, { capId: 'team1_atk1', velocity: null })).toBe('bad-velocity')
    expect(flickError(ok, { capId: 'ball', velocity: v })).toBe('not-your-cap')
  })
})

describe('controllableTeams', () => {
  it('local players control both teams', () => {
    expect(controllableTeams({ gameMode: 'local' })).toEqual(['team1', 'team2'])
  })
  it('never the CPU team', () => {
    expect(controllableTeams({ gameMode: 'ai', aiTeam: 'team2' })).toEqual(['team1'])
  })
  it('online: only your own team', () => {
    expect(controllableTeams({ gameMode: 'online', onlineMyTeam: 'team2' })).toEqual(['team2'])
    expect(controllableTeams({ gameMode: 'online', onlineMyTeam: null })).toEqual([])
  })
})

describe('drag → power', () => {
  it('ignores tiny pulls, ramps gently, and tops out at a long pull', () => {
    const W = 390, H = 844
    const full = fullPowerPixels(W, H)
    expect(powerFraction(MIN_FLICK_PX - 1, W, H)).toBe(0)
    const quarter = powerFraction(MIN_FLICK_PX + (full - MIN_FLICK_PX) * 0.25, W, H)
    const half = powerFraction(MIN_FLICK_PX + (full - MIN_FLICK_PX) * 0.5, W, H)
    expect(quarter).toBeLessThan(0.25) // short pulls are softer than a straight line
    expect(half).toBeLessThan(0.5)
    expect(half).toBeGreaterThan(quarter)
    expect(powerFraction(full, W, H)).toBe(1)
    expect(powerFraction(full * 3, W, H)).toBe(1)
  })

  it('needs a similar pull on any phone, in either orientation', () => {
    expect(fullPowerPixels(390, 844)).toBe(fullPowerPixels(844, 390))
    expect(fullPowerPixels(320, 568)).toBeGreaterThanOrEqual(110)
    expect(fullPowerPixels(1440, 900)).toBeLessThanOrEqual(230)
  })
})
