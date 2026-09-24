import { useEffect, useMemo } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { createReplayBuffer, playbackDuration, playbackTime, REPLAY } from '../game/replay'
import { getCameraPose, setCameraPose } from './camera'
import { PITCH } from '../data/TeamData'

/* ── Goal replay ──
   Records where every mesh was drawn each frame (so it works the same for an
   online guest, which only mirrors the host) and, after a goal, plays the
   run-up back on the meshes in slow motion. It only ever moves meshes: the
   physics bodies stay frozen at the goal (nothing steps in the GOAL phase) and
   the meshes fall back to them as soon as the replay ends. The replay also
   ends the moment the phase leaves GOAL, so it can't fight the kick-off
   layout. */

const IDS = [
  'team1_gk', 'team1_def1', 'team1_def2', 'team1_atk1', 'team1_atk2',
  'team2_gk', 'team2_def1', 'team2_def2', 'team2_atk1', 'team2_atk2',
  'ball',
]
const BALL = IDS.indexOf('ball')
// Only open play is worth recording; set-piece layouts teleport the caps.
const RECORD_PHASES = [PHASE.SELECT, PHASE.AIM, PHASE.RESOLVE]
const MAX_STEP_S = 0.1 // a long frame (tab switch) mustn't leave a gap in the record
const CAMERA_EASE_S = 0.8
const HOLD_S = 0.15 // linger on the final frame before handing back

const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)
const smooth = (k) => k * k * (3 - 2 * k)

function createReplayController(meshRefs) {
  const buffer = createReplayBuffer(IDS)
  const frame = new Float32Array(IDS.length * 2)
  let recClock = 0 // advances only while recording, so pauses leave no dead air
  let wallClock = 0
  let goalAt = null
  let playing = false
  let done = false
  let skipped = false
  let elapsed = 0
  let savedCam = null
  let replayCam = null

  function record() {
    const meshes = meshRefs.current
    for (let i = 0; i < IDS.length; i++) {
      const mesh = meshes[IDS[i]]
      if (!mesh) return
      frame[i * 2] = mesh.position.x
      frame[i * 2 + 1] = mesh.position.z
    }
    buffer.push(recClock, frame)
  }

  function show(t) {
    buffer.sample(t, frame)
    const meshes = meshRefs.current
    for (let i = 0; i < IDS.length; i++) {
      const mesh = meshes[IDS[i]]
      if (!mesh) continue
      mesh.position.x = frame[i * 2]
      mesh.position.z = frame[i * 2 + 1]
    }
  }

  function start() {
    playing = true
    skipped = false
    elapsed = 0
    // Push the camera in toward the goal the ball went into
    savedCam = getCameraPose()
    replayCam = null
    if (savedCam) {
      buffer.sample(buffer.end, frame)
      const goal = [(Math.sign(frame[BALL * 2]) || 1) * PITCH.halfW, 0, 0]
      const target = lerp3(savedCam.target, goal, 0.55)
      const position = savedCam.position.map((p, i) => target[i] + (p - savedCam.target[i]) * 0.65)
      replayCam = { position, target }
    }
    useMatchStore.getState().setReplaying(true)
  }

  function finish() {
    if (playing) {
      playing = false
      if (savedCam) setCameraPose(savedCam)
      savedCam = null
      useMatchStore.getState().setReplaying(false)
    }
    done = true
  }

  return {
    skip() { if (playing) skipped = true },
    dispose() {
      finish()
      goalAt = null
    },

    /** Run once per frame, right after the meshes have been synced to physics. */
    frame(delta) {
      const step = Math.min(delta, MAX_STEP_S)
      wallClock += step
      const { phase, penaltyShootout, paused } = useMatchStore.getState()

      if (phase !== PHASE.GOAL || penaltyShootout) {
        if (goalAt !== null) { finish(); goalAt = null }
        if (!RECORD_PHASES.includes(phase)) buffer.clear()
        else if (!paused) { recClock += step; record() }
        return
      }

      // GOAL: the record stops at the moment the ball went in
      if (goalAt === null) { goalAt = wallClock; done = false }
      if (done) return
      if (!playing) {
        if (wallClock - goalAt < REPLAY.bannerMs / 1000) return // "GOAL!" banner first
        if (buffer.span < REPLAY.minSpan) { done = true; return }
        start()
      }
      if (skipped) {
        finish()
        useMatchStore.getState().skipGoal() // offline: straight to kick-off
        return
      }

      elapsed += step
      show(playbackTime(elapsed, buffer.start, buffer.end))
      if (replayCam) {
        const k = smooth(Math.min(1, elapsed / CAMERA_EASE_S))
        setCameraPose({
          position: lerp3(savedCam.position, replayCam.position, k),
          target: lerp3(savedCam.target, replayCam.target, k),
        })
      }
      if (elapsed >= playbackDuration(buffer.span) + HOLD_S) finish()
    },
  }
}

/**
 * Returns a per-frame function for usePhysicsSync to call after it has synced
 * the meshes. Tap, click or Space skips a replay that's playing.
 */
export function useGoalReplay(meshRefs) {
  const replay = useMemo(() => createReplayController(meshRefs), [meshRefs])

  useEffect(() => {
    const onPointer = (e) => {
      // Buttons (pause, camera) keep working without skipping
      if (e.target instanceof Element && e.target.closest('button, input, [role="dialog"]')) return
      replay.skip()
    }
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat || !useMatchStore.getState().replaying) return
      e.preventDefault()
      replay.skip()
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      replay.dispose()
    }
  }, [replay])

  return replay.frame
}
