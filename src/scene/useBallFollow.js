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
 * The camera keeps the ball in view: while it rolls the view glides with it
 * (camera and the point it looks at move together, so the angle never
 * changes), and when play stops it stays leaning towards where the ball came
 * to rest, so the next flick is taken with the ball near the middle. Moving
 * the view by hand, a replay or a camera change lets go until the next play.
 * Once a play is over the view always comes back to the normal one (leaning
 * at the ball), even if it was dragged or zoomed by hand.
 */
export function useBallFollow(meshRefs) {
  // home: glide back once nothing else moves the camera (true at the start, so
  // a resumed match opens on the ball). base/off: the unshifted pose and the
  // current lean. adopt: the pose the glide home is heading for.
  const st = useRef({ base: null, off: [0, 0], last: null, prevPhase: null, home: true, adopt: null })
  // When the view is about to turn round or change preset, snap back first
  useEffect(() => {
    setFollowRelease(() => {
      const s = st.current
      if (s.base) setCameraPose(s.base)
      s.base = null; s.off = [0, 0]; s.last = null; s.adopt = null
      // Lean at the ball again once the new view has settled
      s.home = true
    })
    return () => setFollowRelease(null)
  }, [])
  useFrame((_, dt) => {
    const s = st.current
    const m = useMatchStore.getState()
    const ball = meshRefs.current?.ball
    const track = m.followBall && !m.replaying && !!ball
    const rolling = track && m.phase === PHASE.RESOLVE
    const lean = () => (m.followBall && ball ? followShift(ball.position.x, ball.position.z) : [0, 0])
    // A play has just finished: glide straight back to the normal view (from
    // wherever the follow or a drag left it), leaning at the ball, once nothing
    // else is moving the camera. A goal waits for its replay and the kick-off.
    if (s.prevPhase === PHASE.RESOLVE && m.phase !== PHASE.RESOLVE) {
      s.home = true
      s.base = null; s.off = [0, 0]; s.last = null
    }
    if (m.phase === PHASE.RESOLVE) s.home = false
    s.prevPhase = m.phase
    if (m.replaying || isStickActive()) { s.base = null; s.off = [0, 0]; s.last = null; s.adopt = null; return }
    // Paused: leave the view exactly where it is
    if (isCameraGliding() || m.paused) return
    if (s.home && !HOLD_HOME.includes(m.phase)) {
      const off = lean()
      const goal = returnHome(off)
      s.home = false
      s.base = null; s.off = [0, 0]; s.last = null
      s.adopt = goal && (off[0] || off[1]) ? { goal, off } : null
      return
    }
    const pose = getCameraPose()
    if (!pose) return
    // Arrived home leaning at the ball: keep that lean while the turn is taken
    if (s.adopt) {
      const { goal, off } = s.adopt
      s.adopt = null
      if (Math.hypot(...pose.position.map((v, i) => v - goal.position[i])) < 0.06) {
        s.base = { position: [goal.position[0] - off[0], goal.position[1], goal.position[2] - off[1]], target: [goal.target[0] - off[0], goal.target[1], goal.target[2] - off[1]] }
        s.off = off
        s.last = pose.position
      }
    }
    // Someone else moved the camera (a drag, a preset, the view turning round): let go
    if (s.base && s.last && Math.hypot(pose.position[0] - s.last[0], pose.position[1] - s.last[1], pose.position[2] - s.last[2]) > 0.01) {
      s.base = null; s.off = [0, 0]; s.last = null
    }
    if (!s.base) {
      if (!rolling) return
      s.base = pose
      s.off = [0, 0]
    }
    // Rolling: chase the ball. Stopped: hold the lean (the ball isn't moving),
    // or ease back to centre if following was switched off.
    const want = track ? lean() : [0, 0]
    const k = 1 - Math.exp(-Math.min(0.1, dt) * (rolling ? FOLLOW_RATE : SETTLE_RATE))
    s.off = [s.off[0] + (want[0] - s.off[0]) * k, s.off[1] + (want[1] - s.off[1]) * k]
    const [bp, bt] = [s.base.position, s.base.target]
    const position = [bp[0] + s.off[0], bp[1], bp[2] + s.off[1]]
    setCameraPose({ position, target: [bt[0] + s.off[0], bt[1], bt[2] + s.off[1]] })
    s.last = position
    // Back to centre: stop until the next shot
    if (!track && Math.hypot(s.off[0], s.off[1]) < 0.01) {
      setCameraPose({ position: bp, target: bt })
      s.base = null; s.off = [0, 0]; s.last = null
    }
  })
}
