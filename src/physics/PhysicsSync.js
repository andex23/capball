import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  stepPhysics, getBodies, allBodiesSettled, clampAllBodies, stopBall,
  stopAllBodies, placeBallAt, deOverlapBodies,
} from './PhysicsWorld'
import { checkGoal } from './GoalDetector'
import { useMatchStore, PHASE, isAuthority } from '../state/MatchStore'
import { PHYSICS } from '../data/TeamData'
import { playGoal, playTurnChange } from '../audio/SoundManager'

// A turn never waits longer than this for everything to stop rolling.
const MAX_RESOLVE_MS = 12000
// A long frame (tab in background, device hiccup) must not eat match time
const MAX_CLOCK_STEP_S = 0.1

export function usePhysicsSync(meshRefs) {
  const settledMs = useRef(0)
  const resolveMs = useRef(0)
  // Set once the current RESOLVE phase has an outcome, so it can't be decided twice
  const resolved = useRef(false)

  useFrame((_, delta) => {
    const store = useMatchStore.getState()
    const authority = isAuthority(store)
    const frameMs = Math.min(delta * 1000, 16.667)

    if (store.phase !== PHASE.RESOLVE) {
      resolved.current = false
      settledMs.current = 0
      resolveMs.current = 0
    }

    // Only the authority simulates; an online guest just mirrors host positions.
    if (authority && !store.paused) {
      store.tickTimer(Math.min(delta, MAX_CLOCK_STEP_S))
      if (useMatchStore.getState().phase === PHASE.RESOLVE) {
        const subSteps = PHYSICS.subSteps || 8
        for (let i = 0; i < subSteps; i++) stepPhysics(frameMs / subSteps)
        clampAllBodies()
      }
    }

    // Sync 2D physics → 3D meshes (guest smooths between network snapshots)
    const bodies = getBodies()
    const blend = authority ? 1 : Math.min(1, delta * 18)
    for (const [id, body] of Object.entries(bodies)) {
      const mesh = meshRefs.current[id]
      if (!mesh) continue
      mesh.position.x += (body.position.x - mesh.position.x) * blend
      mesh.position.z += (body.position.y - mesh.position.z) * blend
    }

    if (!authority || store.paused || resolved.current) return
    const s = useMatchStore.getState()
    if (s.phase !== PHASE.RESOLVE) return

    // ── Goal? ──
    const verdict = checkGoal(bodies.ball)
    if (verdict) {
      resolved.current = true
      if (s.penaltyShootout) {
        stopAllBodies()
        if (verdict.outcome === 'goal') playGoal()
        s.penaltyAttemptResult(verdict.outcome === 'goal')
      } else if (verdict.outcome === 'goal') {
        stopBall()
        playGoal()
        s.scoreGoal(verdict.scorer)
      } else {
        // Doesn't count — ball back to the centre spot, possession changes.
        stopAllBodies()
        placeBallAt(0, 0)
        deOverlapBodies()
        s.disallowGoal(verdict.outcome)
      }
      return
    }

    // ── Everything stopped? ──
    resolveMs.current += frameMs
    settledMs.current = allBodiesSettled() ? settledMs.current + frameMs : 0
    if (settledMs.current < PHYSICS.settleTime && resolveMs.current < MAX_RESOLVE_MS) return

    resolved.current = true
    stopAllBodies()
    if (s.penaltyShootout) {
      s.penaltyAttemptResult(false)
    } else {
      playTurnChange()
      s.switchTurn()
    }
  })
}
