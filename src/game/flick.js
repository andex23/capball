import { useMatchStore, INPUT_PHASES } from '../state/MatchStore'
import { applyFlick, getBody } from '../physics/PhysicsWorld'
import { teamOf } from './rules'

/**
 * Why a flick isn't allowed right now, or null if it is.
 * Every flick — mouse, AI or an online guest's message — goes through this.
 *
 * @param state   match store state
 * @param capId   cap being flicked
 * @param velocity {x, y}
 * @param byTeam  team the request comes from (null = trusted local input)
 */
export function flickError(state, { capId, velocity, byTeam = null }) {
  if (state.paused) return 'paused'
  if (!INPUT_PHASES.includes(state.phase)) return 'wrong-phase'
  const team = teamOf(capId)
  if (!team || team !== state.activeTeam) return 'not-your-cap'
  if (byTeam && byTeam !== state.activeTeam) return 'not-your-turn'
  if (state.freeKickCapId && capId !== state.freeKickCapId) return 'set-piece-taker-only'
  if (!velocity || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) return 'bad-velocity'
  if (velocity.x === 0 && velocity.y === 0) return 'bad-velocity'
  return null
}

/** Validate and apply a flick. Returns null on success or the reason it was refused. */
export function performFlick(capId, velocity, byTeam = null) {
  const state = useMatchStore.getState()
  const err = flickError(state, { capId, velocity, byTeam })
  if (err) return err
  if (!getBody(capId)) return 'no-body'
  applyFlick(capId, velocity) // clamps to max power
  state.commitFlick(capId)
  return null
}

/** Teams this client may control with the mouse/touch. */
export function controllableTeams(state) {
  if (state.gameMode === 'online') return state.onlineMyTeam ? [state.onlineMyTeam] : []
  if (state.gameMode === 'ai') return [state.aiTeam === 'team1' ? 'team2' : 'team1']
  return ['team1', 'team2']
}
