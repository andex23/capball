/**
 * CAPBALL match rules as pure functions.
 *
 * Nothing in here touches the physics engine, the store or the DOM, so every
 * rule can be unit tested directly and shared between the host and the AI.
 */

import { PITCH } from '../data/TeamData'

export const SHOOTOUT_ROUNDS = 3

export function otherTeam(team) {
  return team === 'team1' ? 'team2' : 'team1'
}

/** 'team1' | 'team2' | null for a body label such as 'team2_atk1'. */
export function teamOf(label) {
  if (typeof label !== 'string') return null
  if (label.startsWith('team1_')) return 'team1'
  if (label.startsWith('team2_')) return 'team2'
  return null
}

export function isGoalkeeper(capId) {
  return typeof capId === 'string' && capId.endsWith('_gk')
}

/** Direction of a team's OWN goal: -1 = left goal, +1 = right goal. */
export function teamHomeDir(team, team1Side = 'left') {
  const team1Dir = team1Side === 'right' ? 1 : -1
  return team === 'team1' ? team1Dir : -team1Dir
}

/** Which team a ball at (x, y) has scored for, ignoring any rule violations. */
export function scorerForBall(x, y, team1Side = 'left') {
  if (Math.abs(y) >= PITCH.goalWidth / 2) return null
  let goalDir = 0
  if (x < -PITCH.halfW) goalDir = -1
  else if (x > PITCH.halfW) goalDir = 1
  if (!goalDir) return null
  // The goal belongs to the team whose home dir matches — the OTHER team scores.
  return teamHomeDir('team1', team1Side) === goalDir ? 'team2' : 'team1'
}

/**
 * Decide what a ball crossing a goal line means.
 *
 * - The flick straight from a kick-off can't score (kickoffGuard).
 * - A goalkeeper can't score for their own team, but an own goal off a
 *   goalkeeper still counts for the opponent.
 *
 * Returns { outcome: 'goal' | 'kickoff_violation' | 'gk_violation', scorer }
 * or null when the ball isn't in a goal.
 */
export function judgeGoal({ x, y, team1Side, kickoffGuard, lastFlickedCapId }) {
  const scorer = scorerForBall(x, y, team1Side)
  if (!scorer) return null
  if (kickoffGuard) return { outcome: 'kickoff_violation', scorer }
  if (isGoalkeeper(lastFlickedCapId) && teamOf(lastFlickedCapId) === scorer) {
    return { outcome: 'gk_violation', scorer }
  }
  return { outcome: 'goal', scorer }
}

/**
 * Classify the first thing the flicked cap touched.
 * 'ball' = legal, 'teammate' = wasted turn, 'foul' = opponent hit first,
 * 'wall' = cushion (doesn't count — the next contact decides).
 */
export function classifyContact(flickedCapId, otherLabel) {
  if (otherLabel === 'ball') return 'ball'
  const otherT = teamOf(otherLabel)
  if (!otherT) return 'wall'
  return otherT === teamOf(flickedCapId) ? 'teammate' : 'foul'
}

/** Is (x, y) inside the penalty area of the goal at homeDir (-1 left / +1 right)? */
export function isInPenaltyArea(x, y, homeDir) {
  if (Math.abs(y) >= PITCH.penAreaH / 2) return false
  return homeDir === -1
    ? x < -PITCH.halfW + PITCH.penAreaW
    : x > PITCH.halfW - PITCH.penAreaW
}

/**
 * Penalty shootout state after any number of kicks.
 * Best of SHOOTOUT_ROUNDS, stops early once one side can't catch up, then
 * sudden death (equal kicks, different score) if still level.
 *
 * @param {{team1:number, team2:number}} kicks  kicks taken per team
 * @param {{team1:number, team2:number}} goals  goals scored per team
 * @returns {{decided:boolean, winner:'team1'|'team2'|null, suddenDeath:boolean}}
 */
export function shootoutStatus(kicks, goals) {
  const target = Math.max(SHOOTOUT_ROUNDS, kicks.team1, kicks.team2)
  const rem1 = target - kicks.team1
  const rem2 = target - kicks.team2
  const suddenDeath = Math.min(kicks.team1, kicks.team2) >= SHOOTOUT_ROUNDS
  if (goals.team1 > goals.team2 + rem2) return { decided: true, winner: 'team1', suddenDeath }
  if (goals.team2 > goals.team1 + rem1) return { decided: true, winner: 'team2', suddenDeath }
  return { decided: false, winner: null, suddenDeath }
}

/** Whose turn it is in a shootout: team1 shoots first each round. */
export function nextShooter(kicks) {
  return kicks.team1 > kicks.team2 ? 'team2' : 'team1'
}

/** Winner of a finished match on goals, or null for a draw. */
export function matchWinner(score) {
  if (score.team1 > score.team2) return 'team1'
  if (score.team2 > score.team1) return 'team2'
  return null
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
