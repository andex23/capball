import { describe, it, expect } from 'vitest'
import { newCareer, recordCareerResult, nextMatch, seasonOver, finishSeason, acceptJob, stayPut, sanitizeCareer, ME, DIVISIONS } from '../game/career'
import { teamById } from '../game/tournament'
import { offerDetails, JOB_BUDGET } from '../game/jobs'

const club = { name: 'Job Test FC', primary: '#123456', edge: '#ffffff' }

function playOut(c, [gf, ga]) {
  while (!seasonOver(c.league)) {
    const f = nextMatch(c.league)
    if (!f) break
    c = recordCareerResult(c, f.id, f.home === ME ? { home: gf, away: ga } : { home: ga, away: gf })
  }
  return { ...c, cup: null }
}

describe('job offers', () => {
  it('a promotion after settling in brings an offer from a strong club a division above', () => {
    // First season: promoted, but too soon to move
    const one = finishSeason(playOut(newCareer(club, { now: 7 }), [4, 0]))
    expect(one.level).toBe(1)
    expect(one.jobOffer).toBeNull()
    // Second season: promoted again, and a club two divisions up calls
    const two = finishSeason(playOut(one, [4, 0]))
    expect(two.level).toBe(2)
    expect(two.jobOffer).toMatchObject({ level: 3, reason: 'promoted' })
    const d = offerDetails(two, two.jobOffer)
    expect(d.budget).toBe(JOB_BUDGET[3])
    expect(d.ovr).toBeGreaterThan(55)
    return two
  })

  it('taking the job: their name, squad, division and budget; your records and old club come along', () => {
    const one = finishSeason(playOut(newCareer(club, { now: 7 }), [4, 0]))
    const two = finishSeason(playOut(one, [4, 0]))
    const offer = two.jobOffer
    const moved = acceptJob(two, 9)
    expect(moved.club.name).toBe(offer.name)
    expect(moved.level).toBe(offer.level)
    expect(moved.coins).toBe(JOB_BUDGET[offer.level])
    expect(Object.keys(moved.squad)).toHaveLength(6)
    expect(moved.bench.length).toBe(4)
    // Records stay
    expect(moved.promotions).toBe(two.promotions)
    expect(moved.past).toEqual(two.past)
    expect(moved.jobs[0]).toMatchObject({ from: club.name, to: offer.name })
    // Your old club now plays in the new club's old slot, with your old players
    const names = moved.league.teams.map((t) => t.name)
    expect(names).toContain(club.name)
    expect(names.filter((n) => n === offer.name)).toHaveLength(1)
    expect(moved.league.teams).toHaveLength(8)
    const old = moved.world.clubs.find((c) => c.name === club.name)
    expect(old.players.map((p) => p.id)).toContain(two.squad.gk.id)
    // And it all survives a save
    const again = sanitizeCareer(JSON.parse(JSON.stringify(moved)))
    expect(again).toEqual(moved)
    expect(again.league.teams.map((t) => t.name)).toEqual(names)
  })

  it('turning it down: you stay, and the fans like it', () => {
    const one = finishSeason(playOut(newCareer(club, { now: 7 }), [4, 0]))
    const two = finishSeason(playOut(one, [4, 0]))
    const stay = stayPut(two)
    expect(stay.jobOffer).toBeNull()
    expect(stay.club.name).toBe(club.name)
    expect(stay.biz.fans).toBeGreaterThan(two.biz.fans)
  })

  it('sacked: a smaller club may still give you a job, and the career carries on', () => {
    let c = newCareer(club, { now: 5 })
    c = finishSeason(playOut(c, [4, 0]))          // promoted to the Sunday League
    c = finishSeason(playOut(c, [0, 3]))          // bottom: final warning
    expect(c.warning).toBe(true)
    const sacked = finishSeason(playOut(c, [0, 3]))
    expect(sacked.sacked).toBeTruthy()
    expect(sacked.jobOffer).toMatchObject({ reason: 'sacked' })
    expect(sacked.jobOffer.level).toBeLessThanOrEqual(sacked.level)
    const back = acceptJob(sacked, 11)
    expect(back.sacked).toBeNull()
    expect(back.season).toBe(sacked.season + 1)
    expect(back.club.name).toBe(sacked.jobOffer.name)
    expect(DIVISIONS[back.level]).toBeTruthy()
    expect(teamById(back.league, ME).name).toBe(back.club.name)
  })
})
