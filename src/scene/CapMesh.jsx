import { forwardRef, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAP_RADIUS, GK_RADIUS } from '../data/TeamData'

/* ========================================
   A CROWN BOTTLE CAP, lying top up
   ─────────────────────────────────────────
   Side profile:

        ___________________      ← printed top, very slightly domed
       /                   \
      |\/\/\/\/\/\/\/\/\/\/|     ← crimped skirt: 21 pleats that
       \/\/\/\/\/\/\/\/\/\/      flare out towards the table

   The top carries the team's paint, pattern, badge and squad number; the
   skirt is the same paint with metal showing on the crimp edges.
   ======================================== */

const CAP_H = 0.3            // total height (a real cap: ~6 mm tall, 32 mm across)
const TOP_RATIO = 0.86       // printed top radius as a fraction of the cap's footprint
const PLEATS = 21            // a crown cap always has 21
const PLEAT_DEPTH = 0.075    // how far each pleat stands out (fraction of radius)

/** The crimped skirt: a ring of pleats flaring from the top edge down to the table. */
function createSkirtGeometry(radius) {
  const segs = PLEATS * 8
  const rings = 6
  const pos = []
  const uv = []
  const idx = []
  for (let j = 0; j <= rings; j++) {
    const h = j / rings                         // 0 at the top edge, 1 at the table
    const y = CAP_H / 2 - 0.02 - h * (CAP_H - 0.02)
    const flare = TOP_RATIO + (1 - TOP_RATIO) * Math.pow(h, 0.7)
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      // Pleats grow towards the bottom edge, rounded crests and sharp folds
      const wave = Math.pow(Math.abs(Math.cos((a * PLEATS) / 2)), 0.6) * 2 - 1
      const r = radius * (flare + PLEAT_DEPTH * Math.pow(h, 0.8) * (wave * 0.5 + 0.5) - PLEAT_DEPTH * 0.25 * h)
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r)
      uv.push(i / segs, 1 - h)
    }
  }
  const row = segs + 1
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * row + i
      const b = a + row
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Metal glints on the crimp: bright on the pleat crests, shadowed in the folds. */
function createSkirtTexture(color) {
  const w = 1024
  const h = 64
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < PLEATS; i++) {
    const x = (i / PLEATS) * w
    const pw = w / PLEATS
    const g = ctx.createLinearGradient(x, 0, x + pw, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.45)')
    g.addColorStop(0.25, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.28)')
    g.addColorStop(0.75, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, pw, h)
  }
  // The bare metal showing along the very bottom of the crimp
  const edge = ctx.createLinearGradient(0, 0, 0, h)
  edge.addColorStop(0, 'rgba(255,255,255,0)')
  edge.addColorStop(0.78, 'rgba(255,255,255,0)')
  edge.addColorStop(0.86, 'rgba(225,228,235,0.9)')
  edge.addColorStop(1, 'rgba(150,155,165,0.95)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The printed top: paint and pattern, a thin printed ring near the edge, then badge and number. */
function createTopTexture(color, edgeColor, badge, number, pattern, capText = '') {
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  const body = createBodyTexture(color, edgeColor, pattern, size).image
  ctx.drawImage(body, 0, 0)
  // Printed ring near the rim, like the lettering band on a real crown cap
  ctx.strokeStyle = edgeColor === color ? 'rgba(255,255,255,0.55)' : edgeColor
  ctx.lineWidth = size * 0.025
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.43, 0, Math.PI * 2)
  ctx.stroke()
  // The team's own text, arched over the top inside the printed ring
  const text = (capText || '').trim().toUpperCase()
  if (text) {
    const fontPx = size * 0.09
    ctx.save()
    ctx.font = `italic 900 ${fontPx}px 'Barlow Condensed', 'Impact', 'Arial Narrow', sans-serif`
    ctx.fillStyle = edgeColor === color ? '#ffffff' : edgeColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const R = size * 0.27 // well inside the printed ring (0.43), so the letters never touch it
    const widths = [...text].map((ch) => ctx.measureText(ch).width)
    const total = widths.reduce((a, w) => a + w, 0)
    const span = Math.min(Math.PI * 0.95, total / R)
    let a = -Math.PI / 2 - span / 2
    const k2 = span / (total || 1)
    ;[...text].forEach((ch, i) => {
      const w = widths[i] * k2
      const mid = a + w / 2
      ctx.save()
      ctx.translate(size / 2 + Math.cos(mid) * R, size / 2 + Math.sin(mid) * R)
      ctx.rotate(mid + Math.PI / 2)
      ctx.fillText(ch, 0, 0)
      ctx.restore()
      a += w
    })
    ctx.restore()
  }
  // Badge and number, the size of the old centre plate (a little lower under text)
  const plate = createDomeTexture(color, edgeColor, badge, number, size, { bare: true }).image
  const k = text ? 0.56 : 0.78
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, (size * k) / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(plate, (size * (1 - k)) / 2, (size * (1 - k)) / 2 + (text ? size * 0.08 : 0), size * k, size * k)
  ctx.restore()
  // A soft sheen across the top
  const sheen = ctx.createRadialGradient(size * 0.36, size * 0.3, 0, size / 2, size / 2, size / 2)
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Finish presets
const FINISH_MAP = {
  matte:  { metalness: 0.2, roughness: 0.7, emissiveIntensity: 0.03, envMapIntensity: 0.5 },
  satin:  { metalness: 0.35, roughness: 0.45, emissiveIntensity: 0.05, envMapIntensity: 0.7 },
  gloss:  { metalness: 0.5, roughness: 0.18, emissiveIntensity: 0.07, envMapIntensity: 0.9 },
  chrome: { metalness: 0.92, roughness: 0.05, emissiveIntensity: 0.08, envMapIntensity: 1.3 },
}

// 0 (black) .. 1 (white): how light a #rrggbb colour looks
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || '')
  if (!m) return 0
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

// Create canvas texture for the center dome (badge + number + pattern hint)
function createDomeTexture(color, edgeColor, badge, number, size = 256, { bare = false } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  // Base — match body color (skipped when drawn over a patterned cap top)
  if (!bare) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  }

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
  const bs = number != null ? r * 0.26 : r * 0.38
  const badgeY = number != null ? cy - r * 0.42 : cy
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

  // Squad number: big and outlined so it reads from the match camera
  if (number != null) {
    const withBadge = badge && badge !== 'none'
    const numY = withBadge ? cy + bs * 0.62 : cy + r * 0.04
    const size = withBadge ? r * 0.7 : r * 1.05
    const light = luminance(color) > 0.55
    ctx.font = `900 ${size}px 'Barlow Condensed', 'Impact', 'Arial Narrow', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.14
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)'
    ctx.strokeText(String(number), cx, numY)
    ctx.fillStyle = light ? '#111111' : '#ffffff'
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
    case 'wave':
      ctx.fillStyle = `${edgeColor}CC`
      ctx.beginPath()
      ctx.moveTo(0, cy + r * 0.15)
      ctx.bezierCurveTo(cx - r * 0.4, cy - r * 0.55, cx + r * 0.2, cy + r * 0.55, size, cy - r * 0.2)
      ctx.lineTo(size, size)
      ctx.lineTo(0, size)
      ctx.closePath()
      ctx.fill()
      break
    case 'rays': {
      ctx.fillStyle = patColor
      const n = 12
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2
        const a1 = a0 + Math.PI / n
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a0) * r * 1.5, cy + Math.sin(a0) * r * 1.5)
        ctx.lineTo(cx + Math.cos(a1) * r * 1.5, cy + Math.sin(a1) * r * 1.5)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
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

const CapMesh = forwardRef(function CapMesh({ color, edgeColor, isGk, isSelected, badge, number, pattern, finish, capText }, ref) {
  const radius = isGk ? GK_RADIUS : CAP_RADIUS
  const ringRef = useRef()
  const fp = FINISH_MAP[finish] || FINISH_MAP.matte
  const topR = radius * TOP_RATIO
  const edge = edgeColor || color

  const topTexture = useMemo(
    () => createTopTexture(color, edge, badge, number, pattern, capText),
    [color, edge, badge, number, pattern, capText]
  )
  const skirtTexture = useMemo(() => createSkirtTexture(color), [color])
  const skirt = useMemo(() => createSkirtGeometry(radius), [radius])

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 1.5
      ringRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.06)
    }
  })

  const halfH = CAP_H / 2
  // Painted tin: a little metal always shows through, more on gloss and chrome finishes
  const metal = Math.max(0.35, fp.metalness)
  const rough = Math.min(0.5, fp.roughness)

  return (
    <group ref={ref} position={[0, halfH, 0]}>
      {/* Crimped skirt */}
      <mesh geometry={skirt} castShadow receiveShadow>
        <meshStandardMaterial map={skirtTexture} metalness={metal} roughness={rough} envMapIntensity={fp.envMapIntensity} side={THREE.DoubleSide} />
      </mesh>

      {/* Rounded shoulder where the top meets the skirt */}
      <mesh position={[0, halfH - 0.02, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[topR, 0.022, 8, 64]} />
        <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
      </mesh>

      {/* Printed top, very slightly domed */}
      <mesh position={[0, halfH - 0.03, 0]} scale={[1, 0.08, 1]}>
        <sphereGeometry args={[topR, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
      </mesh>
      <mesh position={[0, halfH - 0.03 + topR * 0.08 + 0.002, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[topR * 0.985, 64]} />
        <meshStandardMaterial
          map={topTexture}
          metalness={metal * 0.8}
          roughness={rough}
          emissive={color}
          emissiveIntensity={fp.emissiveIntensity * 0.5}
          envMapIntensity={fp.envMapIntensity}
        />
      </mesh>

      {/* Dark inside of the cap, seen only at the very bottom edge */}
      <mesh position={[0, -halfH + 0.006, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[radius * 0.98, 48]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Selection ring — animated glow on the table */}
      {isSelected && (
        <mesh ref={ringRef} position={[0, -halfH + 0.015, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[radius + 0.1, radius + 0.27, 36]} />
          <meshBasicMaterial color="#FFD740" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Keeper: a printed hexagon round the centre */}
      {isGk && (
        <mesh position={[0, halfH - 0.03 + topR * 0.08 + 0.004, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[topR * 0.8, topR * 0.86, 6]} />
          <meshBasicMaterial color={edge === color ? '#FFD700' : edge} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  )
})

export default CapMesh
