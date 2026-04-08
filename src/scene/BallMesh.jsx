import { forwardRef } from 'react'
import { BALL_RADIUS } from '../data/TeamData'
import { useMatchStore } from '../state/MatchStore'

const BALL_HEIGHT = 0.12

const BallMesh = forwardRef(function BallMesh(props, ref) {
  const ballColor = useMatchStore((s) => s.ballColor)

  return (
    <group ref={ref} position={[0, BALL_HEIGHT / 2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[BALL_RADIUS, BALL_RADIUS, BALL_HEIGHT, 32]} />
        <meshStandardMaterial
          color={ballColor}
          metalness={0.6}
          roughness={0.25}
          emissive="#222222"
        />
      </mesh>
      {/* Bright ring around the ball to make it easy to spot */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[BALL_RADIUS + 0.03, BALL_RADIUS + 0.03, BALL_HEIGHT * 0.5, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.8}
          roughness={0.2}
          emissive="#333333"
        />
      </mesh>
    </group>
  )
})

export default BallMesh
