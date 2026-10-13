import { it, expect } from 'vitest'
import { buildStory, footballMinute, sanitizeStory } from '../game/matchStory'
import { canChooseExtraTime, canChoosePenalties, endChoiceOutcome } from '../multiplayer/protocol'

const teamConfig = { team1: { name: 'Yaba United', players: { atk1: 'Okafor' } }, team2: { name: 'Kerbside Utd' } }

it('a written report: kick-off, goals with minutes, chances, full time (and extra time)', () => {
  expect(footballMinute(1, 60, 120)).toBe(23)
  expect(footballMinute(2, 0, 120)).toBe(90)
  expect(footballMinute(3, 40, 80)).toBe(105)
  const story = buildStory({
    goalLog: [{ team: 'team1', cap: 'team1_atk1', half: 1, t: 60 }, { team: 'team2', cap: 'team2_mid', half: 2, t: 10 }],
    matchEvents: [{ type: 'save', cap: 'team2_atk1', by: 'team1_gk' }],
    teamConfig, score: { team1: 1, team2: 1 }, matchDuration: 120, seed: 's', extraTime: true,
  })
  expect(story[0].kind).toBe('kickoff')
  expect(story.filter((x) => x.kind === 'goal').map((x) => x.min)).toEqual([23, 86])
  expect(story.at(-1)).toMatchObject({ kind: 'fulltime', min: 120 })
  expect(sanitizeStory(JSON.parse(JSON.stringify(story)))).toEqual(story)
})

it('online: extra time is on offer after a draw, not after extra time; penalties after either', () => {
  const draw = { isDraw: true }
  expect(canChooseExtraTime(draw)).toBe(true)
  expect(canChooseExtraTime({ ...draw, afterExtraTime: true })).toBe(false)
  expect(canChoosePenalties({ ...draw, afterExtraTime: true })).toBe(true)
  expect(endChoiceOutcome({ team1: 'extraTime', team2: 'extraTime' }, draw)).toBe('extraTime')
  expect(endChoiceOutcome({ team1: 'extraTime', team2: 'extraTime' }, { ...draw, afterExtraTime: true })).toBe(null)
})
