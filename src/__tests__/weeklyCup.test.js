import { describe, it, expect, beforeEach } from 'vitest'
import { weeklyCup, cupTeams, levelForRound, CUP_CAPS, CUP_PRIZE } from '../game/weeklyCup'
import { createTournament, sanitizeTournament } from '../game/tournament'
import { useRewardsStore } from '../state/rewardsStore'
import { useAccountStore } from '../state/accountStore'

describe('the Weekly Cup', () => {
  it('the same cup for everyone in a week; a new one next week', () => {
    const a = weeklyCup('2026-W47')
    expect(weeklyCup('2026-W47')).toEqual(a)
    expect(a.clubs).toHaveLength(7)
    expect(a.clubs.every((c) => c.cpu && c.name.length <= 16)).toBe(true)
    expect(new Set(a.clubs.map((c) => c.name)).size).toBe(7)
    expect(weeklyCup('2026-W48').name).not.toBe(a.name)
  })
  it('eight teams with you first, and it keeps its name through a save', () => {
    const cup = weeklyCup('2026-W47')
    const teams = cupTeams(cup, { name: 'Rail End', primary: '#123456' })
    expect(teams).toHaveLength(8)
    expect(teams[0]).toMatchObject({ name: 'Rail End', cpu: false })
    const t = createTournament({ format: 'knockout', teams, matchDuration: 120, weekly: { key: cup.key, name: cup.name } })
    expect(t.rounds).toHaveLength(3)
    expect(sanitizeTournament(JSON.parse(JSON.stringify(t))).weekly).toEqual({ key: '2026-W47', name: cup.name })
  })
  it('gets harder each round: easy, medium, then hard in the final', () => {
    expect([0, 1, 2].map((r) => levelForRound(r, 3))).toEqual(['easy', 'medium', 'hard'])
  })
})

describe('winning it', () => {
  beforeEach(() => {
    useAccountStore.setState({ username: 'tester' })
    useRewardsStore.setState({ caps: [], cups: [], bank: 0, news: [] })
  })
  it('pays the prize and the cup cap once a week', () => {
    const cup = weeklyCup('2026-W47')
    expect(useRewardsStore.getState().winCup({ key: cup.key, name: cup.name })).toBe(true)
    expect(useRewardsStore.getState().winCup({ key: cup.key, name: cup.name })).toBe(false)
    const s = useRewardsStore.getState()
    expect(s.cups.map((c) => c.name)).toEqual([cup.name])
    expect(s.caps).toContain(CUP_CAPS.find((c) => c.name === cup.name).key)
    expect(s.bank).toBe(CUP_PRIZE) // no career yet: it waits in the bank
  })
})
