import { useMatchStore, INPUT_PHASES } from '../state/MatchStore'
import { PHYSICS, PITCH } from '../data/TeamData'
import { flickScale } from './squad'
import { applyFlick, getBody, diveKeeper, radiusOf } from '../physics/PhysicsWorld'
import { strikeDirection, crossingY, cpuDive } from './penalty'
import { playDive } from '../audio/SoundManager'
import { teamOf, isGoalkeeper, keeperCanPlay, teamHomeDir } from './rules'

/**
 * Why a flick isn't allowed right now, or null if it is.
 * Every flick — mouse, AI or an online guest's message — goes through this.
 *
 * @param state   match store state
 * @param capId   cap being flicked
 * @param velocity {x, y}
 * @param byTeam  team the request comes from (null = trusted local input)
 * @param ball    ball position {x, y} (physics coords); enables the keeper-range rule
 */
export function flickError(state, { capId, velocity, byTeam = null, ball = null }) {
  if (state.paused) return 'paused'
  if (!INPUT_PHASES.includes(state.phase)) return 'wrong-phase'
  const team = teamOf(capId)
  if (!team || team !== state.activeTeam) return 'not-your-cap'
  if (byTeam && byTeam !== state.activeTeam) return 'not-your-turn'
  if (state.freeKickCapId && capId !== state.freeKickCapId) return 'set-piece-taker-only'
  // Keepers only come out for the ball near their own box (a set-piece taker always may)
  if (isGoalkeeper(capId) && capId !== state.freeKickCapId && ball
    && !keeperCanPlay(ball.x, ball.y, teamHomeDir(team, state.team1Side || 'left'))) return 'keeper-out-of-range'
  if (!velocity || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) return 'bad-velocity'
  if (velocity.x === 0 && velocity.y === 0) return 'bad-velocity'
  return null
}

/** How hard this cap flicks compared with an average player: 1 unless the team has ratings. */
export function flickScaleFor(state, capId) {
  const i = capId.indexOf('_')
  const team = capId.slice(0, i)
  const role = capId.slice(i + 1)
  return flickScale(state.teamConfig?.[team]?.ratings?.[role])
}

/** Validate and apply a flick. Returns null on success or the reason it was refused. */
export function performFlick(capId, velocity, byTeam = null) {
  const state = useMatchStore.getState()
  const err = flickError(state, { capId, velocity, byTeam, ball: getBody('ball')?.position || null })
  if (err) return err
  if (!getBody(capId)) return 'no-body'
  // A better player flicks harder (career squads); scale the power and its cap together
  const scale = flickScaleFor(state, capId)
  applyFlick(capId, { x: velocity.x * scale, y: velocity.y * scale }, PHYSICS.maxFlickVelocity * scale) // clamps to max power
  if (state.penaltyKick) keeperDives(state, capId, velocity)
  state.commitFlick(capId)
  return null
}

/**
 * Penalty: the keeper throws himself the instant the kick is taken (the ball
 * reaches him in a blink). A player's keeper goes where they picked; the
 * computer's reads the kicker's strike and guesses right as often as its level allows.
 */
function keeperDives(state, capId, velocity) {
  const keeperTeam = teamOf(capId) === 'team1' ? 'team2' : 'team1'
  let dive = state.keeperDive
  if (dive === 'auto') {
    const cap = getBody(capId)?.position
    const ball = getBody('ball')?.position
    const dir = cap && ball ? strikeDirection(cap, velocity, ball, radiusOf(capId) + radiusOf('ball')) : null
    const goalX = teamHomeDir(keeperTeam, state.team1Side || 'left') * PITCH.halfW
    const yAt = dir && ball ? crossingY(ball.x, ball.y, dir.x, dir.y, goalX) : null
    dive = cpuDive(yAt, state.aiDifficulty)
  }
  diveKeeper(keeperTeam, typeof dive === 'number' ? dive : 0)
  if (dive) playDive()
}

/** Can this cap be picked up right now, as far as the keeper-range rule goes? */
export function capSelectable(state, capId, ball) {
  if (!isGoalkeeper(capId) || capId === state.freeKickCapId || !ball) return true
  return keeperCanPlay(ball.x, ball.y, teamHomeDir(teamOf(capId), state.team1Side || 'left'))
}

/** Teams this client may control with the mouse/touch. */
export function controllableTeams(state) {
  if (state.challenge) return ['team1']
  if (state.gameMode === 'online') return state.onlineMyTeam ? [state.onlineMyTeam] : []
  if (state.gameMode === 'ai') return [state.aiTeam === 'team1' ? 'team2' : 'team1']
  return ['team1', 'team2']
}

/* ── Drag → power ──
   Power comes from how far the finger (or mouse) is pulled back on the
   SCREEN, not across the pitch, so it feels the same at any zoom and on any
   screen. A curve keeps short pulls gentle; full power needs a long pull. */

/** Shorter pulls than this (px) are a cancelled aim, not a flick. */
export const MIN_FLICK_PX = 14
/** Curve: 1 = straight line; higher = more room for soft touches. */
export const FLICK_CURVE = 1

/** Pixels of pull that give full power on a screen of this size. */
export function fullPowerPixels(width, height) {
  const short = Math.min(width || 0, height || 0) || 400
  return Math.min(180, Math.max(90, short * 0.28))
}

/** 0..1 power for a pull of `px` pixels (0 below the cancel threshold). */
export function powerFraction(px, width, height) {
  if (!(px >= MIN_FLICK_PX)) return 0
  const t = Math.min(1, (px - MIN_FLICK_PX) / (fullPowerPixels(width, height) - MIN_FLICK_PX))
  return Math.max(0.04, t ** FLICK_CURVE)
}

/** Launch speed (physics units) for a pull of `px` pixels. */
export function flickSpeedFor(px, width, height) {
  return powerFraction(px, width, height) * PHYSICS.maxFlickVelocity
}
