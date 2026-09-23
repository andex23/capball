import { describe, it, expect } from 'vitest'
import {
  otherTeam, teamOf, teamHomeDir, scorerForBall, judgeGoal, classifyContact,
  isInPenaltyArea, shootoutStatus, nextShooter, matchWinner, formatClock,
} from '../game/rules'
import { PITCH } from '../data/TeamData'

const inLeftGoal = { x: -PITCH.halfW - 0.5, y: 0 }
const inRightGoal = { x: PITCH.halfW + 0.5, y: 0 }

describe('teams', () => {
  it('flips teams and reads labels', () => {
    expect(otherTeam('team1')).toBe('team2')
    expect(otherTeam('team2')).toBe('team1')
    expect(teamOf('team2_atk1')).toBe('team2')
    expect(teamOf('ball')).toBeNull()
    expect(teamOf('Rectangle Body')).toBeNull()
    expect(teamOf(undefined)).toBeNull()
  })

  it('puts teams at opposite ends and swaps with team1Side', () => {
    expect(teamHomeDir('team1', 'left')).toBe(-1)
    expect(teamHomeDir('team2', 'left')).toBe(1)
    expect(teamHomeDir('team1', 'right')).toBe(1)
    expect(teamHomeDir('team2', 'right')).toBe(-1)
  })
})

describe('scorerForBall', () => {
  it('credits the team attacking that goal', () => {
    expect(scorerForBall(inLeftGoal.x, 0, 'left')).toBe('team2')
    expect(scorerForBall(inRightGoal.x, 0, 'left')).toBe('team1')
    expect(scorerForBall(inLeftGoal.x, 0, 'right')).toBe('team1')
    expect(scorerForBall(inRightGoal.x, 0, 'right')).toBe('team2')
  })

  it('ignores a ball on the pitch or wide of the posts', () => {
    expect(scorerForBall(0, 0, 'left')).toBeNull()
    expect(scorerForBall(PITCH.halfW - 0.1, 0, 'left')).toBeNull()
    expect(scorerForBall(inRightGoal.x, PITCH.goalWidth / 2, 'left')).toBeNull()
  })
})

describe('judgeGoal', () => {
  const base = { ...inRightGoal, team1Side: 'left', kickoffGuard: false, lastFlickedCapId: 'team1_atk1' }

  it('counts a normal goal', () => {
    expect(judgeGoal(base)).toEqual({ outcome: 'goal', scorer: 'team1' })
  })

  it('returns null when the ball is not in a goal', () => {
    expect(judgeGoal({ ...base, x: 0 })).toBeNull()
  })

  it('disallows a goal straight from the kick-off', () => {
    expect(judgeGoal({ ...base, kickoffGuard: true }).outcome).toBe('kickoff_violation')
  })

  it('stops a goalkeeper scoring for their own team', () => {
    expect(judgeGoal({ ...base, lastFlickedCapId: 'team1_gk' }).outcome).toBe('gk_violation')
  })

  it('still counts an own goal off a goalkeeper', () => {
    // team2's keeper knocks it into the right goal (team2's own) → team1 scores
    expect(judgeGoal({ ...base, lastFlickedCapId: 'team2_gk' })).toEqual({ outcome: 'goal', scorer: 'team1' })
  })
})

describe('classifyContact', () => {
  it('sorts the first contact of a flicked cap', () => {
    expect(classifyContact('team1_atk1', 'ball')).toBe('ball')
    expect(classifyContact('team1_atk1', 'team1_def1')).toBe('teammate')
    expect(classifyContact('team1_atk1', 'team2_def1')).toBe('foul')
    expect(classifyContact('team1_atk1', 'Rectangle Body')).toBe('wall')
  })
})

describe('isInPenaltyArea', () => {
  it('matches the drawn boxes at each end', () => {
    expect(isInPenaltyArea(-PITCH.halfW + 1, 0, -1)).toBe(true)
    expect(isInPenaltyArea(-PITCH.halfW + 1, 0, 1)).toBe(false)
    expect(isInPenaltyArea(PITCH.halfW - 1, 0, 1)).toBe(true)
    expect(isInPenaltyArea(PITCH.halfW - PITCH.penAreaW - 0.1, 0, 1)).toBe(false)
    expect(isInPenaltyArea(PITCH.halfW - 1, PITCH.penAreaH / 2 + 0.1, 1)).toBe(false)
  })
})

describe('shootoutStatus', () => {
  const st = (k1, k2, g1, g2) => shootoutStatus({ team1: k1, team2: k2 }, { team1: g1, team2: g2 })

  it('is open at the start', () => {
    expect(st(0, 0, 0, 0)).toMatchObject({ decided: false, suddenDeath: false })
  })

  it('ends early once one side cannot catch up', () => {
    // 2-0 after two kicks each, team2 has one kick left
    expect(st(2, 2, 2, 0)).toMatchObject({ decided: true, winner: 'team1' })
    // team1 3/3, team2 0/2 with one to go → can't reach 3
    expect(st(3, 2, 3, 0)).toMatchObject({ decided: true, winner: 'team1' })
    // team1 missed all three, team2 1/2 → already ahead with a kick in hand
    expect(st(3, 2, 0, 1)).toMatchObject({ decided: true, winner: 'team2' })
  })

  it('waits while the chasing side can still level', () => {
    expect(st(1, 0, 1, 0).decided).toBe(false)
    expect(st(3, 2, 2, 1).decided).toBe(false)
  })

  it('goes to sudden death when level after three rounds', () => {
    expect(st(3, 3, 2, 2)).toMatchObject({ decided: false, suddenDeath: true })
    // team1 scores first in sudden death — team2 still gets to reply
    expect(st(4, 3, 3, 2).decided).toBe(false)
    expect(st(4, 4, 3, 2)).toMatchObject({ decided: true, winner: 'team1' })
    expect(st(4, 4, 3, 3).decided).toBe(false)
  })

  it('alternates shooters, team1 first', () => {
    expect(nextShooter({ team1: 0, team2: 0 })).toBe('team1')
    expect(nextShooter({ team1: 1, team2: 0 })).toBe('team2')
    expect(nextShooter({ team1: 4, team2: 4 })).toBe('team1')
  })
})

describe('misc', () => {
  it('finds the winner', () => {
    expect(matchWinner({ team1: 2, team2: 1 })).toBe('team1')
    expect(matchWinner({ team1: 0, team2: 3 })).toBe('team2')
    expect(matchWinner({ team1: 1, team2: 1 })).toBeNull()
  })

  it('formats the clock', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(59.2)).toBe('1:00')
    expect(formatClock(0.4)).toBe('0:01')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-3)).toBe('0:00')
  })
})
