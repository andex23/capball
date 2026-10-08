/**
 * The world around the board. CapBall is a tabletop game, so every venue is
 * a table somewhere:
 *   arena  — Game Room: a glossy black table with LED trim, neon signs, trophies, an arcade cabinet
 *   table  — Kitchen Table: a wooden table, tiled floor, cupboards, a mug, spare caps, the score pad
 *   street — Street Corner: a folding table on the pavement at night, graffiti walls, street lamps
 *   gravel — Garden Table: a picnic table on the patio at sunset, string lights, trees, hills
 *
 * Simple geometry and small canvas textures made once per venue, with
 * repeated pieces instanced, so it stays light enough for phones.
 */
import { useMemo, useLayoutEffect, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* ── Small helpers ───────────────────────────────────── */

function rand(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(w, h, paint, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeat[0] !== 1 || repeat[1] !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  t.anisotropy = 4
  return t
}

function speckle(ctx, w, h, n, colors, r, rnd, maxR = r) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]
    const rr = r + rnd() * (maxR - r)
    ctx.beginPath()
    ctx.arc(rnd() * w, rnd() * h, rr, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Many copies of one mesh, placed from a list of { x, y, z, sx?, sy?, sz?, ry?, color? }. */
function Instances({ items, children, castShadow = false }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const e = new THREE.Euler()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0))
      m.compose(p.set(it.x, it.y, it.z), q, s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1))
      mesh.setMatrixAt(i, m)
      if (it.color) mesh.setColorAt(i, c.set(it.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[null, null, items.length]} castShadow={castShadow} frustumCulled={false}>
      {children}
    </instancedMesh>
  )
}

/** Fog and background follow the venue (the canvas outlives a match). */
export function VenueSky({ color, fogColor, fogDensity }) {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color(color)
    scene.fog = new THREE.FogExp2(fogColor, fogDensity)
  }, [scene, color, fogColor, fogDensity])
  return null
}

/** A glowing light head: a bright core and a soft halo that ignores fog. */
function Glow({ position, color = '#fff3d0', size = 0.6, halo = 2.4, opacity = 0.35 }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 12, 10]} />
        <meshBasicMaterial color={color} fog={false} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[halo, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ── Reused textures and props ──────────────────── */

function woodTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const rnd = rand(7)
    // Planks
    const planks = 6
    for (let p = 0; p < planks; p++) {
      const y0 = (p * h) / planks
      const base = 30 + rnd() * 10
      ctx.fillStyle = `hsl(${base}, 48%, ${30 + rnd() * 6}%)`
      ctx.fillRect(0, y0, w, h / planks)
      // grain
      for (let g = 0; g < 40; g++) {
        ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '40,20,5' : '255,220,170'},${0.05 + rnd() * 0.08})`
        ctx.lineWidth = 0.6 + rnd() * 1.6
        ctx.beginPath()
        const yy = y0 + rnd() * (h / planks)
        ctx.moveTo(0, yy)
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, yy + Math.sin(x * 0.01 + g) * 2.5 + (rnd() - 0.5) * 1.5)
        ctx.stroke()
      }
      // a knot or two
      for (let k = 0; k < 2; k++) {
        const kx = rnd() * w
        const ky = y0 + h / planks / 2 + (rnd() - 0.5) * 20
        for (let r = 12; r > 2; r -= 3) {
          ctx.strokeStyle = 'rgba(50,25,8,0.25)'
          ctx.beginPath()
          ctx.ellipse(kx, ky, r * 2.2, r * 0.7, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.fillStyle = 'rgba(20,10,2,0.6)'
      ctx.fillRect(0, y0, w, 2)
    }
  }, { repeat: [3, 3] })
}

function notepadTexture() {
  return canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#f6f1df'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(60,120,200,0.35)'
    for (let y = 40; y < h; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    ctx.strokeStyle = 'rgba(220,60,60,0.5)'
    ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(34, h); ctx.stroke()
    ctx.fillStyle = '#25324a'
    ctx.font = 'bold 26px "Comic Sans MS", cursive'
    ctx.fillText('HOME', 50, 58)
    ctx.fillText('AWAY', 150, 58)
    // tally marks
    ctx.strokeStyle = '#25324a'
    ctx.lineWidth = 3
    const tally = (x, y, n) => {
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(x + i * 9, y); ctx.lineTo(x + i * 9, y + 26); ctx.stroke() }
    }
    tally(56, 84, 4); tally(156, 84, 2); tally(56, 128, 3); tally(156, 128, 5)
  })
}

function Mug({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.05, 2.6, 28, 1, true]} />
        <meshStandardMaterial color="#e9e2d0" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.1, 28]} />
        <meshStandardMaterial color="#e9e2d0" roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.25, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.1, 28]} />
        <meshStandardMaterial color="#3b1f10" roughness={0.15} />
      </mesh>
      <mesh position={[1.25, 1.35, 0]}>
        <torusGeometry args={[0.6, 0.14, 10, 20, Math.PI * 1.25]} />
        <meshStandardMaterial color="#e9e2d0" roughness={0.35} />
      </mesh>
    </group>
  )
}

function SpareCaps({ position }) {
  const caps = useMemo(() => {
    const rnd = rand(5)
    const cols = ['#d32f2f', '#1565c0', '#ffd700', '#2e7d32', '#ffffff', '#7b1fa2', '#e65100']
    return Array.from({ length: 9 }, (_, i) => ({
      x: (rnd() - 0.5) * 3.2,
      y: 0.12 + (i > 5 ? 0.22 : 0),
      z: (rnd() - 0.5) * 2.4,
      rx: (rnd() - 0.5) * 0.3,
      rz: (rnd() - 0.5) * 0.3,
      color: cols[i % cols.length],
    }))
  }, [])
  return (
    <group position={position}>
      <Instances items={caps} castShadow>
        <cylinderGeometry args={[0.72, 0.75, 0.22, 24]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} />
      </Instances>
    </group>
  )
}

function asphaltTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const rnd = rand(21)
    ctx.fillStyle = '#2a2b2f'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 9000, ['#3a3b40', '#1f2023', '#46474c', '#26272b'], 0.5, rnd, 1.6)
    // patches and stains
    for (let i = 0; i < 6; i++) {
      const g = ctx.createRadialGradient(rnd() * w, rnd() * h, 2, rnd() * w, rnd() * h, 40 + rnd() * 50)
      g.addColorStop(0, 'rgba(0,0,0,0.18)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  }, { repeat: [14, 14] })
}

const GRAFFITI = ['CAP', 'FLICK', 'GOAL', 'KICK', 'BALLER', 'TOP BIN']
function wallTexture(seed) {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    const rnd = rand(seed)
    // bricks
    ctx.fillStyle = '#4a2a22'
    ctx.fillRect(0, 0, w, h)
    for (let row = 0; row < h / 16; row++) {
      for (let col = -1; col < w / 40 + 1; col++) {
        const x = col * 40 + (row % 2 ? 20 : 0)
        const l = 22 + rnd() * 10
        ctx.fillStyle = `hsl(${8 + rnd() * 10}, 40%, ${l}%)`
        ctx.fillRect(x + 1, row * 16 + 1, 38, 14)
      }
    }
    // graffiti: fat outlined letters in bright colours
    const cols = ['#ff4081', '#00e5ff', '#ffea00', '#76ff03', '#ff9100', '#e040fb']
    let x = 30
    while (x < w - 100) {
      const word = GRAFFITI[Math.floor(rnd() * GRAFFITI.length)]
      const size = 70 + rnd() * 50
      ctx.save()
      ctx.translate(x, 150 + (rnd() - 0.5) * 60)
      ctx.rotate((rnd() - 0.5) * 0.25)
      ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`
      ctx.lineJoin = 'round'
      ctx.lineWidth = 14
      ctx.strokeStyle = '#111'
      ctx.strokeText(word, 0, 0)
      const g = ctx.createLinearGradient(0, -size, 0, 0)
      g.addColorStop(0, cols[Math.floor(rnd() * cols.length)])
      g.addColorStop(1, cols[Math.floor(rnd() * cols.length)])
      ctx.fillStyle = g
      ctx.fillText(word, 0, 0)
      ctx.lineWidth = 3
      ctx.strokeStyle = '#fff'
      ctx.strokeText(word, 0, 0)
      x += ctx.measureText(word).width + 50 + rnd() * 80
      ctx.restore()
    }
  })
}

function Cone({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1, 0.2, 1]} />
        <meshStandardMaterial color="#ff6d00" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <coneGeometry args={[0.42, 1.6, 16]} />
        <meshStandardMaterial color="#ff6d00" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.25, 16, 1, true]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.4} />
      </mesh>
    </group>
  )
}

function skyTexture() {
  return canvasTexture(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#1b1f4a')
    g.addColorStop(0.32, '#4b3a78')
    g.addColorStop(0.42, '#a8577a')
    g.addColorStop(0.47, '#f08a5d')
    g.addColorStop(0.5, '#ffc27a')
    g.addColorStop(0.52, '#c97a50')
    g.addColorStop(1, '#3a2a1e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

/* ── Scale ───────────────────────────────────────────────
   The board is a tabletop game: about 1.2 m long, so 1 m ≈ 25 world units.
   Each venue is a table (in world units, its top just under the board) in a
   room or a spot outdoors built in metres inside a group scaled by M. */

const M = 25
const TABLE_TOP = -0.3          // the board sits on this
const TABLE_H = 19              // ~75 cm
const FLOOR = TABLE_TOP - TABLE_H

/** A room built in metres, standing on the floor. */
function InMetres({ children }) {
  return <group position={[0, FLOOR, 0]} scale={M}>{children}</group>
}

/** A box with one textured face (+z by default) and plain sides. */
function Panel({ args, position, rotation, map, color = '#222', face = 4, emissive = false, roughness = 0.9 }) {
  const mats = [0, 1, 2, 3, 4, 5].map((i) => (i === face && map
    ? (emissive
      ? <meshBasicMaterial key={i} attach={`material-${i}`} map={map} toneMapped={false} />
      : <meshStandardMaterial key={i} attach={`material-${i}`} map={map} roughness={roughness} />)
    : <meshStandardMaterial key={i} attach={`material-${i}`} color={color} roughness={roughness} />))
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      {mats}
    </mesh>
  )
}

/** Four walls of a room (metres), each a plain colour or a texture. */
function Walls({ w, d, h, color, maps = {} }) {
  return (
    <group>
      <Panel args={[w, h, 0.1]} position={[0, h / 2, -d / 2]} map={maps.back} color={color} face={4} />
      <Panel args={[w, h, 0.1]} position={[0, h / 2, d / 2]} map={maps.front} color={color} face={5} />
      <Panel args={[0.1, h, d]} position={[-w / 2, h / 2, 0]} map={maps.left} color={color} face={0} />
      <Panel args={[0.1, h, d]} position={[w / 2, h / 2, 0]} map={maps.right} color={color} face={1} />
    </group>
  )
}

/* ── Textures ──────────────────────────────────────── */

function tilesTexture(a, b, grout = 'rgba(0,0,0,0.25)') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const n = 4
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b
      ctx.fillRect((x * w) / n, (y * h) / n, w / n, h / n)
    }
    ctx.strokeStyle = grout
    ctx.lineWidth = 2
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / n, 0); ctx.lineTo((i * w) / n, h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, (i * h) / n); ctx.lineTo(w, (i * h) / n); ctx.stroke()
    }
    speckle(ctx, w, h, 900, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], 0.6, rand(4), 1.6)
  }, { repeat: [5, 5] })
}

function pavingTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = rand(8)
    ctx.fillStyle = '#6d6a66'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const l = 36 + rnd() * 8
      ctx.fillStyle = `hsl(30, 5%, ${l}%)`
      ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60)
    }
    speckle(ctx, w, h, 2500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.06)'], 0.5, rnd, 1.5)
  }, { repeat: [16, 16] })
}

function carpetTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1b1830'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(120,90,255,0.10)'
    ctx.lineWidth = 3
    for (let i = -h; i < w; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke() }
    speckle(ctx, w, h, 4000, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.04)'], 0.5, rand(12), 1.2)
  }, { repeat: [8, 8] })
}

function neonTexture(text, color, w = 512, h = 128) {
  return canvasTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h)
    ctx.font = `italic 900 ${Math.round(h * 0.62)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = color
    ctx.shadowBlur = 24
    ctx.strokeStyle = color
    ctx.lineWidth = 6
    ctx.strokeText(text, w / 2, h / 2)
    ctx.shadowBlur = 8
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeText(text, w / 2, h / 2)
  })
}

function posterTexture(seed) {
  return canvasTexture(128, 180, (ctx, w, h) => {
    const rnd = rand(seed)
    const cols = ['#e53935', '#1e88e5', '#ffd740', '#43a047', '#8e24aa', '#fb8c00', '#ffffff']
    ctx.fillStyle = cols[Math.floor(rnd() * cols.length)]
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)]
      ctx.beginPath()
      ctx.arc(rnd() * w, rnd() * h, 20 + rnd() * 40, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.font = 'italic 900 26px "Barlow Condensed", sans-serif'
    ctx.fillText(['CUP', 'FINAL', 'DERBY', 'LEAGUE'][seed % 4], 10, h - 16)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 8
    ctx.strokeRect(0, 0, w, h)
  })
}

function plankTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const rnd = rand(19)
    const n = 6
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `hsl(${26 + rnd() * 8}, 38%, ${34 + rnd() * 8}%)`
      ctx.fillRect(0, (i * h) / n, w, h / n - 5)
      for (let g = 0; g < 14; g++) {
        ctx.strokeStyle = `rgba(40,20,5,${0.06 + rnd() * 0.08})`
        ctx.beginPath()
        const y = (i * h) / n + rnd() * (h / n - 6)
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(w / 3, y + (rnd() - 0.5) * 6, (2 * w) / 3, y + (rnd() - 0.5) * 6, w, y)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(20,10,3,0.85)'
      ctx.fillRect(0, ((i + 1) * h) / n - 5, w, 5)
    }
  })
}

/* ── Tables (world units) ──────────────────────────── */

const TOP_W = 46
const TOP_D = 34

function TableTop({ map, color, roughness = 0.5, metalness = 0.05, thick = 1, edge }) {
  return (
    <group>
      <mesh position={[0, TABLE_TOP - thick / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[TOP_W, thick, TOP_D]} />
        <meshStandardMaterial map={map} color={map ? '#ffffff' : color} roughness={roughness} metalness={metalness} />
      </mesh>
      {edge}
    </group>
  )
}

function Legs({ color = '#3a2414', size = 2, inset = 3, metal = false }) {
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
    <mesh key={`${sx}${sz}`} position={[sx * (TOP_W / 2 - inset), FLOOR + TABLE_H / 2 - 0.5, sz * (TOP_D / 2 - inset)]}>
      {metal ? <cylinderGeometry args={[size / 2, size / 2, TABLE_H - 1, 10]} /> : <boxGeometry args={[size, TABLE_H - 1, size]} />}
      <meshStandardMaterial color={color} roughness={metal ? 0.35 : 0.6} metalness={metal ? 0.8 : 0} />
    </mesh>
  ))
}

/* ── Kitchen table ─────────────────────────────────── */

function Chair({ position, rotation = 0, color = '#7a4b28' }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.45, 0]}><boxGeometry args={[0.45, 0.05, 0.45]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      <mesh position={[0, 0.72, 0.2]}><boxGeometry args={[0.45, 0.5, 0.05]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * 0.19, 0.22, z * 0.19]}><boxGeometry args={[0.04, 0.45, 0.04]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      ))}
    </group>
  )
}

function KitchenRoom() {
  const floor = useMemo(() => tilesTexture('#d9cbb0', '#9e5b3c'), [])
  return (
    <InMetres>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[9, 8]} />
        <meshStandardMaterial map={floor} roughness={0.7} />
      </mesh>
      <Walls w={9} d={8} h={2.8} color="#e8dcc0" />
      {/* Wainscot */}
      {[[0, -3.94, 0], [0, 3.94, 0]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]}><boxGeometry args={[9, 1, 0.04]} /><meshStandardMaterial color="#6b4a2c" roughness={0.6} /></mesh>
      ))}
      {/* Counter and cupboards along the back wall */}
      <mesh position={[0.5, 0.45, -3.6]}><boxGeometry args={[5, 0.9, 0.6]} /><meshStandardMaterial color="#5c7a6e" roughness={0.6} /></mesh>
      <mesh position={[0.5, 0.92, -3.6]}><boxGeometry args={[5.05, 0.05, 0.65]} /><meshStandardMaterial color="#e0dcd4" roughness={0.3} /></mesh>
      <mesh position={[0.5, 2.0, -3.75]}><boxGeometry args={[5, 0.75, 0.35]} /><meshStandardMaterial color="#5c7a6e" roughness={0.6} /></mesh>
      {[-1.5, -0.25, 1, 2.25].map((x) => (
        <mesh key={x} position={[x + 0.25, 0.45, -3.29]}><boxGeometry args={[1.1, 0.75, 0.02]} /><meshStandardMaterial color="#6e8d80" roughness={0.5} /></mesh>
      ))}
      {/* Fridge */}
      <mesh position={[-2.9, 0.9, -3.55]}><boxGeometry args={[0.8, 1.8, 0.7]} /><meshStandardMaterial color="#f1f1ee" roughness={0.3} /></mesh>
      {/* Window with a night sky */}
      <mesh position={[3.1, 1.6, -3.94]}><planeGeometry args={[1.4, 1]} /><meshBasicMaterial color="#1c2a4a" /></mesh>
      <mesh position={[3.1, 1.6, -3.93]}><boxGeometry args={[1.5, 0.06, 0.03]} /><meshStandardMaterial color="#f4efe6" /></mesh>
      <mesh position={[3.1, 1.6, -3.93]}><boxGeometry args={[0.06, 1.1, 0.03]} /><meshStandardMaterial color="#f4efe6" /></mesh>
      {/* Pendant lamp, high over the table */}
      <mesh position={[0, 2.55, 0]}><cylinderGeometry args={[0.005, 0.005, 0.5, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 2.25, 0]}><coneGeometry args={[0.25, 0.2, 24, 1, true]} /><meshStandardMaterial color="#c0392b" roughness={0.4} side={THREE.DoubleSide} /></mesh>
      <Glow position={[0, 2.18, 0]} size={0.05} halo={0.16} opacity={0.4} color="#ffe2a8" />
      <Chair position={[0, 0, -0.95]} />
      <Chair position={[0, 0, 0.95]} rotation={Math.PI} />
      <Chair position={[-1.15, 0, 0]} rotation={-Math.PI / 2} />
    </InMetres>
  )
}

function KitchenTable() {
  const wood = useMemo(woodTexture, [])
  const note = useMemo(notepadTexture, [])
  return (
    <group>
      <TableTop map={wood} roughness={0.45} />
      <Legs color="#4a2e18" />
      <Mug position={[-19, TABLE_TOP, -13.5]} />
      <SpareCaps position={[19, TABLE_TOP, 13.5]} />
      <group position={[19.5, TABLE_TOP + 0.02, -13]} rotation-y={0.25}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[4.2, 5.4]} /><meshStandardMaterial map={note} roughness={0.9} /></mesh>
        <mesh position={[2.6, 0.12, 0.3]} rotation-z={Math.PI / 2} rotation-y={0.5}><cylinderGeometry args={[0.1, 0.1, 5, 6]} /><meshStandardMaterial color="#f2b632" roughness={0.5} /></mesh>
      </group>
      <KitchenRoom />
    </group>
  )
}

/* ── Game room ─────────────────────────────────────── */

function Trophy({ position, s = 1 }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.04, 0]}><boxGeometry args={[0.12, 0.08, 0.12]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.015, 0.025, 0.12, 8]} /><meshStandardMaterial color="#d4a017" metalness={0.9} roughness={0.25} /></mesh>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.07, 0.03, 0.12, 16]} /><meshStandardMaterial color="#e8b923" metalness={0.9} roughness={0.2} /></mesh>
    </group>
  )
}

function GameRoom() {
  const carpet = useMemo(carpetTexture, [])
  const neonA = useMemo(() => neonTexture('CAPBALL', '#ff2bd6'), [])
  const neonB = useMemo(() => neonTexture('FLICK IT', '#00e5ff'), [])
  const posters = useMemo(() => [1, 2, 3].map(posterTexture), [])
  return (
    <InMetres>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      <Walls w={10} d={8} h={3} color="#141a33" />
      {/* Neon signs */}
      <mesh position={[0, 2.1, -3.93]}><planeGeometry args={[2.4, 0.6]} /><meshBasicMaterial map={neonA} transparent toneMapped={false} /></mesh>
      <mesh position={[-4.93, 2.0, -0.5]} rotation-y={Math.PI / 2}><planeGeometry args={[2, 0.5]} /><meshBasicMaterial map={neonB} transparent toneMapped={false} /></mesh>
      {/* LED strip round the skirting */}
      {[[0, -3.93, 10, 0], [0, 3.93, 10, 0]].map(([x, z, l], i) => (
        <mesh key={i} position={[x, 0.08, z]}><boxGeometry args={[l, 0.02, 0.02]} /><meshBasicMaterial color="#7c4dff" toneMapped={false} /></mesh>
      ))}
      {/* Posters */}
      {posters.map((p, i) => (
        <mesh key={i} position={[4.93, 1.7, -1.5 + i * 1.3]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.7, 1]} /><meshStandardMaterial map={p} roughness={0.6} /></mesh>
      ))}
      {/* Trophy shelf */}
      <mesh position={[2.4, 1.3, -3.85]}><boxGeometry args={[2, 0.05, 0.25]} /><meshStandardMaterial color="#3b2a1a" /></mesh>
      {[1.7, 2.2, 2.7, 3.1].map((x, i) => <Trophy key={x} position={[x, 1.33, -3.85]} s={i === 1 ? 1.4 : 1} />)}
      {/* Arcade cabinet */}
      <group position={[-3.6, 0, -3.4]}>
        <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.7, 1.7, 0.7]} /><meshStandardMaterial color="#1d1d2b" roughness={0.5} /></mesh>
        <mesh position={[0, 1.25, 0.36]} rotation-x={-0.2}><planeGeometry args={[0.55, 0.42]} /><meshBasicMaterial color="#2bd9ff" toneMapped={false} /></mesh>
        <mesh position={[0, 1.62, 0.36]}><planeGeometry args={[0.6, 0.14]} /><meshBasicMaterial color="#ff2bd6" toneMapped={false} /></mesh>
      </group>
      {/* Bean bags */}
      {[[-3.2, 2.6, '#e53935'], [3.4, 2.8, '#1e88e5']].map(([x, z, c]) => (
        <mesh key={c} position={[x, 0.25, z]} scale={[1, 0.55, 1]}><sphereGeometry args={[0.45, 20, 14]} /><meshStandardMaterial color={c} roughness={0.8} /></mesh>
      ))}
      <Glow position={[0, 2.7, 0]} size={0.06} halo={0.25} opacity={0.25} color="#cfd8ff" />
    </InMetres>
  )
}

function GameTable() {
  return (
    <group>
      <TableTop color="#2b2f3a" roughness={0.22} metalness={0.5} thick={1.4} />
      {/* LED strip under the lip */}
      {[[0, TOP_D / 2 + 0.05, TOP_W, 0], [0, -TOP_D / 2 - 0.05, TOP_W, 0]].map(([x, z, l], i) => (
        <mesh key={i} position={[x, TABLE_TOP - 1.3, z]}><boxGeometry args={[l, 0.25, 0.1]} /><meshBasicMaterial color="#00e5ff" toneMapped={false} /></mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (TOP_W / 2 + 0.05), TABLE_TOP - 1.3, 0]}><boxGeometry args={[0.1, 0.25, TOP_D]} /><meshBasicMaterial color="#00e5ff" toneMapped={false} /></mesh>
      ))}
      {/* Pedestal base */}
      <mesh position={[0, FLOOR + TABLE_H / 2, 0]}><boxGeometry args={[TOP_W - 12, TABLE_H - 1.4, TOP_D - 12]} /><meshStandardMaterial color="#0c0e13" roughness={0.4} metalness={0.4} /></mesh>
      <Trophy position={[-19.5, TABLE_TOP, -13]} s={M * 0.3} />
      {/* A couple of drinks cans */}
      {[[19, 13, '#e53935'], [21, 11.5, '#1e88e5']].map(([x, z, c]) => (
        <mesh key={c} position={[x, TABLE_TOP + 1.5, z]}><cylinderGeometry args={[0.85, 0.85, 3, 20]} /><meshStandardMaterial color={c} metalness={0.7} roughness={0.25} /></mesh>
      ))}
      <GameRoom />
    </group>
  )
}

/* ── Street corner ─────────────────────────────────── */

function StreetLampM({ position, facing }) {
  return (
    <group position={position} rotation-y={facing}>
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.05, 0.08, 5, 8]} /><meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 5, 0.4]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.03, 0.03, 0.9, 6]} /><meshStandardMaterial color="#2f3540" /></mesh>
      <Glow position={[0, 4.92, 0.85]} size={0.1} halo={0.6} opacity={0.25} color="#ffb85c" />
    </group>
  )
}

function StreetCorner() {
  const paving = useMemo(pavingTexture, [])
  const asphalt = useMemo(asphaltTexture, [])
  const wallA = useMemo(() => wallTexture(41), [])
  const wallB = useMemo(() => wallTexture(42), [])
  const sky = useMemo(() => canvasTexture(8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#060814'); g.addColorStop(0.45, '#151a33'); g.addColorStop(0.5, '#3b2a40'); g.addColorStop(1, '#0b0b10')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  }), [])
  return (
    <group>
      {/* Night sky, inside the far plane */}
      <mesh><sphereGeometry args={[185, 24, 12]} /><meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} /></mesh>
      <InMetres>
        {/* Pavement, kerb and road */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, -0.5]} receiveShadow><planeGeometry args={[14, 7]} /><meshStandardMaterial map={paving} roughness={0.95} /></mesh>
        <mesh position={[0, 0.06, 3]}><boxGeometry args={[14, 0.12, 0.25]} /><meshStandardMaterial color="#8d8a86" roughness={0.9} /></mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 6.5]}><planeGeometry args={[30, 7]} /><meshStandardMaterial map={asphalt} roughness={0.95} /></mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 6.5]}><planeGeometry args={[30, 0.12]} /><meshBasicMaterial color="#d9c84a" /></mesh>
        {/* Graffiti walls behind and to the side */}
        <Panel args={[14, 4, 0.3]} position={[0, 2, -4]} map={wallA} color="#3a2019" face={4} />
        <Panel args={[0.3, 4, 7]} position={[-7, 2, -0.5]} map={wallB} color="#3a2019" face={1} />
        <StreetLampM position={[4.5, 0, 2.7]} facing={Math.PI} />
        <StreetLampM position={[-4.5, 0, 2.7]} facing={Math.PI} />
        {/* Crates for stools, a few cones, tyres */}
        {[[-1.25, 0], [1.25, 0.2]].map(([x, z]) => (
          <mesh key={x} position={[x, 0.17, z]}><boxGeometry args={[0.4, 0.34, 0.4]} /><meshStandardMaterial color="#1565c0" roughness={0.7} /></mesh>
        ))}
        <group scale={0.3}>
          <Cone position={[8, 0, 7.3]} />
          <Cone position={[9.6, 0, 8]} />
          <Cone position={[-10.6, 0, -8]} />
        </group>
        {[0, 0.2].map((y, i) => (
          <mesh key={i} position={[-5.8, 0.1 + y, -3.3]} rotation-x={Math.PI / 2}><torusGeometry args={[0.33, 0.12, 10, 20]} /><meshStandardMaterial color="#141416" roughness={0.9} /></mesh>
        ))}
      </InMetres>
    </group>
  )
}

function FoldingTable() {
  return (
    <group>
      <TableTop color="#e9e9e4" roughness={0.75} thick={1.2} />
      {/* X-frame legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (TOP_W / 2 - 5), FLOOR + TABLE_H / 2, 0]}>
          {[-1, 1].map((k) => (
            <mesh key={k} rotation-x={k * 0.75}><cylinderGeometry args={[0.45, 0.45, TABLE_H * 1.35, 8]} /><meshStandardMaterial color="#9aa1aa" metalness={0.8} roughness={0.3} /></mesh>
          ))}
        </group>
      ))}
      {[[17, 12, '#e53935'], [19.5, 13.5, '#43a047']].map(([x, z, c]) => (
        <mesh key={c} position={[x, TABLE_TOP + 1.5, z]}><cylinderGeometry args={[0.85, 0.85, 3, 20]} /><meshStandardMaterial color={c} metalness={0.7} roughness={0.25} /></mesh>
      ))}
      <StreetCorner />
    </group>
  )
}

/* ── Garden at sunset ──────────────────────────────── */

function grassTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = rand(66)
    ctx.fillStyle = '#4c6b2c'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 6000, ['#5b7d35', '#3e5a24', '#6a8a3e', '#45632a'], 0.6, rnd, 1.8)
  }, { repeat: [30, 30] })
}

function Garden() {
  const sky = useMemo(skyTexture, [])
  const grass = useMemo(grassTexture, [])
  const paving = useMemo(pavingTexture, [])
  const trees = useMemo(() => {
    const rnd = rand(91)
    const trunks = []
    const tops = []
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2
      const d = 4.2 + rnd() * 2.6
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const h = 1.2 + rnd() * 1.2
      const s = 0.7 + rnd() * 0.7
      trunks.push({ x, y: h / 2, z, sx: 1, sy: h, sz: 1 })
      tops.push({ x, y: h + s * 0.5, z, sx: s, sy: s * (0.8 + rnd() * 0.5), sz: s, ry: rnd() * 6, color: rnd() < 0.5 ? '#2f4a22' : '#3d5a28' })
    }
    return { trunks, tops }
  }, [])
  const hills = useMemo(() => {
    const rnd = rand(17)
    return Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + rnd() * 0.3
      const s = 1.2 + rnd() * 1.4
      return { x: Math.cos(a) * 7, y: -s * 0.5, z: Math.sin(a) * 7, sx: s * 2, sy: s, sz: s, color: '#2c2826' }
    })
  }, [])
  const bulbs = useMemo(() => {
    const out = []
    for (const z of [-1.6, 1.6]) {
      for (let i = 0; i <= 14; i++) {
        const t = i / 14
        out.push({ x: -2.6 + t * 5.2, y: 2.5 - Math.sin(t * Math.PI) * 0.35, z })
      }
    }
    return out
  }, [])
  return (
    <group>
      <mesh><sphereGeometry args={[185, 32, 16]} /><meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} /></mesh>
      <Glow position={[-120, 6, -120]} size={9} halo={20} opacity={0.25} color="#ffd59a" />
      <InMetres>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow><planeGeometry args={[16, 16]} /><meshStandardMaterial map={grass} roughness={1} /></mesh>
        <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[3.4, 2.8]} /><meshStandardMaterial map={paving} roughness={0.95} /></mesh>
        <Instances items={hills}><sphereGeometry args={[1, 16, 10]} /><meshBasicMaterial /></Instances>
        <Instances items={trees.trunks}><cylinderGeometry args={[0.06, 0.09, 1, 6]} /><meshStandardMaterial color="#4a3423" roughness={1} /></Instances>
        <Instances items={trees.tops}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={1} flatShading /></Instances>
        {/* Benches either side of the picnic table */}
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * 0.95]}>
            <mesh position={[0, 0.44, 0]}><boxGeometry args={[1.7, 0.05, 0.3]} /><meshStandardMaterial color="#8a6a45" roughness={0.9} /></mesh>
            {[-0.7, 0.7].map((x) => <mesh key={x} position={[x, 0.22, 0]}><boxGeometry args={[0.06, 0.44, 0.28]} /><meshStandardMaterial color="#7a5a3a" roughness={0.9} /></mesh>)}
          </group>
        ))}
        {/* Fence at the bottom of the garden */}
        {Array.from({ length: 21 }, (_, i) => (
          <mesh key={i} position={[-5 + i * 0.5, 0.5, -3.6]}><boxGeometry args={[0.08, 1, 0.04]} /><meshStandardMaterial color="#b49a78" roughness={1} /></mesh>
        ))}
        <mesh position={[0, 0.8, -3.62]}><boxGeometry args={[10.2, 0.08, 0.03]} /><meshStandardMaterial color="#a88d6a" roughness={1} /></mesh>
        {/* Pots */}
        {[[-1.4, -1.1, '#b5522e'], [1.5, 1.2, '#9c4a2a'], [1.6, -1.15, '#b5522e']].map(([x, z, c]) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.16, 0.12, 0.3, 14]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
            <mesh position={[0, 0.42, 0]}><icosahedronGeometry args={[0.24, 0]} /><meshStandardMaterial color="#3f6b2a" roughness={1} flatShading /></mesh>
          </group>
        ))}
        {/* String lights */}
        <Instances items={bulbs}><sphereGeometry args={[0.035, 8, 6]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></Instances>
      </InMetres>
    </group>
  )
}

function PicnicTable() {
  const planks = useMemo(plankTexture, [])
  return (
    <group>
      <TableTop map={planks} roughness={0.85} thick={1.2} />
      {/* A-frame legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (TOP_W / 2 - 6), FLOOR + TABLE_H / 2, 0]}>
          {[-1, 1].map((k) => (
            <mesh key={k} rotation-x={k * 0.42}><boxGeometry args={[1.4, TABLE_H * 1.1, 1.4]} /><meshStandardMaterial color="#7a5a3a" roughness={0.9} /></mesh>
          ))}
        </group>
      ))}
      {/* Lemonade and glasses */}
      <mesh position={[-19.5, TABLE_TOP + 2.5, -12.5]}>
        <cylinderGeometry args={[1.3, 1.5, 5, 20]} />
        <meshStandardMaterial color="#ffe27a" transparent opacity={0.55} roughness={0.1} />
      </mesh>
      {[[-16.5, -13.8], [-17.2, -11]].map(([x, z]) => (
        <mesh key={x} position={[x, TABLE_TOP + 1.2, z]}><cylinderGeometry args={[0.7, 0.6, 2.4, 16]} /><meshStandardMaterial color="#e0f4ff" transparent opacity={0.4} roughness={0.05} /></mesh>
      ))}
      <Garden />
    </group>
  )
}

/* ── Picking the venue ─────────────────────────────── */

export default function Venue({ stadium }) {
  switch (stadium) {
    case 'table': return <KitchenTable />
    case 'street': return <FoldingTable />
    case 'gravel': return <PicnicTable />
    default: return <GameTable />
  }
}
