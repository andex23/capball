import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  stepPhysics, getBodies, allBodiesSettled, clampAllBodies, stopBall,
  stopAllBodies, placeBallAt, deOverlapBodies, getLastBallTeam,
} from './PhysicsWorld'
import { ballInCorner, cornerRestart } from '../game/rules'
import { checkGoal } from './GoalDetector'
import { useMatchStore, PHASE, isAuthority } from '../state/MatchStore'
import { PHYSICS } from '../data/TeamData'
import { playGoal, playTurnChange, playWhistle } from '../audio/SoundManager'
import { useGoalReplay } from '../scene/useGoalReplay'

// A turn never waits longer than this for everything to stop rolling.
const MAX_RESOLVE_MS = 12000
// One physics frame, as Matter and the aim preview count them
const BASE_FRAME_MS = 1000 / 60
// A long frame (tab in background, device hiccup) must not eat match time
const MAX_CLOCK_STEP_S = 0.1
// Longest frame the physics catches up on. A phone drawing 30 frames a second
// still plays shots at full speed; a stall longer than this just pauses them.
const MAX_FRAME_MS = 50
// Further than this between two sub-steps is a teleport (kick-off, set piece), not motion
const SNAP_DIST = 1.5

export function usePhysicsSync(meshRefs) {
  const settledMs = useRef(0)
  const resolveMs = useRef(0)
  // Set once the current RESOLVE phase has an outcome, so it can't be decided twice
  const resolved = useRef(false)
  // Physics time owed but not yet stepped (fractions of a sub-step)
  const simCarry = useRef(0)
  // Positions before the latest sub-step, so meshes can be drawn between sub-steps
  const prevPos = useRef({})
  const interp = useRef(0)
  const replayFrame = useGoalReplay(meshRefs)

  useFrame((_, delta) => {
    const store = useMatchStore.getState()
    const authority = isAuthority(store)
    const frameMs = Math.min(delta * 1000, MAX_FRAME_MS)

    if (store.phase !== PHASE.RESOLVE) {
      resolved.current = false
      settledMs.current = 0
      resolveMs.current = 0
    }

    // Only the authority simulates; an online guest just mirrors host positions.
    if (authority && !store.paused) {
      store.tickTimer(Math.min(delta, MAX_CLOCK_STEP_S))
      store.tickShotClock(Math.min(delta, MAX_CLOCK_STEP_S))
      if (useMatchStore.getState().phase === PHASE.RESOLVE) {
        // Physics time runs slower than real time (PHYSICS.timeScale) so a
        // shot is watchable, but always in the same fixed sub-steps the aim
        // preview and the CPU's look-ahead assume — only fewer per frame.
        const subSteps = PHYSICS.subSteps || 8
        const stepMs = BASE_FRAME_MS / subSteps
        simCarry.current += frameMs * (PHYSICS.timeScale || 1)
        const live = getBodies()
        let n = 0
        while (simCarry.current >= stepMs && n < subSteps * 4) {
          const prev = prevPos.current
          for (const id in live) {
            const p = prev[id] || (prev[id] = { x: 0, y: 0 })
            p.x = live[id].position.x
            p.y = live[id].position.y
          }
          stepPhysics(stepMs)
          simCarry.current -= stepMs
          n++
        }
        if (n) clampAllBodies()
        if (simCarry.current > stepMs) simCarry.current = stepMs // dropped time: don't spiral
        interp.current = Math.min(1, simCarry.current / stepMs)
      } else {
        simCarry.current = 0
        interp.current = 0
        prevPos.current = {}
      }
    }

    // Sync 2D physics → 3D meshes (guest smooths between network snapshots)
    const bodies = getBodies()
    const blend = authority ? 1 : Math.min(1, delta * 18)
    // The physics advances in sub-steps that don't line up with screen
    // frames; draw each body the matching fraction of the way between its
    // last two sub-steps so motion is smooth instead of stepping.
    const a = authority ? interp.current : 1
    for (const [id, body] of Object.entries(bodies)) {
      const mesh = meshRefs.current[id]
      if (!mesh) continue
      let x = body.position.x
      let y = body.position.y
      const p = authority && prevPos.current[id]
      if (p && a < 1 && Math.abs(x - p.x) + Math.abs(y - p.y) < SNAP_DIST) {
        x = p.x + (x - p.x) * a
        y = p.y + (y - p.y) * a
      }
      mesh.position.x += (x - mesh.position.x) * blend
      mesh.position.z += (y - mesh.position.z) * blend
    }
    // Record this frame for goal replays — or, during one, redraw the past
    replayFrame(delta)

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
      return
    }
    // Ball stuck in a corner: corner kick or goal kick, like real football
    const corner = bodies.ball && ballInCorner(bodies.ball.position.x, bodies.ball.position.y)
    if (corner) {
      playWhistle()
      s.awardRestart({ ...cornerRestart(corner.ex, getLastBallTeam(), s.team1Side || 'left'), ...corner })
    } else {
      playTurnChange()
      s.switchTurn()
    }
  })
}
