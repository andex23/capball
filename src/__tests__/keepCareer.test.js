import { describe, it, expect } from 'vitest'
import { bestCareer, careerProgress, careerEnded, mergeIntoPhone, CAREER_KEY, HALL_KEY } from '../lagos/keepCareer'

const career = (name, season, played) => JSON.stringify({
  v: 2, club: { name }, season,
  league: { fixtures: Array.from({ length: 14 }, (_, i) => ({ result: i < played ? { home: 1, away: 0 } : null })) },
  cup: { fixtures: [] },
})

describe('keeping the further career', () => {
  it('measures progress by season, then matches played', () => {
    expect(careerProgress(career('A', 2, 3))).toBeGreaterThan(careerProgress(career('A', 1, 14)))
    expect(careerProgress(career('A', 1, 5))).toBeGreaterThan(careerProgress(career('A', 1, 4)))
    expect(careerProgress(null)).toBe(-1)
  })
  it('never lets a cloud save with no career wipe the career on this phone', () => {
    const local = { v: 1, items: { [CAREER_KEY]: career('Eko FC', 2, 6), 'capball:rewards:v1': 'old' } }
    const cloud = { v: 1, items: { 'capball:rewards:v1': 'new' } }
    const { save, kept } = mergeIntoPhone(local, cloud)
    expect(kept).toBe(true)
    expect(save.items[CAREER_KEY]).toBe(local.items[CAREER_KEY])
    expect(save.items['capball:rewards:v1']).toBe('new')
  })
  it('takes the cloud career when it got further (another phone played on)', () => {
    const local = { v: 1, items: { [CAREER_KEY]: career('Eko FC', 1, 4) } }
    const cloud = { v: 1, items: { [CAREER_KEY]: career('Eko FC', 1, 9) } }
    expect(mergeIntoPhone(local, cloud)).toEqual({ save: cloud, kept: false })
  })
  it('brings a career back from the backup', () => {
    const backup = career('Eko FC', 3, 2)
    expect(mergeIntoPhone({ v: 1, items: {} }, { v: 1, items: {} }, backup).save.items[CAREER_KEY]).toBe(backup)
  })
  it('does not bring back a career that was retired or sacked', () => {
    const hall = JSON.stringify([{ club: 'Old FC', seasons: 2 }])
    const old = career('Old FC', 2, 10)
    expect(careerEnded(old, hall)).toBe(true)
    expect(bestCareer({ local: old, cloud: null, hall })).toBeNull()
    const cloud = { v: 1, items: { [HALL_KEY]: hall } }
    expect(mergeIntoPhone({ v: 1, items: { [CAREER_KEY]: old } }, cloud).save.items[CAREER_KEY]).toBeUndefined()
  })
})
