import { useEffect, useRef } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { getBodies } from '../physics/PhysicsWorld'
import { performFlick } from '../game/flick'
import { CAP_RADIUS, GK_RADIUS, BALL_RADIUS, PHYSICS, PITCH } from '../data/TeamData'
import { makeContext, readPositions, firstHit, chooseHeuristic, chooseBySimulation } from './planner'

/**
 * SMART AI CONTROLLER
 *
 * Difficulty levels:
 * - easy:   the classic role-based aim (noisy, weak), and only sometimes
 *           notices that its path runs through an opponent (foul).
 * - medium: geometric planner (src/ai/planner.js) — never picks a path that
 *           touches an opponent before the ball, prefers shots toward goal,
 *           clears the ball or blocks when it's close to our own goal.
 * - hard:   plays candidate flicks forward in a private physics world and
 *           keeps the one with the best outcome (goal, no foul, territory,
 *           what the opponent is left with).
 */

export const DIFFICULTY = {
  easy:   { thinkDelay: 1200, aimDelay: 600, aimNoise: 0.6, powerMult: 0.5, passChance: 0.1, foulCheck: 0.5 },
  medium: { thinkDelay: 800,  aimDelay: 400, aimNoise: 0.2, powerMult: 0.75, planner: 'heuristic' },
  hard:   { thinkDelay: 500,  aimDelay: 250, aimNoise: 0.03, powerMult: 1, planner: 'simulate', budgetMs: 70 },
}

export function useAIController() {
  const phase = useMatchStore((s) => s.phase)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const gameMode = useMatchStore((s) => s.gameMode)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const paused = useMatchStore((s) => s.paused)
  const aimTimer = useRef(null)

  // Never let a pending shot outlive the match
  useEffect(() => () => clearTimeout(aimTimer.current), [])

  // Pausing mid-aim puts the cap down; the AI picks again after unpausing
  useEffect(() => {
    if (!paused || !aimTimer.current) return
    clearTimeout(aimTimer.current)
    aimTimer.current = null
    const s = useMatchStore.getState()
    if (s.phase === PHASE.AIM && s.activeTeam === s.aiTeam) s.cancelAim()
  }, [paused])

  useEffect(() => {
    if (gameMode !== 'ai' || activeTeam !== aiTeam || phase !== PHASE.SELECT || paused) return

    const level = DIFFICULTY[useMatchStore.getState().aiDifficulty] ? useMatchStore.getState().aiDifficulty : 'medium'
    const diff = DIFFICULTY[level]

    const thinkTimer = setTimeout(() => {
      const state = useMatchStore.getState()
      const decision = computeSmartDecision(aiTeam, level, state.freeKickCapId)
      if (!decision) {
        // Nothing sensible to do — pass the turn rather than stall the match
        state.switchTurn()
        return
      }
      state.selectCap(decision.capId)
      aimTimer.current = setTimeout(() => {
        aimTimer.current = null
        const s = useMatchStore.getState()
        if (s.phase !== PHASE.AIM || s.activeTeam !== aiTeam) return
        if (performFlick(decision.capId, decision.velocity) !== null) s.switchTurn()
      }, diff.aimDelay)
    }, diff.thinkDelay)

    return () => clearTimeout(thinkTimer)
  }, [phase, activeTeam, gameMode, aiTeam, paused])
}

/**
 * Pick the AI's flick for this turn: { capId, velocity } or null.
 * requiredCapId (free kick / penalty taker) is the only cap that may play.
 */
export function computeSmartDecision(aiTeam, level = 'medium', requiredCapId = null, rng = Math.random) {
  const diff = DIFFICULTY[level] || DIFFICULTY.medium
  const bodies = getBodies()
  if (!bodies.ball) return null
  const state = useMatchStore.getState()

  if (diff.planner) {
    const ctx = makeContext({
      positions: readPositions(bodies),
      team: aiTeam,
      team1Side: state.team1Side || 'left',
      kickoffGuard: !!state.kickoffGuard,
      penaltyShootout: !!state.penaltyShootout,
      requiredCapId,
    })
    const pick = diff.planner === 'simulate'
      ? chooseBySimulation(ctx, { budgetMs: diff.budgetMs, aimNoise: diff.aimNoise, rng })
      : chooseHeuristic(ctx, { aimNoise: diff.aimNoise, powerMult: diff.powerMult, rng })
    if (pick) return { capId: pick.capId, velocity: pick.velocity, kind: pick.kind }
    // Nothing clean on offer (e.g. ball jammed on a cushion) — fall back to the classic aim
  }

  // Easy (and fallback): classic aim, sometimes re-thinking a shot that would foul
  const checkFouls = rng() < (diff.foulCheck ?? 1)
  const positions = readPositions(bodies)
  const excluded = []
  const tried = []
  for (let tries = 0; tries < 5; tries++) {
    const d = classicDecision(aiTeam, diff, requiredCapId, bodies, state, excluded, rng)
    if (!d) break
    if (!checkFouls || requiredCapId) return d
    const hit = firstHit(positions, d.capId, d.velocity)
    // Easy only dodges the obvious foul; medium/hard insist on reaching the ball first
    if (diff.planner ? hit?.id === 'ball' : hit?.kind !== 'foul') return d
    tried.push({ d, hit })
    excluded.push(d.capId)
  }
  if (!diff.planner) return tried[0]?.d ?? null
  // Medium/hard: a harmless miskick off a teammate shakes up a scrum; failing
  // that, let the turn go rather than hand over a free kick
  return tried.find((t) => t.hit?.kind !== 'foul')?.d ?? null
}

function classicDecision(aiTeam, diff, requiredCapId, bodies, state, excluded, rng) {
  const bx = bodies.ball.position.x
  const by = bodies.ball.position.y

  // Determine goal direction based on side selection
  let goalX
  const side = state.team1Side || 'left'
  if (side === 'left') {
    goalX = aiTeam === 'team1' ? PITCH.halfW : -PITCH.halfW
  } else {
    goalX = aiTeam === 'team1' ? -PITCH.halfW : PITCH.halfW
  }

  // If a specific cap is required (free kick/penalty), use it
  if (requiredCapId) {
    const body = bodies[requiredCapId]
    if (!body) return null
    return aimAtGoal(requiredCapId, body, bx, by, goalX, diff, rng)
  }

  // Get all caps with roles
  const caps = [
    { id: `${aiTeam}_atk1`, role: 'attacker', priority: 3 },
    { id: `${aiTeam}_atk2`, role: 'attacker', priority: 3 },
    { id: `${aiTeam}_def1`, role: 'defender', priority: 1 },
    { id: `${aiTeam}_def2`, role: 'defender', priority: 1 },
    { id: `${aiTeam}_gk`,   role: 'goalkeeper', priority: -5 },
  ]

  let bestCap = null
  let bestScore = -Infinity

  for (const cap of caps) {
    const body = bodies[cap.id]
    if (!body || excluded.includes(cap.id)) continue

    const cx = body.position.x
    const cy = body.position.y

    const distToBall = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2)

    // Direction from cap to ball
    const dirX = bx - cx
    const dirY = by - cy
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
    if (dirLen < 0.1) continue
    const nx = dirX / dirLen
    const ny = dirY / dirLen

    // How well does cap→ball→goal line up?
    const ballToGoalX = goalX - bx
    const ballToGoalY = 0 - by
    const btgLen = Math.sqrt(ballToGoalX ** 2 + ballToGoalY ** 2)
    const gnx = btgLen > 0.1 ? ballToGoalX / btgLen : Math.sign(goalX)
    const gny = btgLen > 0.1 ? ballToGoalY / btgLen : 0
    const alignment = nx * gnx + ny * gny // -1 to +1

    // Score based on role
    let score = 0
    score += alignment * 5                    // alignment to goal
    score -= distToBall * 0.8                 // prefer closer caps
    score += cap.priority                     // role priority
    score += (rng() - 0.5) * 2       // slight randomness

    // Bonus: if cap is between ball and opponent goal (good shooting position)
    const capBehindBall = Math.sign(goalX - cx) === Math.sign(goalX - bx) && Math.abs(cx - bx) < Math.abs(goalX - bx)
    if (capBehindBall && cap.role === 'attacker') score += 3

    if (score > bestScore) {
      bestScore = score
      bestCap = { id: cap.id, body, nx, ny, distToBall, role: cap.role }
    }
  }

  if (!bestCap) return null

  // Decide strategy: shoot at goal or pass to teammate
  const shouldPass = bestCap.role === 'defender' && rng() < diff.passChance

  if (shouldPass) {
    return passToTeammate(bestCap, aiTeam, bodies, diff, rng)
  }

  return aimAtGoal(bestCap.id, bestCap.body, bx, by, goalX, diff, rng)
}

function aimAtGoal(capId, capBody, bx, by, goalX, diff, rng) {
  const cx = capBody.position.x
  const cy = capBody.position.y

  // Aim at the point on the ball that sends it toward the goal. If the cap is
  // on the wrong side of the ball for that, just hit the ball centre.
  let tx = bx
  let ty = by
  const gx = goalX - bx
  const gy = -by
  const gLen = Math.hypot(gx, gy)
  if (gLen > 0.1) {
    const reach = (capId.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS) + BALL_RADIUS
    const px = bx - (gx / gLen) * reach * 0.9
    const py = by - (gy / gLen) * reach * 0.9
    const capToBall = Math.hypot(bx - cx, by - cy)
    const capToContact = Math.hypot(px - cx, py - cy)
    if (capToContact < capToBall) { tx = px; ty = py }
  }

  const dirX = tx - cx
  const dirY = ty - cy
  const dirLen = Math.hypot(dirX, dirY)
  if (dirLen < 0.1) return null

  const nx = dirX / dirLen
  const ny = dirY / dirLen

  // Add aim noise based on difficulty
  const noise = (rng() - 0.5) * diff.aimNoise
  const cos = Math.cos(noise)
  const sin = Math.sin(noise)
  const aimX = nx * cos - ny * sin
  const aimY = nx * sin + ny * cos

  // Power based on distance and difficulty
  const power = Math.min(dirLen * 0.5 + 1.2, PHYSICS.maxFlickVelocity * diff.powerMult)

  return { capId, velocity: { x: aimX * power, y: aimY * power } }
}

function passToTeammate(bestCap, aiTeam, bodies, diff, rng) {
  // Find the closest attacker teammate to pass to
  const attackers = [`${aiTeam}_atk1`, `${aiTeam}_atk2`]
  let bestTarget = null
  let bestDist = Infinity

  for (const id of attackers) {
    if (id === bestCap.id) continue
    const body = bodies[id]
    if (!body) continue
    const dx = body.position.x - bestCap.body.position.x
    const dy = body.position.y - bestCap.body.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      bestDist = dist
      bestTarget = { id, body, dx, dy, dist }
    }
  }

  if (!bestTarget || bestDist < 2) {
    // No good pass target, just shoot at ball
    const ball = bodies.ball
    return aimAtGoal(bestCap.id, bestCap.body, ball.position.x, ball.position.y, 0, diff, rng)
  }

  // Aim at teammate
  const nx = bestTarget.dx / bestTarget.dist
  const ny = bestTarget.dy / bestTarget.dist

  const noise = (rng() - 0.5) * diff.aimNoise * 1.5
  const cos = Math.cos(noise)
  const sin = Math.sin(noise)
  const aimX = nx * cos - ny * sin
  const aimY = nx * sin + ny * cos

  const power = Math.min(bestTarget.dist * 0.4 + 0.8, PHYSICS.maxFlickVelocity * diff.powerMult * 0.7)

  return { capId: bestCap.id, velocity: { x: aimX * power, y: aimY * power } }
}
