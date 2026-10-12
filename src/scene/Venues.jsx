/**
 * The world around the board. Counterball is a tabletop game, so every venue is
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
    ctx.strokeText(text, w / 2, h / 2, w - 48)
    ctx.shadowBlur = 8
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeText(text, w / 2, h / 2, w - 48)
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

function TableTop({ map, color, tint = '#ffffff', roughness = 0.5, metalness = 0.05, thick = 1, edge }) {
  return (
    <group>
      <mesh position={[0, TABLE_TOP - thick / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[TOP_W, thick, TOP_D]} />
        <meshStandardMaterial map={map} color={map ? tint : color} roughness={roughness} metalness={metalness} />
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
  const neonA = useMemo(() => neonTexture('COUNTERBALL', '#ff2bd6'), [])
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

/* ── Bar counter ───────────────────────────────────── */

function mirrorTexture() {
  return canvasTexture(256, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, '#3a2c24'); g.addColorStop(0.4, '#6e625a'); g.addColorStop(0.55, '#8d8078'); g.addColorStop(1, '#3a2c24')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,230,190,0.10)'
    for (const x of [40, 70, 170, 215]) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x - 6, h); ctx.lineTo(x - 20, h); ctx.fill()
    }
  })
}

function dartboardTexture() {
  return canvasTexture(128, 128, (ctx, w) => {
    const c = w / 2
    const rings = [[62, '#151515'], [54, '#c62828'], [50, '#151515'], [34, '#2e7d32'], [30, '#151515'], [8, '#2e7d32'], [4, '#c62828']]
    for (const [r, col] of rings) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = 'rgba(240,225,190,0.9)'
    for (let i = 0; i < 20; i += 2) {
      const a0 = (i / 20) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, 50, a0, a0 + Math.PI / 10); ctx.closePath(); ctx.fill()
    }
    ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(c, c, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(c, c, 4, 0, Math.PI * 2); ctx.fill()
  })
}

function BarRoom() {
  const floor = useMemo(() => {
    const t = plankTexture()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(4, 8)
    return t
  }, [])
  const mirror = useMemo(mirrorTexture, [])
  const neonA = useMemo(() => neonTexture('CAPS', '#ff6a2b'), [])
  const neonB = useMemo(() => neonTexture('OPEN', '#ff2b8a'), [])
  const darts = useMemo(dartboardTexture, [])
  // Bottles on three glass shelves in front of the mirror
  const bottles = useMemo(() => {
    const rnd = rand(33)
    const glass = ['#a85d18', '#7a3e10', '#c98a2a', '#2f6b2a', '#3f8a3a', '#cfe2e4', '#e6eef0', '#6a1a22', '#2a4f7a']
    const bodies = []
    const necks = []
    for (const y of [1.12, 1.47, 1.82]) {
      for (let x = -2.1; x <= 2.1; x += 0.17 + rnd() * 0.06) {
        if (rnd() < 0.1) continue
        const h = 0.17 + rnd() * 0.12
        const r = 0.8 + rnd() * 0.4
        const color = glass[Math.floor(rnd() * glass.length)]
        const z = -3.3 + (rnd() - 0.5) * 0.06
        bodies.push({ x, y: y + h / 2, z, sx: r, sy: h, sz: r, color })
        necks.push({ x, y: y + h + 0.035, z, sy: 0.07, color })
      }
    }
    return { bodies, necks }
  }, [])
  const stools = useMemo(() => [-2, -1, 0, 1, 2].map((x) => ({ x, z: 1.12 })), [])
  return (
    <InMetres>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[9, 7]} />
        <meshStandardMaterial map={floor} color="#6d4a36" roughness={0.75} />
      </mesh>
      <Walls w={9} d={7} h={3} color="#3a1c16" />
      {/* Back bar: a low cabinet, a mirror strip, glass shelves of bottles */}
      <mesh position={[0, 0.48, -3.2]}><boxGeometry args={[4.8, 0.96, 0.55]} /><meshStandardMaterial color="#2a160c" roughness={0.45} /></mesh>
      <mesh position={[0, 0.97, -3.2]}><boxGeometry args={[4.9, 0.04, 0.6]} /><meshStandardMaterial color="#4a2614" roughness={0.25} /></mesh>
      <mesh position={[0, 1.6, -3.44]}><planeGeometry args={[4.6, 1.2]} /><meshStandardMaterial map={mirror} roughness={0.08} metalness={0.4} /></mesh>
      {[1.12, 1.47, 1.82].map((y) => (
        <mesh key={y} position={[0, y - 0.01, -3.3]}><boxGeometry args={[4.6, 0.02, 0.24]} /><meshStandardMaterial color="#cfe6e0" transparent opacity={0.5} roughness={0.1} /></mesh>
      ))}
      {[-2.36, 2.36].map((x) => (
        <mesh key={x} position={[x, 1.6, -3.32]}><boxGeometry args={[0.1, 1.3, 0.28]} /><meshStandardMaterial color="#2a160c" roughness={0.45} /></mesh>
      ))}
      <mesh position={[0, 2.27, -3.32]}><boxGeometry args={[4.82, 0.1, 0.3]} /><meshStandardMaterial color="#2a160c" roughness={0.45} /></mesh>
      <Instances items={bottles.bodies}><cylinderGeometry args={[0.035, 0.035, 1, 10]} /><meshStandardMaterial transparent opacity={0.85} roughness={0.12} metalness={0.1} /></Instances>
      <Instances items={bottles.necks}><cylinderGeometry args={[0.012, 0.016, 1, 8]} /><meshStandardMaterial transparent opacity={0.85} roughness={0.12} metalness={0.1} /></Instances>
      {/* Neon signs and warm wall lamps */}
      <mesh position={[0, 2.62, -3.43]}><planeGeometry args={[1.5, 0.38]} /><meshBasicMaterial map={neonA} transparent toneMapped={false} /></mesh>
      <mesh position={[4.43, 2.0, -1.2]} rotation-y={-Math.PI / 2}><planeGeometry args={[1.3, 0.33]} /><meshBasicMaterial map={neonB} transparent toneMapped={false} /></mesh>
      {[-3.4, 3.4].map((x) => <Glow key={x} position={[x, 2.2, -3.38]} size={0.06} halo={0.35} opacity={0.3} color="#ffb060" />)}
      {/* Dartboard on the side wall */}
      <mesh position={[-4.42, 1.75, -0.8]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.24, 0.24, 0.04, 28]} /><meshStandardMaterial color="#151515" /></mesh>
      <mesh position={[-4.39, 1.75, -0.8]} rotation-y={Math.PI / 2}><circleGeometry args={[0.22, 28]} /><meshStandardMaterial map={darts} roughness={0.9} /></mesh>
      {/* Bar stools along the customer side */}
      <Instances items={stools.map((s) => ({ ...s, y: 0.66 }))}><cylinderGeometry args={[0.19, 0.17, 0.08, 20]} /><meshStandardMaterial color="#7a1e1e" roughness={0.55} /></Instances>
      <Instances items={stools.map((s) => ({ ...s, y: 0.32 }))}><cylinderGeometry args={[0.025, 0.025, 0.62, 8]} /><meshStandardMaterial color="#b0b4b8" metalness={0.85} roughness={0.3} /></Instances>
      <Instances items={stools.map((s) => ({ ...s, y: 0.015 }))}><cylinderGeometry args={[0.2, 0.22, 0.03, 20]} /><meshStandardMaterial color="#b0b4b8" metalness={0.85} roughness={0.3} /></Instances>
      <Instances items={stools.map((s) => ({ ...s, y: 0.26, rx: Math.PI / 2 }))}><torusGeometry args={[0.15, 0.012, 6, 20]} /><meshStandardMaterial color="#b0b4b8" metalness={0.85} roughness={0.3} /></Instances>
    </InMetres>
  )
}

/** A few bottle caps lying about (world units, around a point on the table). */
function LooseCaps({ position, items }) {
  return (
    <group position={position}>
      <Instances items={items} castShadow>
        <cylinderGeometry args={[0.72, 0.75, 0.24, 21]} />
        <meshStandardMaterial roughness={0.3} metalness={0.55} />
      </Instances>
    </group>
  )
}

const BAR_LEN = 125 // world units, ~5 m of counter
const BAR_CAPS = [
  { x: 0, y: 0.12, z: 0, color: '#c9a227' },
  { x: 2.2, y: 0.12, z: 1.3, ry: 0.4, color: '#d32f2f' },
  { x: -0.6, y: 0.12, z: 2.4, rz: Math.PI, color: '#cfd3d6' },
]

function BarCounter() {
  const wood = useMemo(woodTexture, [])
  const thick = 1.4
  const ext = (BAR_LEN - TOP_W) / 2
  const bodyH = TABLE_H - thick
  return (
    <group>
      <TableTop map={wood} tint="#7a4630" roughness={0.18} metalness={0.15} thick={thick} />
      {/* The rest of the long counter either side */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (TOP_W / 2 + ext / 2), TABLE_TOP - thick / 2, 0]} receiveShadow>
          <boxGeometry args={[ext, thick, TOP_D]} />
          <meshStandardMaterial map={wood} color="#7a4630" roughness={0.18} metalness={0.15} />
        </mesh>
      ))}
      {/* Rounded lip along the customer edge */}
      <mesh position={[0, TABLE_TOP - thick / 2, TOP_D / 2]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[thick / 2 + 0.15, thick / 2 + 0.15, BAR_LEN, 12]} />
        <meshStandardMaterial color="#3a1d10" roughness={0.25} />
      </mesh>
      {/* Solid counter front with panels and a brass foot rail */}
      <mesh position={[0, FLOOR + bodyH / 2, -1]}><boxGeometry args={[BAR_LEN - 1, bodyH, TOP_D - 4]} /><meshStandardMaterial color="#2a150b" roughness={0.5} /></mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-BAR_LEN / 2 + 6.2 + i * 12.5, FLOOR + bodyH / 2 + 1, TOP_D / 2 - 2.9]}>
          <boxGeometry args={[10, bodyH - 6, 0.3]} />
          <meshStandardMaterial color="#3b1f10" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, FLOOR + 5, TOP_D / 2 + 1.5]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.55, 0.55, BAR_LEN - 4, 10]} />
        <meshStandardMaterial color="#c9a04a" metalness={0.9} roughness={0.25} />
      </mesh>
      {[-50, -25, 0, 25, 50].map((x) => (
        <mesh key={x} position={[x, FLOOR + 5, TOP_D / 2]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.3, 0.3, 3, 6]} /><meshStandardMaterial color="#c9a04a" metalness={0.9} roughness={0.25} /></mesh>
      ))}
      {/* Beer taps at the far end */}
      <group position={[-42, TABLE_TOP, -8]}>
        <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.8, 1.1, 8, 14]} /><meshStandardMaterial color="#d8dadd" metalness={0.9} roughness={0.2} /></mesh>
        <mesh position={[0, 7.8, 0]}><boxGeometry args={[9, 1.1, 1.4]} /><meshStandardMaterial color="#d8dadd" metalness={0.9} roughness={0.2} /></mesh>
        {[[-3, '#c62828'], [0, '#1e1e1e'], [3, '#d4a017']].map(([x, c]) => (
          <mesh key={x} position={[x, 10.2, 0]}><boxGeometry args={[0.8, 3.6, 0.8]} /><meshStandardMaterial color={c} roughness={0.4} /></mesh>
        ))}
      </group>
      {/* A pint on a beer mat, and a few caps */}
      <group position={[-19.5, TABLE_TOP, -13]}>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[4, 0.1, 4]} /><meshStandardMaterial color="#efe3c4" roughness={0.9} /></mesh>
        <mesh position={[0, 2.6, 0]}><cylinderGeometry args={[1.35, 1.1, 5, 20]} /><meshStandardMaterial color="#d48a1e" transparent opacity={0.8} roughness={0.08} /></mesh>
        <mesh position={[0, 5.4, 0]}><cylinderGeometry args={[1.36, 1.36, 0.7, 20]} /><meshStandardMaterial color="#fbf3e0" roughness={0.9} /></mesh>
      </group>
      <LooseCaps position={[18.5, TABLE_TOP, 12.5]} items={BAR_CAPS} />
      <BarRoom />
    </group>
  )
}

/* ── School desk ───────────────────────────────────── */

function exerciseBookTexture() {
  return canvasTexture(256, 192, (ctx, w, h) => {
    const rnd = rand(52)
    ctx.fillStyle = '#fbfaf4'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(70,120,200,0.35)'
    ctx.lineWidth = 1
    for (let y = 22; y < h; y += 13) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    ctx.strokeStyle = 'rgba(220,60,60,0.5)'
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, h); ctx.stroke()
    // Left page: handwriting
    ctx.strokeStyle = '#2b3a67'
    ctx.lineWidth = 1.3
    for (let y = 33; y < h - 10; y += 13) {
      let x = 26
      const end = 100 + rnd() * 20
      ctx.beginPath(); ctx.moveTo(x, y)
      while (x < end) { x += 3; ctx.lineTo(x, y - 2 - rnd() * 4) ; x += 3; ctx.lineTo(x, y) }
      ctx.stroke()
    }
    // Right page: a little pitch with Xs and Os
    ctx.strokeStyle = '#2b3a67'
    ctx.lineWidth = 2
    ctx.strokeRect(146, 40, 96, 120)
    ctx.beginPath(); ctx.moveTo(146, 100); ctx.lineTo(242, 100); ctx.stroke()
    ctx.beginPath(); ctx.arc(194, 100, 14, 0, Math.PI * 2); ctx.stroke()
    ctx.font = 'bold 14px "Comic Sans MS", cursive'
    ctx.fillStyle = '#c62828'
    for (const [x, y] of [[170, 70], [210, 66], [190, 86]]) ctx.fillText('X', x, y)
    ctx.fillStyle = '#1565c0'
    for (const [x, y] of [[166, 130], [214, 136], [192, 118]]) ctx.fillText('O', x, y)
    // The spine
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(w / 2 - 3, 0, 6, h)
  })
}

function rulerTexture() {
  return canvasTexture(256, 32, (ctx, w, h) => {
    ctx.fillStyle = '#f2d34f'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#222'
    ctx.fillStyle = '#222'
    ctx.font = '9px sans-serif'
    for (let i = 0; i <= 60; i++) {
      const x = 8 + i * 4
      const len = i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, len); ctx.stroke()
      if (i % 10 === 0) ctx.fillText(String(i / 2), x - 3, 26)
    }
  })
}

function worldMapTexture() {
  return canvasTexture(256, 144, (ctx, w, h) => {
    ctx.fillStyle = '#7fb8dc'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    // Rough continents
    const land = [
      ['#8bc34a', [[40, 40, 26, 18], [58, 62, 10, 8]]], // N America
      ['#ffb74d', [[70, 98, 12, 24]]], // S America
      ['#e57373', [[128, 38, 18, 10], [150, 34, 34, 16], [182, 50, 18, 12]]], // Eurasia
      ['#ffd54f', [[132, 84, 17, 24]]], // Africa
      ['#ba68c8', [[206, 104, 16, 10]]], // Australia
      ['#f5f5f5', [[128, 138, 90, 6]]], // Antarctica
    ]
    for (const [col, blobs] of land) {
      ctx.fillStyle = col
      for (const [x, y, rx, ry] of blobs) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill() }
    }
    ctx.strokeStyle = '#3e2a1a'
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, w, h)
  })
}

function windowTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#6fb3ea'); g.addColorStop(0.7, '#cfe8f7'); g.addColorStop(0.72, '#7fae5a'); g.addColorStop(1, '#5d8f3f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (const [x, y] of [[16, 24], [44, 46]]) {
      ctx.beginPath(); ctx.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2); ctx.ellipse(x + 8, y - 3, 8, 5, 0, 0, Math.PI * 2); ctx.fill()
    }
    // A tree top outside
    ctx.fillStyle = '#4f7f35'
    ctx.beginPath(); ctx.arc(14, 90, 14, 0, Math.PI * 2); ctx.fill()
  })
}

function classPosterTexture(text, bg, fg) {
  return canvasTexture(128, 160, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = text.split('\n')
    ctx.font = `900 ${lines.length > 1 ? 30 : 44}px "Arial Black", sans-serif`
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 36))
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, w, h)
  })
}

function Classroom() {
  const floor = useMemo(() => tilesTexture('#d6d9cf', '#bfc6b9', 'rgba(0,0,0,0.12)'), [])
  const map = useMemo(worldMapTexture, [])
  const win = useMemo(windowTexture, [])
  const posters = useMemo(() => [
    classPosterTexture('A B C\nD E F', '#ffd54f', '#c62828'),
    classPosterTexture('2×3\n=6', '#4fc3f7', '#0d3a5c'),
    classPosterTexture('READ!', '#81c784', '#1b5e20'),
  ], [])
  // Rows of pupils' desks and chairs facing the front (-z)
  const rows = useMemo(() => {
    const rnd = rand(61)
    const spots = []
    for (const z of [-2.7, 0, 2.7]) {
      for (const x of [-3.4, -1.75, 0, 1.75, 3.4]) {
        if (x === 0 && z === 0) continue // our desk
        if (x === 0 || (Math.abs(x) < 2 && z === 0)) { if (z === 0) continue }
        spots.push({ x, z })
      }
    }
    const tops = []
    const legs = []
    const seats = []
    const backs = []
    const chairLegs = []
    const chairCols = ['#2f6fb5', '#e07b2a', '#3f9a5a', '#d64545', '#7e57c2']
    const add = (x, z, color) => {
      seats.push({ x, y: 0.43, z: z + 0.42, color })
      backs.push({ x, y: 0.68, z: z + 0.6, color })
      for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) chairLegs.push({ x: x + lx, y: 0.215, z: z + 0.42 + lz })
    }
    for (const { x, z } of spots) {
      tops.push({ x, y: 0.7, z })
      for (const [lx, lz] of [[-0.32, -0.2], [0.32, -0.2], [-0.32, 0.2], [0.32, 0.2]]) legs.push({ x: x + lx, y: 0.345, z: z + lz })
      add(x, z, chairCols[Math.floor(rnd() * chairCols.length)])
    }
    add(0, 0.55, '#2f6fb5') // the chair at our desk
    return { tops, legs, seats, backs, chairLegs }
  }, [])
  const books = useMemo(() => {
    const rnd = rand(73)
    const cols = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#ef6c00', '#00838f']
    const out = []
    for (const y of [0.32, 0.82, 1.32]) {
      for (let x = -0.55; x < 0.55;) {
        const t = 0.04 + rnd() * 0.04
        const hh = 0.24 + rnd() * 0.12
        out.push({ x: x + t / 2, y: y + hh / 2, z: 0, sx: t, sy: hh, sz: 0.22, color: cols[Math.floor(rnd() * cols.length)] })
        x += t + 0.005
      }
    }
    return out
  }, [])
  return (
    <InMetres>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 9]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      <Walls w={10} d={9} h={3} color="#f1ecdc" />
      {/* Painted dado round the lower walls */}
      {[[0, -4.44, 10, 0], [0, 4.44, 10, 0], [-4.94, 0, 9, Math.PI / 2], [4.94, 0, 9, Math.PI / 2]].map(([x, z, l, r], i) => (
        <mesh key={i} position={[x, 0.45, z]} rotation-y={r}><boxGeometry args={[l, 0.9, 0.02]} /><meshStandardMaterial color="#9cc7d9" roughness={0.8} /></mesh>
      ))}
      {/* Windows down the left wall, with sunlight falling on the floor */}
      {[-2.6, 0, 2.6].map((z) => (
        <group key={z}>
          <mesh position={[-4.93, 1.75, z]} rotation-y={Math.PI / 2}><planeGeometry args={[1.6, 1.5]} /><meshBasicMaterial map={win} toneMapped={false} /></mesh>
          <mesh position={[-4.92, 1.75, z]}><boxGeometry args={[0.04, 1.6, 0.06]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[-4.92, 1.75, z]}><boxGeometry args={[0.04, 0.06, 1.7]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[-4.9, 1.0, z]}><boxGeometry args={[0.14, 0.05, 1.8]} /><meshStandardMaterial color="#ffffff" roughness={0.5} /></mesh>
          <mesh position={[-3.9, 0.005, z + 0.2]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.5, 1.4]} /><meshBasicMaterial color="#fff6d0" transparent opacity={0.22} depthWrite={false} /></mesh>
        </group>
      ))}
      {/* Front wall: world map, a clock and posters (no blackboard) */}
      <mesh position={[0, 1.75, -4.44]}><planeGeometry args={[2.4, 1.35]} /><meshStandardMaterial map={map} roughness={0.7} /></mesh>
      <group position={[2.2, 2.35, -4.43]}>
        <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.2, 0.2, 0.04, 28]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[0, 0, 0.025]} rotation-x={Math.PI / 2}><torusGeometry args={[0.2, 0.02, 6, 28]} /><meshStandardMaterial color="#222" /></mesh>
        <mesh position={[0.04, 0.05, 0.03]} rotation-z={-0.7}><boxGeometry args={[0.015, 0.14, 0.01]} /><meshStandardMaterial color="#222" /></mesh>
        <mesh position={[-0.05, 0.02, 0.03]} rotation-z={1.2}><boxGeometry args={[0.015, 0.11, 0.01]} /><meshStandardMaterial color="#222" /></mesh>
      </group>
      {posters.map((p, i) => (
        <mesh key={i} position={[4.93, 1.75, -2 + i * 1.6]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.8, 1]} /><meshStandardMaterial map={p} roughness={0.7} /></mesh>
      ))}
      {/* Bookcase in the corner */}
      <group position={[3.7, 0, -4.15]}>
        <mesh position={[0, 0.9, -0.02]}><boxGeometry args={[1.25, 1.8, 0.32]} /><meshStandardMaterial color="#b98a5a" roughness={0.7} /></mesh>
        {[0.3, 0.8, 1.3].map((y) => <mesh key={y} position={[0, y, 0.15]}><boxGeometry args={[1.2, 0.03, 0.02]} /><meshStandardMaterial color="#a0744a" /></mesh>)}
        <group position={[0, 0, 0.06]}>
          <Instances items={books}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.8} /></Instances>
        </group>
      </group>
      {/* Pupils' desks and chairs */}
      <Instances items={rows.tops}><boxGeometry args={[0.75, 0.03, 0.5]} /><meshStandardMaterial color="#d6bf94" roughness={0.55} /></Instances>
      <Instances items={rows.legs}><cylinderGeometry args={[0.015, 0.015, 0.69, 6]} /><meshStandardMaterial color="#6f7780" metalness={0.7} roughness={0.35} /></Instances>
      <Instances items={rows.seats}><boxGeometry args={[0.38, 0.03, 0.38]} /><meshStandardMaterial roughness={0.5} /></Instances>
      <Instances items={rows.backs}><boxGeometry args={[0.38, 0.26, 0.03]} /><meshStandardMaterial roughness={0.5} /></Instances>
      <Instances items={rows.chairLegs}><cylinderGeometry args={[0.012, 0.012, 0.43, 6]} /><meshStandardMaterial color="#6f7780" metalness={0.7} roughness={0.35} /></Instances>
    </InMetres>
  )
}

function Pencil({ position, ry = 0 }) {
  return (
    <group position={position} rotation-y={ry}>
      <group rotation-z={Math.PI / 2}>
        <mesh><cylinderGeometry args={[0.2, 0.2, 4.4, 6]} /><meshStandardMaterial color="#f2b632" roughness={0.5} /></mesh>
        <mesh position={[0, -2.55, 0]}><coneGeometry args={[0.2, 0.7, 6]} /><meshStandardMaterial color="#e8c9a0" roughness={0.8} /></mesh>
        <mesh position={[0, -2.83, 0]}><coneGeometry args={[0.07, 0.16, 6]} /><meshStandardMaterial color="#333" /></mesh>
        <mesh position={[0, 2.35, 0]}><cylinderGeometry args={[0.21, 0.21, 0.3, 10]} /><meshStandardMaterial color="#b0b4b8" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 2.7, 0]}><cylinderGeometry args={[0.2, 0.2, 0.45, 10]} /><meshStandardMaterial color="#f48fb1" roughness={0.8} /></mesh>
      </group>
    </group>
  )
}

function SchoolDesk() {
  const book = useMemo(exerciseBookTexture, [])
  const ruler = useMemo(rulerTexture, [])
  const thick = 1
  const band = (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, TABLE_TOP - thick / 2, s * (TOP_D / 2 + 0.15)]}><boxGeometry args={[TOP_W + 0.6, thick + 0.1, 0.3]} /><meshStandardMaterial color="#4d5a52" roughness={0.5} /></mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[s * (TOP_W / 2 + 0.15), TABLE_TOP - thick / 2, 0]}><boxGeometry args={[0.3, thick + 0.1, TOP_D]} /><meshStandardMaterial color="#4d5a52" roughness={0.5} /></mesh>
      ))}
    </group>
  )
  return (
    <group>
      <TableTop color="#dcc59a" roughness={0.5} thick={thick} edge={band} />
      <Legs color="#6f7780" size={1.4} inset={2.5} metal />
      {/* Book tray under the top */}
      <mesh position={[0, TABLE_TOP - thick - 3, -2]}><boxGeometry args={[TOP_W - 8, 0.3, TOP_D - 10]} /><meshStandardMaterial color="#5b636b" metalness={0.5} roughness={0.5} /></mesh>
      {/* Exercise book, ruler, pencil and rubber */}
      <group position={[-19.6, TABLE_TOP + 0.08, -13.4]} rotation-y={0.18}>
        <mesh position={[0, -0.04, 0]}><boxGeometry args={[5.5, 0.08, 3.9]} /><meshStandardMaterial color="#2f6fb5" roughness={0.8} /></mesh>
        <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[5.2, 3.7]} /><meshStandardMaterial map={book} roughness={0.9} /></mesh>
      </group>
      <mesh position={[3, TABLE_TOP + 0.06, 14.6]} rotation-y={0.04}>
        <boxGeometry args={[7.6, 0.12, 1.0]} />
        {[0, 1, 3, 4, 5].map((i) => <meshStandardMaterial key={i} attach={`material-${i}`} color="#e8c53e" roughness={0.4} />)}
        <meshStandardMaterial attach="material-2" map={ruler} roughness={0.4} />
      </mesh>
      <Pencil position={[19.2, TABLE_TOP + 0.2, 13.2]} ry={0.6} />
      <mesh position={[21, TABLE_TOP + 0.3, -12.5]} rotation-y={0.4}><boxGeometry args={[1.6, 0.6, 1]} /><meshStandardMaterial color="#f48fb1" roughness={0.9} /></mesh>
      <Classroom />
    </group>
  )
}

/* ── Beach towel ───────────────────────────────────── */

const SAND_Y = TABLE_TOP - 0.35 // the towel is this thick; the sand is just under it

function towelTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const cols = ['#e94f37', '#f7f1e1', '#2b86c5', '#f7f1e1', '#f5c242', '#f7f1e1']
    const n = 12
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cols[i % cols.length]
      ctx.fillRect((i * w) / n, 0, w / n + 1, h)
    }
    speckle(ctx, w, h, 5000, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'], 0.5, rand(14), 1.2)
  })
}

function sandTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8d3a2'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 7000, ['#dcc38e', '#f1e0b6', '#cfb37c', '#f6e9c8', '#bfa36c'], 0.5, rand(24), 1.5)
  }, { repeat: [24, 24] })
}

function seaTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#1f5f99'); g.addColorStop(0.6, '#2f8fbf'); g.addColorStop(0.92, '#4cc3cf'); g.addColorStop(1, '#7fdad6')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const rnd = rand(31)
    for (let i = 0; i < 70; i++) {
      const y = rnd() * h
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + (y / h) * 0.22})`
      ctx.lineWidth = 1 + (y / h) * 1.5
      const x = rnd() * w
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 2, x + 18 + rnd() * 20, y); ctx.stroke()
    }
  }, { repeat: [3, 1] })
}

function beachSkyTexture() {
  return canvasTexture(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2f86d6')
    g.addColorStop(0.3, '#5aaee8')
    g.addColorStop(0.48, '#bfe3f6')
    g.addColorStop(0.5, '#e8f6fb')
    g.addColorStop(0.52, '#4ea6c9')
    g.addColorStop(1, '#2a6f9c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

function umbrellaTexture() {
  return canvasTexture(256, 16, (ctx, w, h) => {
    const n = 8
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#f7f1e1' : '#e53950'
      ctx.fillRect((i * w) / n, 0, w / n + 1, h)
    }
  })
}

function Beach() {
  const sand = useMemo(sandTexture, [])
  const sea = useMemo(seaTexture, [])
  const sky = useMemo(beachSkyTexture, [])
  const canopy = useMemo(umbrellaTexture, [])
  const shells = useMemo(() => {
    const rnd = rand(47)
    const cols = ['#fbe9e7', '#f8bbd0', '#ffe0b2', '#efebe9', '#ffccbc']
    const out = []
    while (out.length < 12) {
      const x = (rnd() - 0.5) * 5
      const z = (rnd() - 0.5) * 3.6
      if (Math.abs(x) < 1.05 && Math.abs(z) < 0.8) continue
      if ((-x - z) / Math.SQRT2 > 1.25) continue // not in the sea
      const s = 0.6 + rnd() * 0.6
      out.push({ x, y: 0, z, sx: 0.045 * s, sy: 0.02 * s, sz: 0.04 * s, ry: rnd() * 6, color: cols[Math.floor(rnd() * cols.length)] })
    }
    return out
  }, [])
  const dunes = useMemo(() => {
    const rnd = rand(29)
    return Array.from({ length: 9 }, (_, i) => {
      const a = 0.1 + (i / 9) * Math.PI * 1.35 // the landward half, round from +x to +z to -x... away from the sea
      const d = 5 + rnd() * 1.5
      const s = 0.8 + rnd() * 0.9
      return { x: Math.cos(a - Math.PI / 4) * d, y: -s * 0.65, z: Math.sin(a - Math.PI / 4) * d, sx: s * 2.2, sy: s, sz: s * 1.4, color: '#dcc28c' }
    })
  }, [])
  const fringe = useMemo(() => {
    const out = []
    for (const s of [-1, 1]) for (let z = -TOP_D / 2 + 0.8; z < TOP_D / 2; z += 1.6) out.push({ x: s * (TOP_W / 2 + 0.7), y: SAND_Y + 0.08, z })
    return out
  }, [])
  return (
    <group>
      <mesh><sphereGeometry args={[185, 32, 16]} /><meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} /></mesh>
      <Glow position={[60, 95, -130]} size={8} halo={22} opacity={0.3} color="#fff6d8" />
      {/* Towel fringe (world units) */}
      <Instances items={fringe}><boxGeometry args={[1.4, 0.16, 0.5]} /><meshStandardMaterial color="#f7f1e1" roughness={1} /></Instances>
      <group position={[0, SAND_Y, 0]} scale={M}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[18, 18]} /><meshStandardMaterial map={sand} roughness={1} /></mesh>
        <Instances items={dunes}><sphereGeometry args={[1, 16, 10]} /><meshStandardMaterial roughness={1} /></Instances>
        {/* The sea, off past the top-left corner */}
        <group rotation-y={Math.PI / 4}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, -1.55]}><planeGeometry args={[24, 0.5]} /><meshStandardMaterial color="#b89a64" roughness={0.5} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -1.8]}><planeGeometry args={[24, 0.08]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -5.8]}><planeGeometry args={[24, 8]} /><meshStandardMaterial map={sea} roughness={0.15} metalness={0.1} /></mesh>
          {/* A little sailing boat */}
          <group position={[1.5, 0, -4.6]}>
            <mesh position={[0, 0.04, 0]}><boxGeometry args={[0.36, 0.08, 0.12]} /><meshStandardMaterial color="#ffffff" /></mesh>
            <mesh position={[0, 0.3, 0]} scale={[1, 1, 0.08]}><coneGeometry args={[0.16, 0.45, 3]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </group>
        </group>
        <Instances items={shells}><sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial roughness={0.6} /></Instances>
        {/* Beach umbrella */}
        <group position={[1.9, 0, -1.4]} rotation-z={0.08}>
          <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.018, 0.018, 2, 8]} /><meshStandardMaterial color="#f2f2f2" roughness={0.4} /></mesh>
          <mesh position={[0, 1.9, 0]}><coneGeometry args={[1.0, 0.32, 16, 1, true]} /><meshStandardMaterial map={canopy} side={THREE.DoubleSide} roughness={0.8} /></mesh>
        </group>
        <mesh position={[1.9, 0.003, -1.4]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.9, 24]} /><meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} /></mesh>
        {/* Cool box */}
        <group position={[1.35, 0, 0.75]} rotation-y={-0.3}>
          <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.46, 0.28, 0.3]} /><meshStandardMaterial color="#1e88e5" roughness={0.5} /></mesh>
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.48, 0.05, 0.32]} /><meshStandardMaterial color="#f5f5f5" roughness={0.5} /></mesh>
          <mesh position={[0, 0.33, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.12, 0.012, 6, 16, Math.PI]} /><meshStandardMaterial color="#f5f5f5" /></mesh>
        </group>
        {/* Flip-flops */}
        {[[-1.3, 0.62, 0.3], [-1.18, 0.7, 0.1]].map(([x, z, r], i) => (
          <group key={i} position={[x, 0, z]} rotation-y={r}>
            <mesh position={[0, 0.01, 0]} scale={[0.045, 0.02, 0.12]}><cylinderGeometry args={[1, 1, 1, 16]} /><meshStandardMaterial color="#ec407a" roughness={0.8} /></mesh>
            <mesh position={[0, 0.02, -0.04]} rotation-x={-Math.PI / 2} scale={[1, 1.4, 1]}><torusGeometry args={[0.035, 0.006, 6, 12, Math.PI]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </group>
        ))}
        {/* Bucket */}
        <group position={[-1.35, 0, -0.35]}>
          <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.09, 0.07, 0.16, 16]} /><meshStandardMaterial color="#fdd835" roughness={0.6} /></mesh>
          <mesh position={[0, 0.16, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.09, 0.008, 6, 16]} /><meshStandardMaterial color="#fbc02d" /></mesh>
        </group>
      </group>
    </group>
  )
}

function BeachTowel() {
  const towel = useMemo(towelTexture, [])
  return (
    <group>
      <TableTop map={towel} roughness={1} thick={0.35} />
      <Beach />
    </group>
  )
}

/* ── Picking the venue ─────────────────────────────── */

export default function Venue({ stadium }) {
  switch (stadium) {
    case 'table': return <KitchenTable />
    case 'street': return <FoldingTable />
    case 'gravel': return <PicnicTable />
    case 'bar': return <BarCounter />
    case 'desk': return <SchoolDesk />
    case 'beach': return <BeachTowel />
    default: return <GameTable />
  }
}
