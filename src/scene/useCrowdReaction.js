import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useMatchStore, PHASE } from '../state/MatchStore'
import {
  crowdIntensity, approachLevel, detectCushionBounce, isNearMiss, CROWD_IDLE, HARD_CUSHION,
} from '../game/crowd'
import {
  startCrowdAmbience, stopCrowdAmbience, setCrowdVolume,
  playCrowdRoar, playCrowdGroan, playCrowdMurmur,
} from '../audio/SoundManager'
import { haptic } from '../input/haptics'

// Crowd level held while play is stopped for these moments
const PHASE_LEVEL = {
  [PHASE.GOAL]: 0.9,
  [PHASE.FOUL]: 0.55,
  [PHASE.MISSED]: 0.5,
  [PHASE.NO_GOAL]: 0.45,
  [PHASE.KICKOFF]: 0.4,
}
const OPEN_PLAY = [PHASE.SELECT, PHASE.AIM, PHASE.RESOLVE]
const PAUSED_LEVEL = 0.1
const REFRESH_S = 0.25 // re-send the level this often so volume changes apply

/**
 * The crowd and the phone react to the match: the crowd bed swells as the
 * ball nears a goal or flies about, roars at goals, groans at near misses and
 * murmurs at fouls; the phone buzzes on goals, fouls and hard cushion hits.
 * Reads the ball MESH, so an online guest reacts the same as the host.
 */
export function useCrowdReaction(meshRefs) {
  const st = useRef({ p0: null, p1: null, level: CROWD_IDLE, sent: -1, sinceSend: 0, excite: 0, missCooldown: 0, cushionCooldown: 0 })

  useEffect(() => {
    startCrowdAmbience()
    const unsubscribe = useMatchStore.subscribe((s, prev) => {
      if (s.phase === prev.phase) return
      if (s.phase === PHASE.GOAL) {
        playCrowdRoar()
        haptic('goal')
      } else if (s.phase === PHASE.FOUL) {
        playCrowdMurmur()
        haptic('foul')
      } else if (s.phase === PHASE.MISSED) {
        playCrowdGroan()
      }
    })
    return () => {
      unsubscribe()
      stopCrowdAmbience()
    }
  }, [])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 0.1)
    const ball = meshRefs.current.ball
    if (!ball || dt <= 0) return
    const { phase, paused } = useMatchStore.getState()

    const p2 = { x: ball.position.x, z: ball.position.z }
    const { p0, p1 } = s
    s.p0 = p1
    s.p1 = p2
    s.missCooldown -= dt
    s.cushionCooldown -= dt
    s.excite = Math.max(0, s.excite - dt * 0.8)

    let target
    if (paused) {
      target = PAUSED_LEVEL
    } else if (OPEN_PLAY.includes(phase) && p1) {
      const speed = Math.hypot(p2.x - p1.x, p2.z - p1.z) / dt
      target = crowdIntensity(p2.x, p2.z, speed)
      if (phase === PHASE.RESOLVE && p0) {
        const bounce = detectCushionBounce(p0, p1, p2, dt)
        if (bounce && bounce.speed >= HARD_CUSHION && s.cushionCooldown <= 0) {
          haptic('cushion')
          s.cushionCooldown = 0.2
        }
        if (isNearMiss(bounce) && s.missCooldown <= 0) {
          playCrowdGroan()
          s.missCooldown = 1.5
          s.excite = 0.85
        }
      }
    } else {
      target = PHASE_LEVEL[phase] ?? CROWD_IDLE
    }

    s.level = approachLevel(s.level, Math.max(target, s.excite), dt)
    s.sinceSend += dt
    if (Math.abs(s.level - s.sent) > 0.01 || s.sinceSend > REFRESH_S) {
      setCrowdVolume(s.level)
      s.sent = s.level
      s.sinceSend = 0
    }
  })
}
