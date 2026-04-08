import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../data/TeamData'
import { useMatchStore } from '../state/MatchStore'
import { STADIUMS } from '../data/StadiumData'

// A cylinder connecting two 3D points (for sloped goal bars)
function SlopeBar({ from, to, radius, matProps }) {
  const [midX, midY, midZ] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

  const direction = new THREE.Vector3(dx, dy, dz).normalize()
  const quaternion = new THREE.Quaternion()
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
  const euler = new THREE.Euler().setFromQuaternion(quaternion)

  return (
    <mesh position={[midX, midY, midZ]} rotation={euler} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial {...matProps} />
    </mesh>
  )
}

// A quad net panel from 4 corner points
function NetSide({ corners }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const [a, b, c, d] = corners.map(c => new THREE.Vector3(...c))
    const vertices = new Float32Array([
      ...a.toArray(), ...b.toArray(), ...c.toArray(),
      ...a.toArray(), ...c.toArray(), ...d.toArray(),
    ])
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    g.computeVertexNormals()
    return g
  }, [corners])

  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color="#ffffff" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

// Pitch texture using stadium surface colors
function createPitchTexture(stadiumConfig) {
  const sc = stadiumConfig
  const canvas = document.createElement('canvas')
  const size = 2048  // Higher res for crispness
  canvas.width = size
  canvas.height = Math.round(size * (PITCH.height / PITCH.width))
  const ctx = canvas.getContext('2d')

  // Surface base color from stadium config
  const grassGrad = ctx.createLinearGradient(0, 0, canvas.width, 0)
  grassGrad.addColorStop(0, sc.grass1)
  grassGrad.addColorStop(0.5, sc.grass2)
  grassGrad.addColorStop(1, sc.grass1)
  ctx.fillStyle = grassGrad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Stripe pattern
  const stripeWidth = canvas.width / 12
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${sc.stripeAlpha})`
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, canvas.height)
    }
  }

  const sx = canvas.width / PITCH.width
  const sy = canvas.height / PITCH.height

  // Line markings from stadium config
  ctx.strokeStyle = sc.lineColor
  ctx.lineWidth = sc.lineWidth

  // Outer boundary
  const pad = 6
  ctx.strokeRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2)

  // Halfway line
  ctx.beginPath()
  ctx.moveTo(canvas.width / 2, pad)
  ctx.lineTo(canvas.width / 2, canvas.height - pad)
  ctx.stroke()

  // Center circle
  ctx.beginPath()
  ctx.arc(canvas.width / 2, canvas.height / 2, 3 * sx, 0, Math.PI * 2)
  ctx.stroke()

  // Center spot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(canvas.width / 2, canvas.height / 2, 6, 0, Math.PI * 2)
  ctx.fill()

  // Goal areas (small boxes)
  const goalAreaW = 3 * sx
  const goalAreaH = 8 * sy
  ctx.strokeRect(pad, (canvas.height - goalAreaH) / 2, goalAreaW, goalAreaH)
  ctx.strokeRect(canvas.width - goalAreaW - pad, (canvas.height - goalAreaH) / 2, goalAreaW, goalAreaH)

  // Penalty areas (larger boxes)
  const penAreaW = 6 * sx
  const penAreaH = 12 * sy
  ctx.strokeRect(pad, (canvas.height - penAreaH) / 2, penAreaW, penAreaH)
  ctx.strokeRect(canvas.width - penAreaW - pad, (canvas.height - penAreaH) / 2, penAreaW, penAreaH)

  // Penalty spots
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  const penSpotX = 4.5 * sx
  ctx.beginPath()
  ctx.arc(penSpotX + pad, canvas.height / 2, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(canvas.width - penSpotX - pad, canvas.height / 2, 4, 0, Math.PI * 2)
  ctx.fill()

  // Penalty arcs — arc of radius from pen spot that extends outside the penalty area
  // Real football: arc radius = 9.15m from pen spot, penalty area = 16.5m from goal line
  // Our penalty area is 6 units wide from goal line, pen spot at 4.5 units
  // Arc radius should reach just past the penalty area edge (6 - 4.5 = 1.5 units past pen spot)
  // Use 3 * sx for the arc radius (visible, proportional)
  const arcRadius = 3.2 * sx
  // Calculate the angle where the arc intersects the penalty area edge
  const penEdgeFromSpot = penAreaW - penSpotX * sx / sx // distance in pitch units
  const arcAngle = Math.acos(Math.min(1, (penAreaW - penSpotX) * sx / arcRadius))

  // Left penalty arc (outside the left penalty area, to the right)
  ctx.beginPath()
  ctx.arc(penSpotX + pad, canvas.height / 2, arcRadius, -arcAngle, arcAngle)
  ctx.stroke()
  // Right penalty arc (outside the right penalty area, to the left)
  ctx.beginPath()
  ctx.arc(canvas.width - penSpotX - pad, canvas.height / 2, arcRadius, Math.PI - arcAngle, Math.PI + arcAngle)
  ctx.stroke()

  // Goal openings (highlight with brighter, thicker line)
  const goalH = PITCH.goalWidth * sy
  ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, (canvas.height - goalH) / 2)
  ctx.lineTo(0, (canvas.height + goalH) / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(canvas.width, (canvas.height - goalH) / 2)
  ctx.lineTo(canvas.width, (canvas.height + goalH) / 2)
  ctx.stroke()

  // Corner arcs
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 3
  const cornerR = 1.2 * sx
  // Top-left
  ctx.beginPath(); ctx.arc(pad, pad, cornerR, 0, Math.PI / 2); ctx.stroke()
  // Top-right
  ctx.beginPath(); ctx.arc(canvas.width - pad, pad, cornerR, Math.PI / 2, Math.PI); ctx.stroke()
  // Bottom-left
  ctx.beginPath(); ctx.arc(pad, canvas.height - pad, cornerR, -Math.PI / 2, 0); ctx.stroke()
  // Bottom-right
  ctx.beginPath(); ctx.arc(canvas.width - pad, canvas.height - pad, cornerR, Math.PI, 3 * Math.PI / 2); ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.anisotropy = 4
  return texture
}

export default function PitchMesh() {
  const stadiumId = useMatchStore((s) => s.stadium)
  const sc = STADIUMS[stadiumId] || STADIUMS.arena
  const texture = useMemo(() => createPitchTexture(sc), [stadiumId])

  return (
    <group>
      {/* Pitch surface — slightly raised for depth */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[PITCH.width, PITCH.height]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.65}
          metalness={0.05}
        />
      </mesh>

      {/* Board base platform */}
      <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[PITCH.width + 2.5, 0.3, PITCH.height + 2.5]} />
        <meshStandardMaterial color={sc.baseColor} roughness={0.65} metalness={0.08} />
      </mesh>
      {/* Board edge trim */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[PITCH.width + 2.7, 0.02, PITCH.height + 2.7]} />
        <meshStandardMaterial color={sc.baseTrimColor} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Boundary rails */}
      <WallSegments woodColor={sc.woodColor} trimColor={sc.trimColor} />

      {/* Corner flags */}
      <CornerFlags />

      {/* Goal posts */}
      <GoalPosts postColor={sc.postColor} />
    </group>
  )
}

function WallSegments({ woodColor = '#8B5E3C', trimColor = '#C5943A' }) {
  const { halfW, halfH, goalWidth, wallThickness: wt } = PITCH
  const goalHalf = goalWidth / 2
  const wallHeight = 0.6
  const sideLen = halfH - goalHalf

  const woodProps = { color: woodColor, roughness: 0.55, metalness: 0.1 }
  const trimProps = { color: trimColor, roughness: 0.3, metalness: 0.6 }

  const trimH = 0.04

  return (
    <group>
      {/* Top wall */}
      <mesh position={[0, wallHeight / 2, -halfH - wt / 2]} castShadow receiveShadow>
        <boxGeometry args={[PITCH.width + wt * 2, wallHeight, wt]} />
        <meshStandardMaterial {...woodProps} />
      </mesh>
      <mesh position={[0, wallHeight + trimH / 2, -halfH - wt / 2]}>
        <boxGeometry args={[PITCH.width + wt * 2 + 0.1, trimH, wt + 0.1]} />
        <meshStandardMaterial {...trimProps} />
      </mesh>

      {/* Bottom wall */}
      <mesh position={[0, wallHeight / 2, halfH + wt / 2]} castShadow receiveShadow>
        <boxGeometry args={[PITCH.width + wt * 2, wallHeight, wt]} />
        <meshStandardMaterial {...woodProps} />
      </mesh>
      <mesh position={[0, wallHeight + trimH / 2, halfH + wt / 2]}>
        <boxGeometry args={[PITCH.width + wt * 2 + 0.1, trimH, wt + 0.1]} />
        <meshStandardMaterial {...trimProps} />
      </mesh>

      {/* Left side - top segment */}
      <mesh position={[-halfW - wt / 2, wallHeight / 2, -(halfH / 2 + goalHalf / 2)]} castShadow receiveShadow>
        <boxGeometry args={[wt, wallHeight, sideLen]} />
        <meshStandardMaterial {...woodProps} />
      </mesh>
      <mesh position={[-halfW - wt / 2, wallHeight + trimH / 2, -(halfH / 2 + goalHalf / 2)]}>
        <boxGeometry args={[wt + 0.1, trimH, sideLen + 0.1]} />
        <meshStandardMaterial {...trimProps} />
      </mesh>

      {/* Left side - bottom segment */}
      <mesh position={[-halfW - wt / 2, wallHeight / 2, halfH / 2 + goalHalf / 2]} castShadow receiveShadow>
        <boxGeometry args={[wt, wallHeight, sideLen]} />
        <meshStandardMaterial {...woodProps} />
      </mesh>
      <mesh position={[-halfW - wt / 2, wallHeight + trimH / 2, halfH / 2 + goalHalf / 2]}>
        <boxGeometry args={[wt + 0.1, trimH, sideLen + 0.1]} />
        <meshStandardMaterial {...trimProps} />
      </mesh>

      {/* Right side - top segment */}
      <mesh position={[halfW + wt / 2, wallHeight / 2, -(halfH / 2 + goalHalf / 2)]} castShadow receiveShadow>
        <boxGeometry args={[wt, wallHeight, sideLen]} />
        <meshStandardMaterial {...woodProps} />
      </mesh>
      <mesh position={[halfW + wt / 2, wallHeight + trimH / 2, -(halfH / 2 + goalHalf / 2)]}>
        <boxGeometry args={[wt + 0.1, trimH, sideLen + 0.1]} />
        <meshStandardMaterial {...trimProps} />
      </mesh>

      {/* Right side - bottom segment */}
      <mesh position={[halfW + wt / 2, wallHeight / 2, halfH / 2 + goalHalf / 2]} castShadow receiveShadow>
        <boxGeometry args={[wt, wallHeight, sideLen]} />
        <meshStandardMaterial {...woodProps} />
      </mesh>
      <mesh position={[halfW + wt / 2, wallHeight + trimH / 2, halfH / 2 + goalHalf / 2]}>
        <boxGeometry args={[wt + 0.1, trimH, sideLen + 0.1]} />
        <meshStandardMaterial {...trimProps} />
      </mesh>

      {/* Corner accent blocks — small gold caps at each outer corner */}
      {[
        [-halfW - wt, 0, -halfH - wt],
        [halfW + wt, 0, -halfH - wt],
        [-halfW - wt, 0, halfH + wt],
        [halfW + wt, 0, halfH + wt],
      ].map((pos, i) => (
        <mesh key={i} position={[pos[0], wallHeight + trimH, pos[2]]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="#D4A74A" metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function CornerFlags() {
  const { halfW, halfH } = PITCH
  const corners = [
    [-halfW, halfH], [halfW, halfH],
    [-halfW, -halfH], [halfW, -halfH],
  ]
  return (
    <group>
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Pole */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
            <meshStandardMaterial color="#dddddd" metalness={0.3} roughness={0.5} />
          </mesh>
          {/* Flag */}
          <mesh position={[0.12, 0.9, 0]} rotation-y={Math.PI * 0.25}>
            <planeGeometry args={[0.25, 0.18]} />
            <meshBasicMaterial color="#FFD740" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function GoalPosts({ postColor = '#e8e8e8' }) {
  const { halfW, goalWidth } = PITCH
  const goalHalf = goalWidth / 2

  return (
    <group>
      <GoalFrame x={-halfW} goalHalf={goalHalf} flip={false} postColor={postColor} />
      <GoalFrame x={halfW} goalHalf={goalHalf} flip={true} postColor={postColor} />
    </group>
  )
}

function GoalFrame({ x, goalHalf, flip, postColor = '#e8e8e8' }) {
  const dir = flip ? 1 : -1
  const postRadius = 0.18
  const postHeight = 1.8         // taller goal posts — more visible and realistic
  const goalDepth = 1.8          // deeper net pocket recessed into wall
  const goalW = goalHalf * 2

  const postMat = { color: postColor, metalness: 0.85, roughness: 0.1 }
  // Dark interior for goal mouth depth
  const backMat = { color: '#1a1a2a', metalness: 0.2, roughness: 0.8 }

  return (
    <group>
      {/* === GOAL POCKET — recessed box built into the wall === */}
      {/* Back wall */}
      <mesh position={[x + dir * goalDepth, postHeight * 0.35, 0]}>
        <boxGeometry args={[0.08, postHeight * 0.7, goalW + 0.1]} />
        <meshStandardMaterial {...backMat} />
      </mesh>
      {/* Side walls of pocket */}
      <mesh position={[x + dir * goalDepth * 0.5, postHeight * 0.35, -goalHalf]}>
        <boxGeometry args={[goalDepth, postHeight * 0.7, 0.08]} />
        <meshStandardMaterial {...backMat} />
      </mesh>
      <mesh position={[x + dir * goalDepth * 0.5, postHeight * 0.35, goalHalf]}>
        <boxGeometry args={[goalDepth, postHeight * 0.7, 0.08]} />
        <meshStandardMaterial {...backMat} />
      </mesh>
      {/* Floor of pocket */}
      <mesh position={[x + dir * goalDepth * 0.5, 0.01, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[goalDepth, goalW]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.9} metalness={0} />
      </mesh>

      {/* === FRONT POSTS — at the pitch edge === */}
      <mesh position={[x, postHeight / 2, -goalHalf]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, postHeight, 16]} />
        <meshStandardMaterial {...postMat} />
      </mesh>
      <mesh position={[x, postHeight / 2, goalHalf]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, postHeight, 16]} />
        <meshStandardMaterial {...postMat} />
      </mesh>
      {/* Crossbar */}
      <mesh position={[x, postHeight, 0]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, goalW, 16]} />
        <meshStandardMaterial {...postMat} />
      </mesh>

      {/* === BACK POSTS — lower, supporting the net === */}
      <mesh position={[x + dir * goalDepth, postHeight * 0.35, -goalHalf]} castShadow>
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, postHeight * 0.7, 8]} />
        <meshStandardMaterial {...postMat} />
      </mesh>
      <mesh position={[x + dir * goalDepth, postHeight * 0.35, goalHalf]} castShadow>
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, postHeight * 0.7, 8]} />
        <meshStandardMaterial {...postMat} />
      </mesh>
      {/* Back crossbar */}
      <mesh position={[x + dir * goalDepth, postHeight * 0.7, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, goalW, 8]} />
        <meshStandardMaterial {...postMat} />
      </mesh>

      {/* === SLOPE BARS — connecting front to back === */}
      <SlopeBar
        from={[x, postHeight, -goalHalf]}
        to={[x + dir * goalDepth, postHeight * 0.7, -goalHalf]}
        radius={postRadius * 0.45}
        matProps={postMat}
      />
      <SlopeBar
        from={[x, postHeight, goalHalf]}
        to={[x + dir * goalDepth, postHeight * 0.7, goalHalf]}
        radius={postRadius * 0.45}
        matProps={postMat}
      />

      {/* === NET PANELS — semi-transparent === */}
      {/* Back net */}
      <mesh position={[x + dir * goalDepth, postHeight * 0.35, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[goalW, postHeight * 0.7]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Side nets */}
      <NetSide corners={[
        [x, 0, -goalHalf], [x, postHeight, -goalHalf],
        [x + dir * goalDepth, postHeight * 0.7, -goalHalf], [x + dir * goalDepth, 0, -goalHalf],
      ]} />
      <NetSide corners={[
        [x, 0, goalHalf], [x, postHeight, goalHalf],
        [x + dir * goalDepth, postHeight * 0.7, goalHalf], [x + dir * goalDepth, 0, goalHalf],
      ]} />
      {/* Top net */}
      <NetSide corners={[
        [x, postHeight, -goalHalf], [x, postHeight, goalHalf],
        [x + dir * goalDepth, postHeight * 0.7, goalHalf], [x + dir * goalDepth, postHeight * 0.7, -goalHalf],
      ]} />
    </group>
  )
}
