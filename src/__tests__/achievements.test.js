import { describe, it, expect } from 'vitest'
import { matchAchievements } from '../game/achievements'
import { useAchievementStore } from '../state/achievementStore'
import { useAccountStore } from '../state/accountStore'

const goal = (team, cap, extra = {}) => ({ team, cap, half: 1, t: 50, ...extra })
const base = { me: 'team1', gameMode: 'ai', aiDifficulty: 'medium', stats: { team1: {}, team2: {} } }

describe('achievements', () => {
  it('a 4–0 with a hat-trick earns win, clean sheet, demolition and hat-trick', () => {
    const ids = matchAchievements({ ...base, result: { score: { team1: 4, team2: 0 } }, goalLog: [goal('team1', 'team1_atk1'), goal('team1', 'team1_atk1'), goal('team1', 'team1_mid'), goal('team1', 'team1_atk1')] })
    expect(ids).toEqual(expect.arrayContaining(['first_win', 'clean_sheet', 'thrashing', 'hat_trick']))
    expect(ids).not.toContain('comeback')
  })

  it('coming back from 0–2 to win 3–2 late is a comeback and a last-gasp winner', () => {
    const goalLog = [goal('team2', 'team2_atk1'), goal('team2', 'team2_atk2'), goal('team1', 'team1_atk1'), goal('team1', 'team1_mid', { half: 2, t: 40 }), goal('team1', 'team1_atk2', { half: 2, t: 8 })]
    const ids = matchAchievements({ ...base, result: { score: { team1: 3, team2: 2 } }, goalLog })
    expect(ids).toEqual(expect.arrayContaining(['comeback', 'late_winner']))
  })

  it('an early winner is not last-gasp; a loss earns nothing for winning', () => {
    expect(matchAchievements({ ...base, result: { score: { team1: 1, team2: 0 } }, goalLog: [goal('team1', 'team1_atk1', { half: 1, t: 10 })] })).not.toContain('late_winner')
    expect(matchAchievements({ ...base, result: { score: { team1: 0, team2: 1 } }, goalLog: [goal('team2', 'team2_atk1')] })).toEqual([])
  })

  it('keeper saves, woodwork, Hard CPU, shootouts and streaks', () => {
    const ids = matchAchievements({
      ...base, aiDifficulty: 'hard', result: { score: { team1: 1, team2: 1 }, penaltyScore: { team1: 3, team2: 2 } },
      stats: { team1: { saves: 3 }, team2: {} }, matchEvents: [{ type: 'post', cap: 'team1_atk1' }, { type: 'post', cap: 'team1_mid' }], streak: 3,
    })
    expect(ids).toEqual(expect.arrayContaining(['wall', 'woodwork', 'hard_win', 'shootout', 'streak3', 'first_win']))
  })

  it('only signed-in players earn them, and each only once', () => {
    useAchievementStore.setState({ earned: {}, fresh: [] })
    useAccountStore.setState({ username: null })
    expect(useAchievementStore.getState().award(['first_win'])).toEqual([])
    useAccountStore.setState({ username: 'dru' })
    expect(useAchievementStore.getState().award(['first_win', 'cup'])).toEqual(['first_win', 'cup'])
    expect(useAchievementStore.getState().award(['first_win'])).toEqual([])
    expect(useAchievementStore.getState().noteMatch({ won: true, table: 'bar' }).winStreak).toBe(1)
    useAccountStore.setState({ username: null })
  })
})
