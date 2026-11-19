import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore, PHASE, SCREEN, clearMatchTimers } from '../state/MatchStore'
import { useSavedStore, saveCurrentMatch, resumeSavedMatch } from '../state/savedMatch'
import { createPhysicsWorld } from '../physics/PhysicsWorld'

const base = { screen: SCREEN.PLAYING, gameMode: 'ai', challenge: null, penaltyShootout: false, kickoffGuard: false, goalKickGuard: false, freeKickCapId: null, penaltyKick: false, keeperDive: null }

function saveAndResume(state) {
  useMatchStore.setState({ ...base, ...state })
  expect(saveCurrentMatch()).toBe(true)
  useMatchStore.getState().quitMatch(SCREEN.MENU)
  useMatchStore.setState({ kickoffGuard: false, goalKickGuard: false, freeKickCapId: null, penaltyKick: false, keeperDive: null })
  expect(resumeSavedMatch()).toBe(true)
  return useMatchStore.getState()
}

describe('a saved match keeps the rules of the flick about to be taken', () => {
  beforeEach(() => {
    clearMatchTimers()
    useSavedStore.setState({ saved: null })
    createPhysicsWorld()
  })

  it('saved at kick-off: the first flick still can’t score', () => {
    expect(saveAndResume({ phase: PHASE.KICKOFF }).kickoffGuard).toBe(true)
    expect(saveAndResume({ phase: PHASE.SELECT, kickoffGuard: true }).kickoffGuard).toBe(true)
    expect(saveAndResume({ phase: PHASE.SELECT }).kickoffGuard).toBe(false)
  })

  it('saved at a free kick or goal kick: only the taker may play it', () => {
    const s = saveAndResume({ phase: PHASE.SELECT, activeTeam: 'team1', freeKickCapId: 'team1_atk1', goalKickGuard: true })
    expect(s.freeKickCapId).toBe('team1_atk1')
    expect(s.goalKickGuard).toBe(true)
    expect(s.phase).toBe(PHASE.SELECT)
  })

  it('saved at a penalty: still a penalty, with the keeper’s dive', () => {
    const s = saveAndResume({ phase: PHASE.SELECT, activeTeam: 'team2', freeKickCapId: 'team2_atk1', penaltyKick: true, keeperDive: 1 })
    expect(s.penaltyKick).toBe(true)
    expect(s.keeperDive).toBe(1)
    expect(s.freeKickCapId).toBe('team2_atk1')
  })

  it('an older save without the turn rules resumes as open play', () => {
    useMatchStore.setState({ ...base, phase: PHASE.SELECT })
    saveCurrentMatch()
    const { turn, ...old } = useSavedStore.getState().saved
    expect(turn).toBeTruthy()
    useSavedStore.setState({ saved: old })
    resumeSavedMatch()
    const s = useMatchStore.getState()
    expect(s.kickoffGuard).toBe(false)
    expect(s.freeKickCapId).toBe(null)
    expect(s.penaltyKick).toBe(false)
  })
})

it('a taker from the side not on the ball is ignored', () => {
  clearMatchTimers()
  createPhysicsWorld()
  useMatchStore.setState({ ...base, phase: PHASE.SELECT, activeTeam: 'team1', freeKickCapId: 'team2_atk1', penaltyKick: true, keeperDive: 0 })
  saveCurrentMatch()
  resumeSavedMatch()
  const s = useMatchStore.getState()
  expect(s.freeKickCapId).toBe(null)
  expect(s.penaltyKick).toBe(false)
})
