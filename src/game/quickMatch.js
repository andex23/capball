import { DIVISIONS } from './divisions'
import { similarColours } from './kitClash'
import { TEAMS } from '../data/TeamData'
import { autoTeamNames, DEFAULT_NAMES } from './teamNames'
import { DEFAULT_TEAM_CONFIG } from '../state/MatchStore'

export const QUICK_CLUBS = DIVISIONS.flatMap((division) => division.clubs)

export function personalTeams(state, username) {
  const names = autoTeamNames({ ...state, username })
  return Object.fromEntries(Object.entries(state.teamConfig).map(([side, kit]) => {
    const name = names[side]?.name || kit.name
    return [side, { art: '', bands: {}, players: {}, showName: true, capNames: 'player', ...kit, name: !kit.customName && name === DEFAULT_NAMES[side] ? TEAMS[side].name : name }]
  }))
}

export function quickClubKit(club, side) {
  return { ...DEFAULT_TEAM_CONFIG[side], art: '', bands: {}, players: {}, showName: true, capNames: 'player', finish: 'gloss', ...club, customName: true }
}

/** Keep the draw stable while someone is choosing, and avoid identical or matching-colour opponents. */
export function quickOpponent(own, draw) {
  const pool = QUICK_CLUBS.filter((club) => club.name !== own.name && !similarColours(club.primary, own.primary))
  return pool[Math.floor(draw * pool.length)]
}
