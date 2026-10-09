import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../data/TeamData'
import { useMatchStore } from '../state/MatchStore'
import { STADIUMS, surfaceFor } from '../data/StadiumData'

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

// Deterministic noise so a venue looks the same every match
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dots(ctx, w, h, n, colors, rMin, rMax, rnd) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath()
    ctx.arc(rnd() * w, rnd() * h, rMin + rnd() * (rMax - rMin), 0, Math.PI * 2)
    ctx.fill()
  }
}

/** The playing surface under the lines: grass, felt, asphalt or dirt. */
function paintSurface(ctx, sc, w, h) {
  const rnd = seeded(9)
  const base = ctx.createLinearGradient(0, 0, w, 0)
  base.addColorStop(0, sc.grass1)
  base.addColorStop(0.5, sc.grass2)
  base.addColorStop(1, sc.grass1)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  switch (sc.surface) {
    case 'wood':
    case 'planks': {
      // Wood grain: long wavy streaks along the table, a few knots, and (planks) seams
      const planks = sc.surface === 'planks' ? 7 : 3
      for (let p = 0; p < planks; p++) {
        const y0 = (p * h) / planks
        const ph = h / planks
        ctx.fillStyle = `rgba(${p % 2 ? '255,230,200' : '60,30,10'},${0.04 + rnd() * 0.05})`
        ctx.fillRect(0, y0, w, ph)
        for (let g = 0; g < 46; g++) {
          const y = y0 + rnd() * ph
          ctx.strokeStyle = `rgba(55,28,10,${0.06 + rnd() * 0.16})`
          ctx.lineWidth = 1 + rnd() * 3
          ctx.beginPath()
          const amp = 3 + rnd() * 10
          const freq = 0.002 + rnd() * 0.004
          const phase = rnd() * 10
          for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * freq + phase) * amp)
          ctx.stroke()
        }
        if (sc.surface === 'planks' && p > 0) {
          ctx.fillStyle = 'rgba(30,15,5,0.55)'
          ctx.fillRect(0, y0 - 3, w, 6)
          ctx.fillStyle = 'rgba(255,240,220,0.12)'
          ctx.fillRect(0, y0 + 3, w, 2)
        }
      }
      for (let k = 0; k < (sc.surface === 'planks' ? 9 : 5); k++) {
        const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 22
        const g = ctx.createRadialGradient(x, y, 1, x, y, r)
        g.addColorStop(0, 'rgba(50,25,8,0.55)')
        g.addColorStop(0.5, 'rgba(70,35,12,0.25)')
        g.addColorStop(1, 'rgba(70,35,12,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2); ctx.fill()
      }
      if (sc.top?.varnish) {
        // A glossy pool of light down the middle of a varnished bar top
        const v = ctx.createLinearGradient(0, 0, 0, h)
        v.addColorStop(0, 'rgba(255,220,180,0)')
        v.addColorStop(0.45, 'rgba(255,220,180,0.12)')
        v.addColorStop(0.55, 'rgba(255,220,180,0.12)')
        v.addColorStop(1, 'rgba(255,220,180,0)')
        ctx.fillStyle = v
        ctx.fillRect(0, 0, w, h)
      }
      break
    }
    case 'laminate': {
      // Smooth plastic or melamine: fine speckle, a few scuffs, soft light falloff
      dots(ctx, w, h, 40000, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.04)'], 0.5, 1.2, rnd)
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 0.8 + rnd() * 1.4
        const x = rnd() * w, y = rnd() * h, len = 30 + rnd() * 120, a = rnd() * Math.PI
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke()
      }
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.65)
      v.addColorStop(0, 'rgba(255,255,255,0.05)')
      v.addColorStop(1, 'rgba(0,0,0,0.18)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 'towel': {
      // Beach towel: broad stripes across, terry loops, a fringe-darkened edge
      const stripes = sc.top?.stripes || ['#ff7a59', '#ffffff']
      const n = 14
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = stripes[i % stripes.length]
        ctx.fillRect((i * w) / n, 0, w / n + 1, h)
      }
      dots(ctx, w, h, 120000, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.08)'], 0.8, 1.8, rnd)
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.6)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(0,0,0,0.14)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 'felt': {
      // Fine woven nap and a soft vignette
      dots(ctx, w, h, 60000, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.035)'], 0.6, 1.4, rnd)
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(0,0,0,0.22)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 'asphalt': {
      dots(ctx, w, h, 90000, ['rgba(0,0,0,0.22)', 'rgba(255,255,255,0.07)', 'rgba(120,120,130,0.12)'], 0.6, 2.2, rnd)
      // Cracks
      ctx.strokeStyle = 'rgba(10,10,12,0.55)'
      for (let c = 0; c < 9; c++) {
        ctx.lineWidth = 1.5 + rnd() * 2
        let x = rnd() * w
        let y = rnd() * h
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let k = 0; k < 14; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.3) * 50; ctx.lineTo(x, y) }
        ctx.stroke()
      }
      // Oil stains and patched squares
      for (let i = 0; i < 7; i++) {
        const x = rnd() * w
        const y = rnd() * h
        const r = 40 + rnd() * 90
        const g = ctx.createRadialGradient(x, y, 4, x, y, r)
        g.addColorStop(0, 'rgba(0,0,0,0.28)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let i = 0; i < 4; i++) ctx.fillRect(rnd() * w, rnd() * h, 120 + rnd() * 160, 80 + rnd() * 120)
      break
    }
    case 'dirt': {
      dots(ctx, w, h, 50000, ['rgba(60,40,20,0.25)', 'rgba(230,200,150,0.15)', 'rgba(90,70,45,0.3)'], 0.8, 2.6, rnd)
      // Pebbles
      dots(ctx, w, h, 900, ['#b8a68a', '#8a7a64', '#d6c7aa', '#6e5f4b'], 2, 5, rnd)
      // Worn, darker goalmouths and a scuffed centre
      for (const [x, r] of [[w * 0.06, h * 0.32], [w * 0.94, h * 0.32], [w * 0.5, h * 0.22]]) {
        const g = ctx.createRadialGradient(x, h / 2, 4, x, h / 2, r)
        g.addColorStop(0, 'rgba(60,40,20,0.35)')
        g.addColorStop(1, 'rgba(60,40,20,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
      // Tufts of grass hanging on near the touchlines
      for (let i = 0; i < 160; i++) {
        const edge = rnd() < 0.5 ? rnd() * h * 0.12 : h - rnd() * h * 0.12
        const x = rnd() * w
        const r = 6 + rnd() * 18
        const g = ctx.createRadialGradient(x, edge, 1, x, edge, r)
        g.addColorStop(0, 'rgba(110,130,60,0.6)')
        g.addColorStop(1, 'rgba(110,130,60,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - r, edge - r, r * 2, r * 2)
      }
      break
    }
    default: {
      // Mown grass: wide stripes one way, fainter ones across, and a fine texture
      const n = 12
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'
        ctx.fillRect((i * w) / n, 0, w / n, h)
      }
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = j % 2 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.02)'
        ctx.fillRect(0, (j * h) / 8, w, h / 8)
      }
      dots(ctx, w, h, 70000, ['rgba(0,0,0,0.07)', 'rgba(255,255,160,0.05)'], 0.6, 1.6, rnd)
    }
  }
}

// Pitch texture using stadium surface colors
function createPitchTexture(stadiumConfig) {
  const sc = stadiumConfig
  const canvas = document.createElement('canvas')
  const size = 2048  // Higher res for crispness
  canvas.width = size
  canvas.height = Math.round(size * (PITCH.height / PITCH.width))
  const ctx = canvas.getContext('2d')

  paintSurface(ctx, sc, canvas.width, canvas.height)

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
  ctx.arc(canvas.width / 2, canvas.height / 2, PITCH.centerCircleR * sx, 0, Math.PI * 2)
  ctx.stroke()

  // Center spot
  ctx.fillStyle = sc.lineColor
  ctx.beginPath()
  ctx.arc(canvas.width / 2, canvas.height / 2, 6, 0, Math.PI * 2)
  ctx.fill()

  // Goal areas (the six-yard boxes): a third of the penalty area deep, two goal-area depths wider than the goal
  const goalAreaDepth = PITCH.penAreaW / 3
  const goalAreaW = goalAreaDepth * sx
  const goalAreaH = (PITCH.goalWidth + goalAreaDepth * 2) * sy
  ctx.strokeRect(pad, (canvas.height - goalAreaH) / 2, goalAreaW, goalAreaH)
  ctx.strokeRect(canvas.width - goalAreaW - pad, (canvas.height - goalAreaH) / 2, goalAreaW, goalAreaH)

  // Penalty areas (the 18-yard boxes), from PITCH so the lines match the rules
  const penAreaW = PITCH.penAreaW * sx
  const penAreaH = PITCH.penAreaH * sy
  ctx.strokeRect(pad, (canvas.height - penAreaH) / 2, penAreaW, penAreaH)
  ctx.strokeRect(canvas.width - penAreaW - pad, (canvas.height - penAreaH) / 2, penAreaW, penAreaH)

  // Penalty spots: exactly where the ball is put for a penalty
  ctx.fillStyle = sc.lineColor
  const penSpotX = PITCH.penSpotDist * sx
  const spotR = Math.max(5, sx * 0.12)
  ctx.beginPath()
  ctx.arc(penSpotX + pad, canvas.height / 2, spotR, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(canvas.width - penSpotX - pad, canvas.height / 2, spotR, 0, Math.PI * 2)
  ctx.fill()

  // The "D": an arc round the penalty spot, drawn only where it's outside the box
  const arcRadius = (PITCH.penAreaW * 1.22 - PITCH.penSpotDist) * sx
  const arcAngle = Math.acos(Math.min(1, (penAreaW - penSpotX) / arcRadius))
  ctx.beginPath()
  ctx.arc(penSpotX + pad, canvas.height / 2, arcRadius, -arcAngle, arcAngle)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(canvas.width - penSpotX - pad, canvas.height / 2, arcRadius, Math.PI - arcAngle, Math.PI + arcAngle)
  ctx.stroke()

  // Goal openings (highlight with brighter, thicker line)
  const goalH = PITCH.goalWidth * sy
  ctx.strokeStyle = sc.lineColor
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
  ctx.strokeStyle = sc.lineColor
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
  const pitchStyle = useMatchStore((s) => s.pitchStyle)
  const venue = STADIUMS[stadiumId] || STADIUMS.arena
  const sc = useMemo(() => surfaceFor(venue, pitchStyle), [venue, pitchStyle])
  const texture = useMemo(() => createPitchTexture(sc), [sc])

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
      <WallSegments woodColor={sc.woodColor} trimColor={sc.trimColor} trimGlow={sc.trimGlow || 0} />

      {/* Corner flags */}
      <CornerFlags />

      {/* Goal posts */}
      <GoalPosts postColor={sc.postColor} />
    </group>
  )
}

function WallSegments({ woodColor = '#8B5E3C', trimColor = '#C5943A', trimGlow = 0 }) {
  const { halfW, halfH, goalWidth, wallThickness: wt } = PITCH
  const goalHalf = goalWidth / 2
  const wallHeight = 0.6
  const sideLen = halfH - goalHalf

  const woodProps = { color: woodColor, roughness: 0.55, metalness: 0.1 }
  const trimProps = { color: trimColor, roughness: 0.3, metalness: 0.6, emissive: trimColor, emissiveIntensity: trimGlow }

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
          <meshStandardMaterial color={trimColor} metalness={0.7} roughness={0.25} emissive={trimColor} emissiveIntensity={trimGlow} />
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
