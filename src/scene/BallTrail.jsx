import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getBodies } from '../physics/PhysicsWorld'

/**
 * Ball trail effect — shows a fading trail when the ball moves fast
 */
const TRAIL_LENGTH = 12
const MIN_SPEED = 1.5 // only show trail above this speed

export default function BallTrail() {
  const trailRef = useRef([])
  const meshRefs = useRef([])

  useFrame(() => {
    const ball = getBodies().ball
    if (!ball) return

    const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2)
    const trail = trailRef.current

    // Add new position to trail
    if (speed > MIN_SPEED) {
      trail.unshift({ x: ball.position.x, z: ball.position.y, speed })
      if (trail.length > TRAIL_LENGTH) trail.pop()
    } else {
      // Fade out trail when slow
      if (trail.length > 0) trail.pop()
    }

    // Update trail meshes
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue
      if (i < trail.length) {
        const pt = trail[i]
        const alpha = (1 - i / trail.length) * 0.4
        mesh.position.set(pt.x, 0.12, pt.z)
        mesh.scale.setScalar(0.15 + (1 - i / trail.length) * 0.2)
        mesh.material.opacity = alpha
        mesh.visible = true
      } else {
        mesh.visible = false
      }
    }
  })

  return (
    <group>
      {Array.from({ length: TRAIL_LENGTH }).map((_, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el }}
          visible={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
