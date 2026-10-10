/**
 * What this device can do about a fixture in an online tournament.
 * Pure: takes the tournament and the server snapshot (seats, rooms).
 *
 * Returns one of
 *   { kind: 'play' }               both sides are on this phone, or it's us v the CPU
 *   { kind: 'host' }               we're at home to another phone: open a match room
 *   { kind: 'join', roomCode }     we're away and the home side has a room open
 *   { kind: 'wait', reason, team } nothing to do yet ('open-seat' | 'home-to-start')
 *   null                           not our fixture (or already played)
 */

import { teamById, leagueMatchday } from './tournament'

export function myTeamIds(snapshot) {
  return (snapshot?.seats || []).filter((s) => s.mine).map((s) => s.teamId)
}

export function fixtureAction(t, snapshot, f) {
  if (!t || !f || f.result || f.winner || !f.home || !f.away) return null
  if (t.format === 'league' && f.round !== leagueMatchday(t)) return null
  const mine = new Set(myTeamIds(snapshot))
  const homeMine = mine.has(f.home)
  const awayMine = mine.has(f.away)
  if (!homeMine && !awayMine) return null
  if (t.playMode === 'anytime') return { kind: 'anytime' }
  if (homeMine && awayMine) return { kind: 'play' }

  const otherId = homeMine ? f.away : f.home
  const other = teamById(t, otherId)
  if (!other) return null
  if (other.cpu) return { kind: 'play' }

  const seat = (snapshot?.seats || []).find((s) => s.teamId === otherId)
  if (!seat?.claimed) return { kind: 'wait', reason: 'open-seat', team: other }

  if (homeMine) return { kind: 'host' }
  const room = (snapshot?.rooms || []).find((r) => r.fixtureId === f.id && r.roomCode)
  if (room) return { kind: 'join', roomCode: room.roomCode }
  return { kind: 'wait', reason: 'home-to-start', team: teamById(t, f.home) }
}

/** Short line for a 'wait' action. */
export function waitText(action) {
  if (action?.kind !== 'wait') return ''
  const name = action.team?.name || 'the other team'
  return action.reason === 'open-seat'
    ? `Waiting for someone to take ${name}`
    : `Waiting for ${name} to start the match`
}
