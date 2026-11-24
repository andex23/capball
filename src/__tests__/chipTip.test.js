import { describe, it, expect } from 'vitest'
import { chipChance } from '../ui/ChipTip'
import { PHASE } from '../state/MatchStore'
import { challengeFor } from '../game/daily'

const at = (x, y) => ({ position: { x, y } })
const state = { phase: PHASE.SELECT, activeTeam: 'team1', gameMode: 'ai', aiTeam: 'team2', team1Side: 'left', chipsLeft: { team1: 3, team2: 3 } }

describe('the chip tip', () => {
  it('shows when your cap is next to the ball well into the half you attack', () => {
    expect(chipChance(state, { ball: at(8, 0), team1_atk1: at(7, 0) })).toBe(true)
  })
  it('not at kick-off, in your own half, on the computer\'s turn, or with no chips left', () => {
    expect(chipChance(state, { ball: at(0, 0), team1_atk1: at(-1, 0) })).toBe(false)
    expect(chipChance(state, { ball: at(-8, 0), team1_atk1: at(-9, 0) })).toBe(false)
    expect(chipChance({ ...state, activeTeam: 'team2' }, { ball: at(-8, 0), team2_atk1: at(-7, 0) })).toBe(false)
    expect(chipChance({ ...state, chipsLeft: { team1: 0 } }, { ball: at(8, 0), team1_atk1: at(7, 0) })).toBe(false)
    expect(chipChance(state, { ball: at(8, 0), team1_atk1: at(2, 0) })).toBe(false)
  })
})

describe('daily challenge', () => {
  it('gives the easy days (Monday, Tuesday) one more flick', () => {
    expect(challengeFor('2026-11-23').flicks).toBe(3) // Monday's free kick: 2 + 1
    expect(challengeFor('2026-11-26').flicks).toBe(2) // Thursday stays as it was
  })
})
