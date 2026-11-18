import { describe, it, expect } from 'vitest'
import { newCareer, careerNext, sanitizeCareer } from '../game/career'
import { signLegend } from '../game/transfers'
import { scoutPlayer, matchAttrs } from '../game/clubLife'
import { seasonLegends } from '../data/Legends'
import { answerPress, pressBoost, bestPerformer, fixtureBrief } from '../game/careerBrief'
import { headline, reportExtras, sanitizeExtras } from '../game/matchReport'
import { buildStory } from '../game/matchStory'
import { useCareerStore } from '../state/careerStore'

const club = { name: 'Rail End', primary: '#152b75', edge: '#fbc13a' }
const start = () => newCareer(club, { now: 123 })
describe('career matchday', () => {
  it('signs the advertised legend once and retains his identity across a reload', () => {
    const c = { ...start(), coins: 1000 }
    const [p] = seasonLegends(c.season)
    expect(signLegend({ ...c, coins: p.fee - 1 }, p.id).error).toBeTruthy()
    const signed = signLegend(c, p.id)
    expect(signed.coins).toBe(1000 - p.fee)
    expect(signed.reserves.at(-1)).toMatchObject({ name: p.name, id: p.id, age: p.age })
    expect(signed.reserves.at(-1).rating).toBeGreaterThanOrEqual(85)
    const reloaded = sanitizeCareer(JSON.parse(JSON.stringify(signed)))
    expect(signLegend(reloaded, p.id)).toEqual({ error: 'Already signed' })
    expect(seasonLegends(2).map((x) => x.id)).not.toContain(p.id)
  })

  it('redeems a free report once, including when the club has no cash', () => {
    const c = { ...start(), coins: 0, scoutCredits: 1 }
    const paid = scoutPlayer(c, 'w1')
    expect(paid).toMatchObject({ scoutCredits: 0, coins: 0, scouted: ['w1'] })
    expect(scoutPlayer(paid, 'w1')).toBe(paid)
    expect(scoutPlayer(sanitizeCareer(paid), 'w2').error).toBeTruthy()
  })

  it('keeps the interview and best cap in the saved result, with one boost for the next fixture', () => {
    const c = start()
    const a = c.squad.atk1
    const f = careerNext(c).fixture
    useCareerStore.setState({ career: c })
    useCareerStore.getState().record(f.id, { home: 1, away: 0 }, { byPlayer: { [a.id]: { role: 'atk1', rating: 8.4, goals: 1, sub: 'on' } } })
    const recorded = useCareerStore.getState().career
    expect(bestPerformer(recorded)).toMatchObject({ name: a.name, rating: 8.4, sub: 'on' })
    expect(recorded.lastMatch.brief).toBe(fixtureBrief(c))
    const backed = sanitizeCareer(answerPress(recorded, 'player'))
    expect(answerPress(backed, 'squad')).toBeNull()
    expect(pressBoost(backed, a)).toBe(4)
    expect(pressBoost(backed, c.squad.gk)).toBe(0)
    expect(matchAttrs(a, 4).pas).toBe(Math.min(99, a.attrs.pas + 4))
    useCareerStore.setState({ career: backed })
    useCareerStore.getState().record(careerNext(backed).fixture.id, { home: 0, away: 0 })
    expect(pressBoost(useCareerStore.getState().career, a)).toBe(0)
  })

  it('attributes an extra-time winner to the named substitute who actually flicked', () => {
    const goalLog = [{ team: 'team1', cap: 'team1_atk1', playerName: 'Castoro', half: 3, t: 40, sub: true, fromOwnHalf: true }]
    const params = { side: 'team1', goalLog, matchDuration: 120, extraTime: true, teamConfig: { team1: { name: 'Rail End', players: { atk1: 'Someone else' } }, team2: { name: 'Corks' } } }
    const extra = reportExtras(params)
    expect(sanitizeExtras(extra)).toEqual(extra)
    expect(extra.scorers[0]).toMatchObject({ min: 105, name: 'Castoro', mine: true })
    expect(extra.momentum).toHaveLength(12)
    expect(extra.momentum[10]).toBe(3)
    expect(buildStory({ ...params, score: { team1: 1, team2: 0 } })[1].text).toContain('Castoro scores from their own half')
    expect(headline({ club: 'Rail End', opp: 'Corks', gf: 1, ga: 0, scorers: extra.scorers })).toBe('Substitute Castoro scores the winner for Rail End')
  })
})
