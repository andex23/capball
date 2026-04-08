import { forwardRef, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAP_RADIUS, GK_RADIUS } from '../data/TeamData'

/* ========================================
   CAP ANATOMY — Premium tabletop game piece
   ─────────────────────────────────────────
   Side profile (cross-section):

        ┌──────────────┐  ← center dome (raised badge plate)
       ╱                ╲
      │  recessed channel │
     ╱                      ╲
    │    main body surface    │  ← body wall
    ├──────────────────────────┤
    │     beveled outer rim    │  ← metallic rim band
    └──────────────────────────┘
         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
              bottom pad

   ======================================== */

// Overall cap dimensions
const BODY_HEIGHT = 0.22         // thicker than before
const RIM_HEIGHT = BODY_HEIGHT * 0.6
const RIM_OVERHANG = 0.06        // rim extends past body
const DOME_HEIGHT = 0.06         // raised center plate
const DOME_RATIO = 0.52          // center plate radius as % of cap radius
const CHANNEL_WIDTH = 0.06       // recessed ring width
const CHANNEL_DEPTH = 0.02       // how deep the channel is cut
const BEVEL_RATIO = 0.92         // body top face is slightly smaller (beveled edge)

// Finish presets
const FINISH_MAP = {
  matte:  { metalness: 0.2, roughness: 0.7, emissiveIntensity: 0.03, envMapIntensity: 0.5 },
  satin:  { metalness: 0.35, roughness: 0.45, emissiveIntensity: 0.05, envMapIntensity: 0.7 },
  gloss:  { metalness: 0.5, roughness: 0.18, emissiveIntensity: 0.07, envMapIntensity: 0.9 },
  chrome: { metalness: 0.92, roughness: 0.05, emissiveIntensity: 0.08, envMapIntensity: 1.3 },
}

// Create canvas texture for the center dome (badge + number + pattern hint)
function createDomeTexture(color, edgeColor, badge, number, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  // Base — match body color
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Subtle radial shading for depth
  const grad = ctx.createRadialGradient(cx * 0.9, cy * 0.85, 0, cx, cy, r)
  grad.addColorStop(0, 'rgba(255,255,255,0.08)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Badge
  const badgeColor = edgeColor === color ? '#FFFFFFBB' : `${edgeColor}DD`
  const bs = r * 0.38
  const badgeY = number != null ? cy - bs * 0.25 : cy
  ctx.fillStyle = badgeColor

  switch (badge) {
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? bs : bs * 0.4
        const angle = (Math.PI / 5) * i - Math.PI / 2
        const method = i === 0 ? 'moveTo' : 'lineTo'
        ctx[method](cx + rad * Math.cos(angle), badgeY + rad * Math.sin(angle))
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'shield':
      ctx.beginPath()
      ctx.moveTo(cx, badgeY - bs)
      ctx.lineTo(cx + bs * 0.8, badgeY - bs * 0.3)
      ctx.lineTo(cx + bs * 0.6, badgeY + bs * 0.6)
      ctx.lineTo(cx, badgeY + bs)
      ctx.lineTo(cx - bs * 0.6, badgeY + bs * 0.6)
      ctx.lineTo(cx - bs * 0.8, badgeY - bs * 0.3)
      ctx.closePath()
      ctx.fill()
      break
    case 'bolt':
      ctx.beginPath()
      ctx.moveTo(cx + bs * 0.1, badgeY - bs)
      ctx.lineTo(cx + bs * 0.35, badgeY - bs * 0.1)
      ctx.lineTo(cx + bs * 0.05, badgeY + bs * 0.05)
      ctx.lineTo(cx - bs * 0.1, badgeY + bs)
      ctx.lineTo(cx - bs * 0.35, badgeY + bs * 0.1)
      ctx.lineTo(cx - bs * 0.05, badgeY - bs * 0.05)
      ctx.closePath()
      ctx.fill()
      break
    case 'crown':
      ctx.beginPath()
      ctx.moveTo(cx - bs * 0.8, badgeY + bs * 0.5)
      ctx.lineTo(cx - bs * 0.5, badgeY - bs * 0.2)
      ctx.lineTo(cx - bs * 0.2, badgeY + bs * 0.2)
      ctx.lineTo(cx, badgeY - bs * 0.8)
      ctx.lineTo(cx + bs * 0.2, badgeY + bs * 0.2)
      ctx.lineTo(cx + bs * 0.5, badgeY - bs * 0.2)
      ctx.lineTo(cx + bs * 0.8, badgeY + bs * 0.5)
      ctx.closePath()
      ctx.fill()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(cx, badgeY - bs)
      ctx.lineTo(cx + bs * 0.65, badgeY)
      ctx.lineTo(cx, badgeY + bs)
      ctx.lineTo(cx - bs * 0.65, badgeY)
      ctx.closePath()
      ctx.fill()
      break
    case 'skull':
      ctx.beginPath()
      ctx.arc(cx, badgeY - bs * 0.15, bs * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(cx - bs * 0.22, badgeY + bs * 0.2, bs * 0.44, bs * 0.45)
      break
    case 'flame':
      ctx.beginPath()
      ctx.moveTo(cx, badgeY + bs)
      ctx.quadraticCurveTo(cx - bs * 0.9, badgeY + bs * 0.1, cx - bs * 0.4, badgeY - bs * 0.3)
      ctx.quadraticCurveTo(cx - bs * 0.2, badgeY + bs * 0.1, cx, badgeY - bs)
      ctx.quadraticCurveTo(cx + bs * 0.2, badgeY + bs * 0.1, cx + bs * 0.4, badgeY - bs * 0.3)
      ctx.quadraticCurveTo(cx + bs * 0.9, badgeY + bs * 0.1, cx, badgeY + bs)
      ctx.closePath()
      ctx.fill()
      break
  }

  // Number
  if (number != null) {
    const numY = badge && badge !== 'none' ? cy + bs * 0.75 : cy + bs * 0.1
    ctx.fillStyle = badgeColor
    ctx.font = `bold ${r * 0.45}px 'Impact', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(number), cx, numY)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Create body surface texture with patterns
function createBodyTexture(color, edgeColor, pattern, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  // Base color
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  // Pattern
  const patColor = `${edgeColor}55`
  const boldColor = `${edgeColor}77`
  switch (pattern) {
    case 'stripe':
      ctx.fillStyle = boldColor
      ctx.fillRect(cx - r * 0.1, 0, r * 0.2, size)
      break
    case 'split':
      ctx.fillStyle = `${edgeColor}2A`
      ctx.fillRect(cx, 0, r, size)
      break
    case 'ring':
      ctx.strokeStyle = boldColor
      ctx.lineWidth = r * 0.07
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'cross':
      ctx.fillStyle = patColor
      ctx.fillRect(cx - r * 0.06, cy - r * 0.55, r * 0.12, r * 1.1)
      ctx.fillRect(cx - r * 0.55, cy - r * 0.06, r * 1.1, r * 0.12)
      break
    case 'dots': {
      ctx.fillStyle = boldColor
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.055, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const CapMesh = forwardRef(function CapMesh({ id, color, edgeColor, isGk, isSelected, badge, number, pattern, finish }, ref) {
  const radius = isGk ? GK_RADIUS : CAP_RADIUS
  const ringRef = useRef()
  const fp = FINISH_MAP[finish] || FINISH_MAP.matte

  const domeR = radius * DOME_RATIO
  const channelInnerR = domeR + CHANNEL_WIDTH * 0.3
  const channelOuterR = domeR + CHANNEL_WIDTH

  const domeTexture = useMemo(
    () => createDomeTexture(color, edgeColor || color, badge, number),
    [color, edgeColor, badge, number]
  )

  const bodyTexture = useMemo(
    () => createBodyTexture(color, edgeColor || color, pattern),
    [color, edgeColor, pattern]
  )

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 1.5
      ringRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.06)
    }
  })

  const halfH = BODY_HEIGHT / 2

  return (
    <group ref={ref} position={[0, halfH, 0]}>

      {/* ─── 1. OUTER RIM — beveled metallic band ─── */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[
          radius + RIM_OVERHANG,         // top radius
          radius + RIM_OVERHANG + 0.02,  // bottom slightly wider (bevel)
          RIM_HEIGHT,
          36
        ]} />
        <meshStandardMaterial
          color={edgeColor || color}
          metalness={0.85}
          roughness={0.12}
          envMapIntensity={1.1}
        />
      </mesh>

      {/* Rim top bevel ring — slight inward taper */}
      <mesh position={[0, RIM_HEIGHT / 2 - 0.005, 0]}>
        <cylinderGeometry args={[
          radius + RIM_OVERHANG - 0.02,
          radius + RIM_OVERHANG,
          0.01,
          36
        ]} />
        <meshStandardMaterial
          color={lightenHex3(edgeColor || color, 0.2)}
          metalness={0.9}
          roughness={0.08}
        />
      </mesh>

      {/* ─── 2. MAIN BODY WALL — visible thickness ─── */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[
          radius * BEVEL_RATIO,  // top is slightly smaller (beveled)
          radius,                // bottom matches rim
          BODY_HEIGHT,
          36
        ]} />
        <meshStandardMaterial
          color={color}
          metalness={fp.metalness}
          roughness={fp.roughness}
          envMapIntensity={fp.envMapIntensity}
        />
      </mesh>

      {/* ─── 3. BODY TOP SURFACE with pattern ─── */}
      <mesh position={[0, halfH - 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * BEVEL_RATIO, 36]} />
        <meshStandardMaterial
          map={bodyTexture}
          metalness={fp.metalness}
          roughness={fp.roughness}
          emissive={color}
          emissiveIntensity={fp.emissiveIntensity}
          envMapIntensity={fp.envMapIntensity}
        />
      </mesh>

      {/* ─── 4. RECESSED CHANNEL — dark groove ring ─── */}
      <mesh position={[0, halfH - CHANNEL_DEPTH, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[channelInnerR, channelOuterR, 36]} />
        <meshStandardMaterial
          color={darkenHex3(color, 0.35)}
          metalness={0.15}
          roughness={0.85}
        />
      </mesh>
      {/* Channel inner wall shadow ring */}
      <mesh position={[0, halfH - CHANNEL_DEPTH / 2, 0]}>
        <cylinderGeometry args={[channelInnerR, channelInnerR, CHANNEL_DEPTH, 36, 1, true]} />
        <meshStandardMaterial
          color={darkenHex3(color, 0.4)}
          metalness={0.1}
          roughness={0.9}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ─── 5. RAISED CENTER BADGE PLATE (dome) ─── */}
      <mesh position={[0, halfH + DOME_HEIGHT / 2 - 0.002, 0]} castShadow>
        <cylinderGeometry args={[
          domeR,          // top
          domeR + 0.02,   // base slightly wider
          DOME_HEIGHT,
          36
        ]} />
        <meshStandardMaterial
          color={color}
          metalness={fp.metalness + 0.05}
          roughness={Math.max(0.05, fp.roughness - 0.08)}
          envMapIntensity={fp.envMapIntensity + 0.1}
        />
      </mesh>

      {/* Dome top face — badge/number texture */}
      <mesh position={[0, halfH + DOME_HEIGHT - 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[domeR, 36]} />
        <meshStandardMaterial
          map={domeTexture}
          metalness={fp.metalness + 0.05}
          roughness={Math.max(0.05, fp.roughness - 0.05)}
          emissive={color}
          emissiveIntensity={fp.emissiveIntensity * 0.8}
          envMapIntensity={fp.envMapIntensity}
        />
      </mesh>

      {/* ─── 6. BOTTOM PAD — dark underside ─── */}
      <mesh position={[0, -halfH + 0.008, 0]}>
        <cylinderGeometry args={[radius * 0.92, radius + RIM_OVERHANG, 0.025, 36]} />
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.15}
          roughness={0.9}
        />
      </mesh>

      {/* ─── 7. SELECTION RING — animated glow ─── */}
      {isSelected && (
        <mesh
          ref={ringRef}
          position={[0, -halfH + 0.015, 0]}
          rotation-x={-Math.PI / 2}
        >
          <ringGeometry args={[radius + RIM_OVERHANG + 0.08, radius + RIM_OVERHANG + 0.25, 36]} />
          <meshBasicMaterial
            color="#FFD740"
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* ─── 8. GK MARKER — hexagonal crown on dome ─── */}
      {isGk && (
        <mesh position={[0, halfH + DOME_HEIGHT + 0.002, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[domeR * 0.25, domeR * 0.4, 6]} />
          <meshBasicMaterial color={edgeColor || '#FFD700'} transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  )
})

// Simple hex color helpers for 3D materials
function darkenHex3(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function lightenHex3(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount))
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount))
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export default CapMesh
