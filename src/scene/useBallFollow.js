import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { getCameraPose, setCameraPose, isStickActive, setFollowRelease, returnHome, isCameraGliding } from './camera'

// How far the view leans towards the ball (share of the ball's distance from
// the centre spot), and the most it ever moves, in world units
const LEAN = 0.5
const MAX_SHIFT = 6
const FOLLOW_RATE = 3.5 // higher = keeps up faster
const SETTLE_RATE = 2.2
// Phases where a replay may still take the camera: go home after them
const HOLD_HOME = [PHASE.GOAL, PHASE.NO_GOAL]

/** Pure: the shift the camera wants for a ball at (x, z). */
export function followShift(x, z, lean = LEAN, max = MAX_SHIFT) {
  let sx = x * lean
  let sz = z * lean
  const len = Math.hypot(sx, sz)
  if (len > max) { sx *= max / len; sz *= max / len }
  return [sx, sz]
}

/**
 * While the ball rolls, the camera glides with it (camera and the point it
 * looks at move together, so the angle never changes), then eases back when
 * play stops. Moving the view by hand, a replay or a camera change cancels it.
 * Once a play is over the view always goes back to normal, even if it was
 * dragged or zoomed by hand.
 */
export function useBallFollow(meshRefs) {
  const st = useRef({ base: null, off: [0, 0], last: null, prevPhase: null, home: false })
  // When the view is about to turn round or change preset, snap back first
  useEffect(() => {
    setFollowRelease(() => {
      const s = st.current
      if (s.base) setCameraPose(s.base)
      s.base = null; s.off = [0, 0]; s.last = null
    })
    return () => setFollowRelease(null)
  }, [])
  useFrame((_, dt) => {
    const s = st.current
    const m = useMatchStore.getState()
    const ball = meshRefs.current?.ball
    const following = m.followBall && m.phase === PHASE.RESOLVE && !m.replaying && !m.paused && !!ball
    // A play has just finished: glide straight back to the normal view (from
    // wherever the follow or a drag left it) once nothing else is moving the
    // camera. A goal waits for its replay and the kick-off.
    if (s.prevPhase === PHASE.RESOLVE && m.phase !== PHASE.RESOLVE) {
      s.home = true
      s.base = null; s.off = [0, 0]; s.last = null
    }
    if (m.phase === PHASE.RESOLVE) s.home = false
    s.prevPhase = m.phase
    if (s.home && !HOLD_HOME.includes(m.phase) && !m.replaying && !m.paused && !isStickActive() && !isCameraGliding()) {
      s.home = false
      returnHome()
    }
    if (m.replaying || isStickActive()) { s.base = null; s.off = [0, 0]; s.last = null; return }
    const pose = getCameraPose()
    if (!pose) return
    // Someone else moved the camera (a drag, a preset, the view turning round): let go
    if (s.base && s.last && Math.hypot(pose.position[0] - s.last[0], pose.position[1] - s.last[1], pose.position[2] - s.last[2]) > 0.01) {
      s.base = null; s.off = [0, 0]; s.last = null
    }
    if (!s.base) {
      if (!following) return
      s.base = pose
      s.off = [0, 0]
    }
    const want = following ? followShift(ball.position.x, ball.position.z) : [0, 0]
    const k = 1 - Math.exp(-Math.min(0.1, dt) * (following ? FOLLOW_RATE : SETTLE_RATE))
    s.off = [s.off[0] + (want[0] - s.off[0]) * k, s.off[1] + (want[1] - s.off[1]) * k]
    const [bp, bt] = [s.base.position, s.base.target]
    const position = [bp[0] + s.off[0], bp[1], bp[2] + s.off[1]]
    setCameraPose({ position, target: [bt[0] + s.off[0], bt[1], bt[2] + s.off[1]] })
    s.last = position
    // Back home: stop until the next shot
    if (!following && Math.hypot(s.off[0], s.off[1]) < 0.01) {
      setCameraPose({ position: bp, target: bt })
      s.base = null; s.off = [0, 0]; s.last = null
    }
  })
}
