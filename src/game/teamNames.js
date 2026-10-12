/**
 * Team names follow the players: your side carries your username, the
 * computer's side says CPU, and in an online match the other side carries
 * theirs (their phone names its own team). A name the player typed themselves
 * is never touched.
 */
import { TEAM_NAME_MAX } from '../data/TeamOptions.js'

export const DEFAULT_NAMES = { team1: 'Team 1', team2: 'Team 2' }
const AUTO = ['Team 1', 'Team 2', 'CPU', 'You']

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, TEAM_NAME_MAX) : '')

/** Did the player type this name? (Older saves without the flag: anything but an automatic name counts.) */
export function isCustomName(config, username = '') {
  if (config?.customName === true) return true
  if (config?.customName === false) return false
  const name = config?.name
  return !!name && !AUTO.includes(name) && name !== clean(username)
}

/**
 * Names to set for this match, as { team1?: { name }, team2?: { name } }: only
 * teams with an automatic name, and only where it would change.
 */
export function autoTeamNames({ gameMode, aiTeam = 'team2', onlineMyTeam, teamConfig, username }) {
  const me = clean(username)
  const want = {}
  if (gameMode === 'ai') {
    const human = aiTeam === 'team1' ? 'team2' : 'team1'
    want[human] = me || DEFAULT_NAMES[human]
    want[aiTeam] = 'CPU'
  } else if (gameMode === 'online') {
    if (onlineMyTeam) want[onlineMyTeam] = me || DEFAULT_NAMES[onlineMyTeam]
  } else {
    want.team1 = DEFAULT_NAMES.team1
    want.team2 = DEFAULT_NAMES.team2
  }
  const out = {}
  for (const [team, name] of Object.entries(want)) {
    const cfg = teamConfig?.[team]
    if (!cfg || isCustomName(cfg, username) || cfg.name === name) continue
    out[team] = { name }
  }
  return out
}
