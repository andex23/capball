/**
 * Online protocol — message shapes and validation.
 *
 * The host is the only authority. A guest can ask for a small set of things
 * (edit its own team, pick its own formation, ready up, select/flick one of
 * its own caps on its own turn, pause) and every request is checked here
 * before the host acts on it. Anything else is dropped.
 */

import { BADGES, PATTERNS, FINISHES, CAP_ROLES, TEAM_NAME_MAX } from '../data/TeamOptions'
import { FORMATIONS } from '../data/TeamData'
import { teamOf } from '../game/rules'

export const GUEST_TEAM = 'team2'
export const HOST_TEAM = 'team1'

/** Store keys the host mirrors to the guest. */
export const SYNC_KEYS = [
  'screen', 'matchKey', 'score', 'stats', 'activeTeam', 'phase', 'timeRemaining', 'half',
  'teamConfig', 'formations', 'stadium', 'team1Side', 'chosenTeam1Side', 'matchDuration',
  'foulData', 'penaltyShootout', 'penaltyScores', 'penaltyKicks', 'matchResult',
  'selectedCapId', 'freeKickCapId', 'paused', 'ballColor', 'lastScorer', 'noGoalReason',
  'kickoffGuard',
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const keysOf = (list) => new Set(list.map((o) => o.key))
const BADGE_KEYS = keysOf(BADGES)
const PATTERN_KEYS = keysOf(PATTERNS)
const FINISH_KEYS = keysOf(FINISHES)

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function sanitizeName(name) {
  if (typeof name !== 'string') return null
  // Strip control characters, collapse whitespace, cap the length
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, TEAM_NAME_MAX)
  return clean || null
}

/** Keep only well-formed fields from a team config update. */
export function sanitizeTeamConfig(input) {
  if (!isObj(input)) return {}
  const out = {}
  const name = sanitizeName(input.name)
  if (name) out.name = name
  if (typeof input.primary === 'string' && HEX_COLOR.test(input.primary)) out.primary = input.primary
  if (typeof input.edge === 'string' && HEX_COLOR.test(input.edge)) out.edge = input.edge
  if (BADGE_KEYS.has(input.badge)) out.badge = input.badge
  if (PATTERN_KEYS.has(input.pattern)) out.pattern = input.pattern
  if (FINISH_KEYS.has(input.finish)) out.finish = input.finish
  if (isObj(input.numbers)) {
    const numbers = {}
    for (const role of CAP_ROLES) {
      const n = input.numbers[role]
      if (Number.isInteger(n) && n >= 0 && n <= 99) numbers[role] = n
    }
    if (Object.keys(numbers).length) out.numbers = numbers
  }
  return out
}

/**
 * Validate a message from the guest against the host's current state.
 * Returns a normalised action for the host to apply, or null to drop it.
 */
export function validateGuestMessage(msg, state) {
  if (!isObj(msg) || typeof msg.type !== 'string') return null
  const data = isObj(msg.data) ? msg.data : {}

  switch (msg.type) {
    case 'teamConfig': {
      if (state.screen !== 'TEAM_SELECT') return null
      const config = sanitizeTeamConfig(data.config)
      return Object.keys(config).length ? { type: 'teamConfig', config } : null
    }
    case 'formation':
      if (state.screen !== 'FORMATION') return null
      return Object.hasOwn(FORMATIONS, data.key) ? { type: 'formation', key: data.key } : null
    case 'ready':
      return { type: 'ready', ready: data.ready === true }
    case 'pause':
      if (state.screen !== 'PLAYING') return null
      return { type: 'pause', paused: data.paused === true }
    case 'select':
      if (!['SELECT', 'AIM'].includes(state.phase) || state.paused) return null
      if (state.activeTeam !== GUEST_TEAM || teamOf(data.capId) !== GUEST_TEAM) return null
      if (!CAP_ROLES.includes(data.capId.slice(GUEST_TEAM.length + 1))) return null
      if (state.freeKickCapId && data.capId !== state.freeKickCapId) return null
      return { type: 'select', capId: data.capId }
    case 'cancel':
      return state.phase === 'AIM' && state.activeTeam === GUEST_TEAM ? { type: 'cancel' } : null
    case 'flick': {
      // Turn/phase/cap checks happen again in flickError() when it's applied.
      if (teamOf(data.capId) !== GUEST_TEAM) return null
      if (!CAP_ROLES.includes(data.capId.slice(GUEST_TEAM.length + 1))) return null
      const v = data.velocity
      if (!isObj(v) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null
      return { type: 'flick', capId: data.capId, velocity: { x: v.x, y: v.y } }
    }
    default:
      return null
  }
}

/** Host-side snapshot of the synced store keys. */
export function pickSynced(state) {
  const snap = {}
  for (const key of SYNC_KEYS) snap[key] = state[key]
  return snap
}

/** Guest-side: only accept known keys from a host snapshot. */
export function filterSynced(snap) {
  if (!isObj(snap)) return {}
  const out = {}
  for (const key of SYNC_KEYS) if (snap[key] !== undefined) out[key] = snap[key]
  return out
}
