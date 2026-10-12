import { describe, it, expect } from 'vitest'
import { resultWords } from '../ui/MatchResultSplash'

const teams = { team1: { name: 'Lagos Fizz' }, team2: { name: 'Royal Crowns', cpu: true } }

describe('result screen words', () => {
  it('a loss to the computer says you lost, never victory', () => {
    const w = resultWords({ teams, score: { team1: 1, team2: 2 }, winner: 'team2', myTeam: 'team1' })
    expect(w.tone).toBe('loss')
    expect(w.title).toBe('You lost')
    expect(w.line).toMatch(/one goal/i)
  })
  it('a win says you win; penalties are mentioned', () => {
    expect(resultWords({ teams, score: { team1: 4, team2: 0 }, winner: 'team1', myTeam: 'team1' }).title).toBe('You win')
    expect(resultWords({ teams, score: { team1: 1, team2: 1 }, winner: 'team2', myTeam: 'team1', penaltyScore: { team1: 3, team2: 4 } }).line).toMatch(/penalties/i)
  })
  it('two players on one phone: the winner is named', () => {
    expect(resultWords({ teams, score: { team1: 2, team2: 1 }, winner: 'team1', myTeam: null }).title).toBe('Lagos Fizz win')
  })
  it('a draw is a draw', () => {
    expect(resultWords({ teams, score: { team1: 1, team2: 1 }, winner: null, myTeam: 'team1' }).tone).toBe('draw')
  })
})
