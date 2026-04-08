import { useEffect, useRef } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { getBodies, applyFlick } from '../physics/PhysicsWorld'
import { CAP_RADIUS, GK_RADIUS, BALL_RADIUS, PHYSICS, PITCH } from '../data/TeamData'

/**
 * SMART AI CONTROLLER
 *
 * Difficulty levels: easy, medium, hard
 * Role-based: attackers shoot, defenders block, GK stays back
 * Strategies: direct shot, pass to teammate, defensive block
 */

const DIFFICULTY = {
  easy:   { thinkDelay: 1200, aimDelay: 600, aimNoise: 0.6, powerMult: 0.5, passChance: 0.1 },
  medium: { thinkDelay: 800,  aimDelay: 400, aimNoise: 0.3, powerMult: 0.65, passChance: 0.25 },
  hard:   { thinkDelay: 500,  aimDelay: 250, aimNoise: 0.12, powerMult: 0.8, passChance: 0.35 },
}

export function useAIController() {
  const phase = useMatchStore((s) => s.phase)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const gameMode = useMatchStore((s) => s.gameMode)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const selectCap = useMatchStore((s) => s.selectCap)
  const startResolve = useMatchStore((s) => s.startResolve)
  const freeKickCapId = useMatchStore((s) => s.freeKickCapId)
  const acting = useRef(false)

  useEffect(() => {
    if (gameMode !== 'ai') return
    if (activeTeam !== aiTeam) return
    if (phase !== PHASE.SELECT) return
    if (acting.current) return

    acting.current = true
    const diff = DIFFICULTY[useMatchStore.getState().aiDifficulty || 'medium']

    const thinkTimer = setTimeout(() => {
      const decision = computeSmartDecision(aiTeam, diff, freeKickCapId)
      if (!decision) { acting.current = false; return }

      selectCap(decision.capId)

      const aimTimer = setTimeout(() => {
        applyFlick(decision.capId, decision.velocity)
        useMatchStore.getState().setLastFlickedCap(decision.capId)
        startResolve()
        acting.current = false
      }, diff.aimDelay)

      return () => clearTimeout(aimTimer)
    }, diff.thinkDelay)

    return () => { clearTimeout(thinkTimer); acting.current = false }
  }, [phase, activeTeam, gameMode, aiTeam, selectCap, startResolve, freeKickCapId])
}

function computeSmartDecision(aiTeam, diff, requiredCapId) {
  const bodies = getBodies()
  const ball = bodies.ball
  if (!ball) return null

  const bx = ball.position.x
  const by = ball.position.y

  // Determine goal direction based on side selection
  let goalX
  const side = useMatchStore.getState().team1Side || 'left'
  if (side === 'left') {
    goalX = aiTeam === 'team1' ? PITCH.halfW : -PITCH.halfW
  } else {
    goalX = aiTeam === 'team1' ? -PITCH.halfW : PITCH.halfW
  }

  const opponentTeam = aiTeam === 'team1' ? 'team2' : 'team1'

  // If a specific cap is required (free kick/penalty), use it
  if (requiredCapId) {
    const body = bodies[requiredCapId]
    if (!body) return null
    return aimAtGoal(requiredCapId, body, bx, by, goalX, diff)
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
    if (!body) continue

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
    score += (Math.random() - 0.5) * 2       // slight randomness

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
  const shouldPass = bestCap.role === 'defender' && Math.random() < diff.passChance

  if (shouldPass) {
    return passToTeammate(bestCap, aiTeam, bodies, diff)
  }

  return aimAtGoal(bestCap.id, bestCap.body, bx, by, goalX, diff)
}

function aimAtGoal(capId, capBody, bx, by, goalX, diff) {
  const cx = capBody.position.x
  const cy = capBody.position.y

  // Aim at ball
  const dirX = bx - cx
  const dirY = by - cy
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
  if (dirLen < 0.1) return null

  const nx = dirX / dirLen
  const ny = dirY / dirLen

  // Add aim noise based on difficulty
  const noise = (Math.random() - 0.5) * diff.aimNoise
  const cos = Math.cos(noise)
  const sin = Math.sin(noise)
  const aimX = nx * cos - ny * sin
  const aimY = nx * sin + ny * cos

  // Power based on distance and difficulty
  const power = Math.min(dirLen * 0.5 + 1.2, PHYSICS.maxFlickVelocity * diff.powerMult)

  return { capId, velocity: { x: aimX * power, y: aimY * power } }
}

function passToTeammate(bestCap, aiTeam, bodies, diff) {
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
    return aimAtGoal(bestCap.id, bestCap.body, ball.position.x, ball.position.y, 0, diff)
  }

  // Aim at teammate
  const nx = bestTarget.dx / bestTarget.dist
  const ny = bestTarget.dy / bestTarget.dist

  const noise = (Math.random() - 0.5) * diff.aimNoise * 1.5
  const cos = Math.cos(noise)
  const sin = Math.sin(noise)
  const aimX = nx * cos - ny * sin
  const aimY = nx * sin + ny * cos

  const power = Math.min(bestTarget.dist * 0.4 + 0.8, PHYSICS.maxFlickVelocity * diff.powerMult * 0.7)

  return { capId: bestCap.id, velocity: { x: aimX * power, y: aimY * power } }
}
