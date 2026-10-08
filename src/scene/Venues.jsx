/**
 * The world around the board, one per venue:
 *   arena  — a floodlit bowl: tiered stands full of fans, a roof, LED boards, light towers
 *   table  — a big wooden table in a warm room, a pendant lamp and a few props
 *   street — an asphalt lot at night: chain-link fence, graffiti walls, street lamps, a skyline
 *   gravel — a village pitch at dusk: sky, low sun, hills, trees, a wooden fence, a few locals
 *
 * Everything is simple geometry and small canvas textures made once per
 * venue, with the many repeated pieces (fans, trees, windows) instanced, so it
 * stays light enough for phones.
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

/* ── Arena ───────────────────────────────────────────── */

// Generic sponsor-style boards: game words, no real brands
const LED_WORDS = ['CAPBALL', 'FLICK IT', 'TOP BINS', 'CAPBALL', 'GOAL!', 'TABLETOP FOOTBALL']
const LED_COLORS = ['#00e5ff', '#ffd740', '#ff4081', '#69f0ae', '#ffffff', '#ff9100']

function ledTexture() {
  return canvasTexture(2048, 64, (ctx, w, h) => {
    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, w, h)
    let x = 0
    let i = 0
    ctx.font = 'italic 900 40px "Barlow Condensed", "Arial Narrow", sans-serif'
    ctx.textBaseline = 'middle'
    while (x < w) {
      const word = LED_WORDS[i % LED_WORDS.length]
      const color = LED_COLORS[i % LED_COLORS.length]
      const tw = ctx.measureText(word).width
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.fillText(word, x + 30, h / 2 + 2)
      x += tw + 90
      i++
    }
    // LED pixel grid
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    for (let gx = 0; gx < w; gx += 4) ctx.fillRect(gx, 0, 1, h)
    for (let gy = 0; gy < h; gy += 4) ctx.fillRect(0, gy, w, 1)
  }, { repeat: [1, 1] })
}

function apronTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1f6e27'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'
      ctx.fillRect((i * w) / 8, 0, w / 8, h)
    }
    speckle(ctx, w, h, 3000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)'], 0.6, rand(3), 1.4)
  }, { repeat: [6, 5] })
}

function lightPanelTexture() {
  return canvasTexture(128, 96, (ctx, w, h) => {
    ctx.fillStyle = '#20232c'
    ctx.fillRect(0, 0, w, h)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const g = ctx.createRadialGradient(10 + c * 21, 12 + r * 23, 1, 10 + c * 21, 12 + r * 23, 10)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(0.5, '#fff6dc')
        g.addColorStop(1, 'rgba(255,240,200,0)')
        ctx.fillStyle = g
        ctx.fillRect(c * 21, r * 23, 21, 23)
      }
    }
  })
}

// One long stand: stepped concrete terraces with fans, under a roof.
// Built along +x, facing -z (towards the pitch); placed with position/rotation.
function useStand(length, rows, seed, colors) {
  return useMemo(() => {
    const rnd = rand(seed)
    const fans = []
    const spacing = 0.62
    const n = Math.floor(length / spacing)
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.12) continue // an empty seat here and there
        fans.push({
          x: -length / 2 + (i + 0.5) * spacing + (rnd() - 0.5) * 0.12,
          y: r * 0.62 + 0.55 + rnd() * 0.06,
          z: r * 0.9 + 0.3,
          sy: 0.85 + rnd() * 0.3,
          color: colors[Math.floor(rnd() * colors.length)],
        })
      }
    }
    return fans
  }, [length, rows, seed, colors])
}

function Stand({ length, rows = 12, position, rotationY, seed, colors, roofColor = '#141826' }) {
  const fans = useStand(length, rows, seed, colors)
  const depth = rows * 0.9
  const top = rows * 0.62
  return (
    <group position={position} rotation-y={rotationY}>
      {/* Terraces */}
      {Array.from({ length: rows }, (_, r) => (
        <mesh key={r} position={[0, r * 0.62 + 0.05, r * 0.9 + 0.45]} receiveShadow>
          <boxGeometry args={[length, 0.62 + r * 0.0, 0.9]} />
          <meshStandardMaterial color={r % 2 ? '#2a2f3f' : '#252a38'} roughness={0.95} />
        </mesh>
      ))}
      {/* The solid block under the terraces */}
      <mesh position={[0, top / 2 - 0.3, depth / 2 + 0.5]}>
        <boxGeometry args={[length, top - 0.4, depth - 0.6]} />
        <meshStandardMaterial color="#151927" roughness={1} />
      </mesh>
      {/* Fans: a body and a head */}
      <Instances items={fans}>
        <boxGeometry args={[0.38, 0.55, 0.3]} />
        <meshStandardMaterial roughness={0.85} />
      </Instances>
      {/* Back wall and roof */}
      <mesh position={[0, top + 1.6, depth + 0.6]}>
        <boxGeometry args={[length + 1, 4.5, 0.4]} />
        <meshStandardMaterial color="#10131e" roughness={1} />
      </mesh>
      <mesh position={[0, top + 3.6, depth * 0.55]} rotation-x={-0.12}>
        <boxGeometry args={[length + 1.4, 0.35, depth + 2.8]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} metalness={0.3} />
      </mesh>
      {/* A strip of light under the roof edge */}
      <mesh position={[0, top + 3.2, -0.5]}>
        <boxGeometry args={[length, 0.08, 0.08]} />
        <meshBasicMaterial color="#e8f0ff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function LightTower({ position }) {
  const panel = useMemo(lightPanelTexture, [])
  const [x, , z] = position
  const face = Math.atan2(-x, -z)
  return (
    <group position={position}>
      <mesh position={[0, 13, 0]}>
        <cylinderGeometry args={[0.35, 0.6, 26, 8]} />
        <meshStandardMaterial color="#3a3f4c" metalness={0.6} roughness={0.45} />
      </mesh>
      <group position={[0, 26.5, 0]} rotation-y={face}>
        <mesh rotation-x={0.45}>
          <boxGeometry args={[5, 3.6, 0.4]} />
          <meshStandardMaterial color="#2a2e38" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.18, 0.21]} rotation-x={0.45}>
          <planeGeometry args={[4.7, 3.3]} />
          <meshBasicMaterial map={panel} toneMapped={false} fog={false} />
        </mesh>
        <Glow position={[0, -0.6, 1.4]} size={0.01} halo={4.5} opacity={0.12} color="#fff1cf" />
      </group>
    </group>
  )
}

function LedBoards() {
  const tex = useMemo(ledTexture, [])
  const sideTex = useMemo(() => { const t = tex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(0.6, 1); return t }, [tex])
  const H = 0.9
  const y = -0.3 + H / 2
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={`l${s}`} position={[0, y, s * 13.6]} rotation-y={s > 0 ? Math.PI : 0}>
          <boxGeometry args={[36, H, 0.25]} />
          <meshBasicMaterial attach="material-4" map={tex} toneMapped={false} />
          <meshBasicMaterial attach="material-5" map={tex} toneMapped={false} />
          <meshStandardMaterial attach="material-0" color="#0b0d14" />
          <meshStandardMaterial attach="material-1" color="#0b0d14" />
          <meshStandardMaterial attach="material-2" color="#0b0d14" />
          <meshStandardMaterial attach="material-3" color="#0b0d14" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={`e${s}`}>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[s * 20.2, y, k * 7.6]} rotation-y={Math.PI / 2}>
              <boxGeometry args={[11, H, 0.25]} />
              <meshBasicMaterial attach="material-4" map={sideTex} toneMapped={false} />
              <meshBasicMaterial attach="material-5" map={sideTex} toneMapped={false} />
              <meshStandardMaterial attach="material-0" color="#0b0d14" />
              <meshStandardMaterial attach="material-1" color="#0b0d14" />
              <meshStandardMaterial attach="material-2" color="#0b0d14" />
              <meshStandardMaterial attach="material-3" color="#0b0d14" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function Dugouts() {
  return (
    <group>
      {[-6, 6].map((x) => (
        <group key={x} position={[x, -0.3, 15.6]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[5, 1.8, 1.6]} />
            <meshStandardMaterial color="#1b2333" transparent opacity={0.85} roughness={0.2} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.85, -0.2]}>
            <boxGeometry args={[5.2, 0.1, 2]} />
            <meshStandardMaterial color="#c9d4e6" roughness={0.3} metalness={0.4} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Arena({ crowdColors }) {
  const apron = useMemo(apronTexture, [])
  const colors = useMemo(() => crowdColors.map((c) => '#' + new THREE.Color(c).lerp(new THREE.Color('#1a2033'), 0.45).getHexString()), [crowdColors])
  return (
    <group>
      {/* Grass all round the board */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[46, 32]} />
        <meshStandardMaterial map={apron} roughness={0.9} />
      </mesh>
      {/* Concourse floor beyond */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#0b0e18" roughness={1} />
      </mesh>
      <LedBoards />
      <Dugouts />
      {/* Four stands */}
      <Stand length={46} position={[0, -0.3, -16.2]} rotationY={Math.PI} seed={11} colors={colors} />
      <Stand length={46} position={[0, -0.3, 16.8]} rotationY={0} seed={12} colors={colors} rows={10} />
      <Stand length={32} position={[-23.4, -0.3, 0]} rotationY={-Math.PI / 2} seed={13} colors={colors} />
      <Stand length={32} position={[23.4, -0.3, 0]} rotationY={Math.PI / 2} seed={14} colors={colors} />
      {/* Corner fillers */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * 30, 4, sz * 23]} rotation-y={Math.atan2(sx, sz)}>
          <boxGeometry args={[12, 9, 6]} />
          <meshStandardMaterial color="#121624" roughness={1} />
        </mesh>
      ))}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <LightTower key={`t${sx}${sz}`} position={[sx * 31, 0, sz * 25]} />
      ))}
    </group>
  )
}

/* ── Table ───────────────────────────────────────────── */

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

function Table() {
  const wood = useMemo(woodTexture, [])
  const note = useMemo(notepadTexture, [])
  return (
    <group>
      {/* The table top and its edge */}
      <mesh position={[0, -0.8, 0]} receiveShadow>
        <boxGeometry args={[66, 1, 46]} />
        <meshStandardMaterial map={wood} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * 30, -12, sz * 20]}>
          <boxGeometry args={[2, 22, 2]} />
          <meshStandardMaterial color="#3a2414" roughness={0.6} />
        </mesh>
      ))}
      {/* Floor and walls of a dim room */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -23, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#1a120c" roughness={1} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <mesh key={r} rotation-y={r} position={[Math.sin(r) * -70, 10, Math.cos(r) * -70]}>
          <planeGeometry args={[160, 70]} />
          <meshStandardMaterial color="#2a1c14" roughness={1} />
        </mesh>
      ))}
      {/* Props */}
      <Mug position={[-24, -0.3, -14]} />
      <SpareCaps position={[23, -0.3, 13]} />
      <group position={[24, -0.28, -13]} rotation-y={0.25}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[4.2, 5.4]} />
          <meshStandardMaterial map={note} roughness={0.9} />
        </mesh>
        <mesh position={[2.6, 0.12, 0.3]} rotation-z={Math.PI / 2} rotation-y={0.5}>
          <cylinderGeometry args={[0.1, 0.1, 5, 6]} />
          <meshStandardMaterial color="#f2b632" roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

/* ── Street ──────────────────────────────────────────── */

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

function fenceTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(190,198,210,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0); ctx.lineTo(w, h)
    ctx.moveTo(w, 0); ctx.lineTo(0, h)
    ctx.stroke()
  }, { repeat: [40, 6] })
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

function windowsTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    const rnd = rand(31)
    ctx.fillStyle = '#0d0f18'
    ctx.fillRect(0, 0, w, h)
    for (let y = 4; y < h; y += 10) {
      for (let x = 4; x < w; x += 10) {
        if (rnd() < 0.42) {
          ctx.fillStyle = rnd() < 0.7 ? '#ffd58a' : '#9ad1ff'
          ctx.globalAlpha = 0.5 + rnd() * 0.5
          ctx.fillRect(x, y, 5, 6)
        }
      }
    }
    ctx.globalAlpha = 1
  }, { repeat: [2, 3] })
}

function StreetLamp({ position, facing }) {
  return (
    <group position={position} rotation-y={facing}>
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[0.15, 0.22, 12, 8]} />
        <meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 12, 1.2]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.1, 0.1, 2.6, 6]} />
        <meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 11.85, 2.4]}>
        <boxGeometry args={[0.9, 0.25, 1.4]} />
        <meshStandardMaterial color="#232830" />
      </mesh>
      <Glow position={[0, 11.65, 2.4]} size={0.32} halo={2.6} opacity={0.22} color="#ffb85c" />
      <pointLight position={[0, 11, 2.4]} color="#ffad4f" intensity={0.6} distance={26} decay={1.4} />
    </group>
  )
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

function Street() {
  const asphalt = useMemo(asphaltTexture, [])
  const fence = useMemo(fenceTexture, [])
  const fenceEnd = useMemo(() => { const t = fence.clone(); t.needsUpdate = true; t.repeat.set(28, 6); return t }, [fence])
  const wallA = useMemo(() => wallTexture(41), [])
  const wallB = useMemo(() => wallTexture(42), [])
  const wallC = useMemo(() => wallTexture(43), [])
  const windows = useMemo(windowsTexture, [])
  const buildings = useMemo(() => {
    const rnd = rand(77)
    const out = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.1
      const d = 70 + rnd() * 30
      const h = 18 + rnd() * 40
      out.push({ x: Math.cos(a) * d, y: h / 2 - 0.3, z: Math.sin(a) * d, sx: 10 + rnd() * 10, sy: h, sz: 10 + rnd() * 8, ry: -a })
    }
    return out
  }, [])
  const H = 7
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial map={asphalt} roughness={0.92} />
      </mesh>
      {/* Painted bays and a kerb around the court */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[0, -0.29, s * 14.5]}>
          <planeGeometry args={[40, 0.25]} />
          <meshBasicMaterial color="#d9c84a" transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Chain-link fence with posts */}
      {[-1, 1].map((s) => (
        <mesh key={`f${s}`} position={[0, H / 2 - 0.3, s * 18]}>
          <planeGeometry args={[52, H]} />
          <meshStandardMaterial map={fence} transparent alphaTest={0.3} side={THREE.DoubleSide} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`g${s}`} position={[s * 26, H / 2 - 0.3, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[36, H]} />
          <meshStandardMaterial map={fenceEnd} transparent alphaTest={0.3} side={THREE.DoubleSide} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const pts = []
        const x = -26 + i * 4
        pts.push([x, -18], [x, 18])
        return pts.map(([px, pz]) => (
          <mesh key={`${px}${pz}`} position={[px, H / 2 - 0.3, pz]}>
            <cylinderGeometry args={[0.09, 0.09, H, 6]} />
            <meshStandardMaterial color="#8a929e" metalness={0.7} roughness={0.35} />
          </mesh>
        ))
      })}
      {[-1, 1].map((s) => (
        <mesh key={`r${s}`} position={[0, H - 0.3, s * 18]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 52, 6]} />
          <meshStandardMaterial color="#8a929e" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* Graffiti walls behind */}
      <mesh position={[0, 5.5, -27]}>
        <boxGeometry args={[70, 12, 1]} />
        <meshStandardMaterial attach="material-4" map={wallA} roughness={0.9} />
        <meshStandardMaterial attach="material-5" map={wallA} roughness={0.9} />
        <meshStandardMaterial attach="material-0" color="#3a2019" />
        <meshStandardMaterial attach="material-1" color="#3a2019" />
        <meshStandardMaterial attach="material-2" color="#3a2019" />
        <meshStandardMaterial attach="material-3" color="#3a2019" />
      </mesh>
      <mesh position={[-36, 5.5, 0]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[56, 12, 1]} />
        <meshStandardMaterial attach="material-4" map={wallB} roughness={0.9} />
        <meshStandardMaterial attach="material-5" map={wallB} roughness={0.9} />
        <meshStandardMaterial attach="material-0" color="#3a2019" />
        <meshStandardMaterial attach="material-1" color="#3a2019" />
        <meshStandardMaterial attach="material-2" color="#3a2019" />
        <meshStandardMaterial attach="material-3" color="#3a2019" />
      </mesh>
      <mesh position={[36, 5.5, 0]} rotation-y={-Math.PI / 2}>
        <boxGeometry args={[56, 12, 1]} />
        <meshStandardMaterial attach="material-4" map={wallC} roughness={0.9} />
        <meshStandardMaterial attach="material-5" map={wallC} roughness={0.9} />
        <meshStandardMaterial attach="material-0" color="#3a2019" />
        <meshStandardMaterial attach="material-1" color="#3a2019" />
        <meshStandardMaterial attach="material-2" color="#3a2019" />
        <meshStandardMaterial attach="material-3" color="#3a2019" />
      </mesh>
      {/* Skyline with lit windows */}
      <Instances items={buildings}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial map={windows} color="#c9cbe0" />
      </Instances>
      {/* Lamps and a few cones */}
      <StreetLamp position={[-21, -0.3, -16.5]} facing={0} />
      <StreetLamp position={[21, -0.3, -16.5]} facing={0} />
      <StreetLamp position={[-21, -0.3, 16.5]} facing={Math.PI} />
      <StreetLamp position={[21, -0.3, 16.5]} facing={Math.PI} />
      <Cone position={[-19, -0.3, 12.5]} />
      <Cone position={[-17.6, -0.3, 13.6]} />
      <Cone position={[19.5, -0.3, -12.8]} />
      {/* A pile of tyres in the corner */}
      {[0, 0.55, 1.1].map((y, i) => (
        <mesh key={i} position={[22.5, -0.05 + y, 13.4]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.95, 0.38, 10, 20]} />
          <meshStandardMaterial color="#141416" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/* ── Gravel (village pitch at dusk) ──────────────────── */

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

function fieldTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const rnd = rand(55)
    ctx.fillStyle = '#6f5a3c'
    ctx.fillRect(0, 0, w, h)
    // dry grass clumps
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w
      const y = rnd() * h
      const r = 6 + rnd() * 26
      const g = ctx.createRadialGradient(x, y, 1, x, y, r)
      g.addColorStop(0, `rgba(${110 + rnd() * 30},${115 + rnd() * 30},${55 + rnd() * 20},0.55)`)
      g.addColorStop(1, 'rgba(100,110,50,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    speckle(ctx, w, h, 5000, ['#857053', '#5a4830', '#9b8562', '#4c3c26'], 0.5, rnd, 1.5)
  }, { repeat: [24, 24] })
}

function Village() {
  const sky = useMemo(skyTexture, [])
  const field = useMemo(fieldTexture, [])
  const trees = useMemo(() => {
    const rnd = rand(91)
    const trunks = []
    const tops = []
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2
      const d = 34 + rnd() * 50
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const h = 3 + rnd() * 4
      const s = 2.4 + rnd() * 2.8
      trunks.push({ x, y: h / 2 - 0.3, z, sy: h })
      tops.push({ x, y: h + s * 0.55 - 0.3, z, sx: s, sy: s * (0.8 + rnd() * 0.5), sz: s, ry: rnd() * 6, color: rnd() < 0.5 ? '#2f4a22' : '#3d5a28' })
    }
    return { trunks, tops }
  }, [])
  const hills = useMemo(() => {
    const rnd = rand(17)
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + rnd() * 0.3
      const d = 120 + rnd() * 20
      const s = 30 + rnd() * 30
      return { x: Math.cos(a) * d, y: -s * 0.55, z: Math.sin(a) * d, sx: s * 1.6, sy: s, sz: s, color: rnd() < 0.5 ? '#2b2a2a' : '#352d2b' }
    })
  }, [])
  const locals = useMemo(() => {
    const rnd = rand(61)
    const cols = ['#c62828', '#f9a825', '#1565c0', '#ffffff', '#2e7d32', '#6d4c41', '#ad1457']
    const out = []
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1
      out.push({ x: -20 + rnd() * 40, y: 0.55, z: side * (19.5 + rnd() * 1.2), sy: 0.9 + rnd() * 0.25, color: cols[Math.floor(rnd() * cols.length)] })
    }
    return out
  }, [])
  const posts = useMemo(() => {
    const out = []
    for (let x = -26; x <= 26; x += 3.25) { out.push({ x, y: 0.6, z: -18 }, { x, y: 0.6, z: 18 }) }
    for (let z = -15; z <= 15; z += 3) { out.push({ x: -26, y: 0.6, z }, { x: 26, y: 0.6, z }) }
    return out
  }, [])
  return (
    <group>
      {/* Sky dome — fog would wash it out, so it ignores fog */}
      <mesh>
        <sphereGeometry args={[170, 32, 16]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* Low sun */}
      <Glow position={[-120, 4, -110]} size={9} halo={22} opacity={0.25} color="#ffd59a" />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={field} roughness={1} />
      </mesh>
      <Instances items={hills}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshBasicMaterial />
      </Instances>
      <Instances items={trees.trunks}>
        <cylinderGeometry args={[0.25, 0.35, 1, 6]} />
        <meshStandardMaterial color="#4a3423" roughness={1} />
      </Instances>
      <Instances items={trees.tops}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </Instances>
      {/* A rough wooden fence and the regulars leaning on it */}
      <Instances items={posts}>
        <boxGeometry args={[0.3, 1.8, 0.3]} />
        <meshStandardMaterial color="#6b4f33" roughness={1} />
      </Instances>
      {[-18, 18].map((z) => (
        <group key={z}>
          {[0.5, 1.2].map((y) => (
            <mesh key={y} position={[0, y, z]}>
              <boxGeometry args={[52, 0.16, 0.12]} />
              <meshStandardMaterial color="#7a5a3a" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      {[-26, 26].map((x) => (
        <group key={x}>
          {[0.5, 1.2].map((y) => (
            <mesh key={y} position={[x, y, 0]}>
              <boxGeometry args={[0.12, 0.16, 36]} />
              <meshStandardMaterial color="#7a5a3a" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      <Instances items={locals}>
        <capsuleGeometry args={[0.32, 1, 4, 8]} />
        <meshStandardMaterial roughness={0.9} />
      </Instances>
      {/* A goat-proof bench and a bucket of water, for character */}
      <mesh position={[-22, 0.2, -15.5]}>
        <boxGeometry args={[4, 0.15, 0.8]} />
        <meshStandardMaterial color="#7a5a3a" roughness={1} />
      </mesh>
      <mesh position={[21.5, 0.25, 14.8]}>
        <cylinderGeometry args={[0.6, 0.5, 1.1, 14]} />
        <meshStandardMaterial color="#5c6b78" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

/* ── Picking the venue ───────────────────────────────── */

export default function Venue({ stadium, config }) {
  switch (stadium) {
    case 'table': return <Table />
    case 'street': return <Street />
    case 'gravel': return <Village />
    default: return <Arena crowdColors={config.crowdColors} />
  }
}
