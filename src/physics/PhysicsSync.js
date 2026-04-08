import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { stepPhysics, getBodies, allBodiesSettled, clampAllBodies, stopBall, resetBallToCenter, setupPenalty } from './PhysicsWorld'
import { checkGoal, incrementTurnCount } from './GoalDetector'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { PHYSICS } from '../data/TeamData'
import { playGoal, playTurnChange } from '../audio/SoundManager'

// Phases where physics engine should step
const PHYSICS_ACTIVE = [PHASE.FLICK, PHASE.RESOLVE]

export function usePhysicsSync(meshRefs) {
  const settledTimer = useRef(0)
  const goalScored = useRef(false)

  const phase = useMatchStore((s) => s.phase)
  const switchTurn = useMatchStore((s) => s.switchTurn)
  const scoreGoal = useMatchStore((s) => s.scoreGoal)
  const tickTimer = useMatchStore((s) => s.tickTimer)
  const paused = useMatchStore((s) => s.paused)

  useFrame((_, delta) => {
    if (paused) return

    tickTimer(delta)

    const shouldStep = PHYSICS_ACTIVE.includes(phase)
    const subSteps = PHYSICS.subSteps || 10
    const totalDt = Math.min(delta * 1000, 16.667)
    const stepDt = totalDt / subSteps

    if (shouldStep) {
      for (let i = 0; i < subSteps; i++) {
        stepPhysics(stepDt)
      }
      clampAllBodies()
    }

    // Sync 2D physics → 3D meshes
    const bodies = getBodies()
    for (const [id, body] of Object.entries(bodies)) {
      const mesh = meshRefs.current[id]
      if (!mesh || !body) continue
      mesh.position.x = body.position.x
      mesh.position.z = body.position.y
    }

    // ── RESOLVE: check goals + settle ──
    if (phase === PHASE.RESOLVE) {
      const ballBody = bodies.ball
      if (ballBody && !goalScored.current) {
        const scorer = checkGoal(ballBody)
        if (scorer === 'gk_violation' || scorer === 'kickoff_violation') {
          // Invalid goal — reset ball to center, give possession to other team
          goalScored.current = true
          resetBallToCenter()
          // Switch turn so the other team gets the ball
          setTimeout(() => {
            playTurnChange()
            switchTurn()
          }, 500)
          return
        }
        if (scorer) {
          goalScored.current = true
          stopBall()
          playGoal()
          const store = useMatchStore.getState()
          if (store.penaltyShootout) {
            // Penalty shootout — record goal and setup next penalty
            setTimeout(() => {
              store.penaltyAttemptResult(true)
              // Setup next penalty after state updates
              setTimeout(() => {
                const s = useMatchStore.getState()
                if (s.phase === PHASE.SELECT || s.phase === PHASE.KICKOFF) {
                  setupPenalty(s.activeTeam)
                  useMatchStore.setState({ freeKickCapId: `${s.activeTeam}_atk1` })
                }
              }, 500)
            }, 1000)
          } else {
            scoreGoal(scorer)
          }
          return
        }
      }

      if (allBodiesSettled()) {
        settledTimer.current += totalDt
        if (settledTimer.current >= PHYSICS.settleTime) {
          settledTimer.current = 0
          const store = useMatchStore.getState()
          if (store.penaltyShootout) {
            // No goal — missed penalty
            setTimeout(() => {
              store.penaltyAttemptResult(false)
              setTimeout(() => {
                const s = useMatchStore.getState()
                if (s.phase === PHASE.SELECT || s.phase === PHASE.KICKOFF) {
                  setupPenalty(s.activeTeam)
                  useMatchStore.setState({ freeKickCapId: `${s.activeTeam}_atk1` })
                }
              }, 500)
            }, 500)
          } else {
            incrementTurnCount()
            playTurnChange()
            switchTurn()
          }
        }
      } else {
        settledTimer.current = 0
      }
    } else {
      settledTimer.current = 0
      goalScored.current = false
    }
  })
}
