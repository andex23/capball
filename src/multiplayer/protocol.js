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
  'kickoffGuard', 'shotClock', 'shotClockRemaining',
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
    case 'ready': {
      const ready = data.ready === true
      // On the full-time screen "ready" means "I want this": a rematch or penalties
      if (ready && state.screen === 'MATCH_END') {
        const choice = END_CHOICES.includes(data.choice) ? data.choice : null
        if (!choice || (choice === 'penalties' && !canChoosePenalties(state.matchResult))) return null
        return { type: 'ready', ready, choice }
      }
      return { type: 'ready', ready }
    }
    case 'bye':
      return { type: 'bye' }
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

/* ── Rematch / penalties after full time (online) ── */

/** What a player can ask for on the full-time screen. */
export const END_CHOICES = ['rematch', 'penalties']

/** Penalties are only on offer after a drawn match that didn't already have a shootout. */
export function canChoosePenalties(matchResult) {
  return !!matchResult?.isDraw && !matchResult.penaltyScore
}

/** Guest-side: the host's ready message → the value stored in onlineReady. */
export function readyValue(data) {
  if (!isObj(data) || data.ready !== true) return false
  return END_CHOICES.includes(data.choice) ? data.choice : true
}

/**
 * Both players agree? `ready` is onlineReady: { team1, team2 } with values
 * false | true | 'rematch' | 'penalties'. Returns 'rematch', 'penalties' or null.
 */
export function endChoiceOutcome(ready, matchResult) {
  const a = ready?.team1
  const b = ready?.team2
  if (!END_CHOICES.includes(a) || a !== b) return null
  if (a === 'penalties' && !canChoosePenalties(matchResult)) return null
  return a
}

/* ── Joining / rejoining a room ── */

/** Random per-room secret the host gives its guest; a rejoining guest must present it. */
export const SESSION_TOKEN = /^[0-9a-f]{32}$/

export function makeSessionToken(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Host-side: may this incoming connection join? `metadata` is what the guest
 * sent with its connection; `room` is { token, bound, busy }:
 *   bound — a guest has already joined this room (it's theirs now)
 *   busy  — a connection is currently open or opening
 * A fresh lobby takes the first guest with no token. After that only the
 * guest holding the room's token gets in (it replaces its own stale link).
 */
export function validateJoin(metadata, room) {
  const token = isObj(metadata) && typeof metadata.token === 'string' && SESSION_TOKEN.test(metadata.token) ? metadata.token : null
  if (room?.bound) {
    if (token && typeof room.token === 'string' && token === room.token) return { ok: true, rejoin: true }
    return { ok: false, reason: 'room-in-use' }
  }
  if (room?.busy) return { ok: false, reason: 'room-in-use' }
  return { ok: true, rejoin: false }
}
