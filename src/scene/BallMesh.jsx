import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import { BALL_RADIUS } from '../data/TeamData'
import { useMatchStore } from '../state/MatchStore'

/*
 * The "ball" is a carrom coin: a flat, lacquered wooden disc with engraved
 * rings on top and a rounded edge — white or black, like the real thing
 * people flick bottle caps at.
 */
const COIN_H = 0.2     // a carrom coin is about a quarter as thick as it is wide
const EDGE_R = 0.05    // how rounded the rim is

/** Profile of the coin's side, turned round the axis: flat top and bottom, rounded rim. */
function createCoinGeometry() {
  const R = BALL_RADIUS
  const h = COIN_H / 2
  const pts = [new THREE.Vector2(0, -h), new THREE.Vector2(R - EDGE_R, -h)]
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI
    pts.push(new THREE.Vector2(R - EDGE_R + Math.cos(a) * EDGE_R, Math.sin(a) * h))
  }
  pts.push(new THREE.Vector2(R - EDGE_R, h), new THREE.Vector2(0, h))
  return new THREE.LatheGeometry(pts, 48)
}

const isLight = (hex) => {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16)
  if (!Number.isFinite(n)) return true
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.5
}

/** The top face: the coin's colour with a faint grain and three engraved rings. */
function createCoinTopTexture(color) {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  const mid = size / 2
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  // Faint wood grain under the lacquer
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = isLight(color) ? `rgba(150,110,60,${0.03 + (i % 3) * 0.015})` : `rgba(255,255,255,${0.02 + (i % 3) * 0.01})`
    ctx.lineWidth = 1 + (i % 4)
    ctx.beginPath()
    const y = (i / 40) * size
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(size * 0.3, y + 6, size * 0.6, y - 6, size, y + 3)
    ctx.stroke()
  }
  // Engraved rings: a dark groove with a light catch just inside it
  const dark = isLight(color) ? 'rgba(80,55,25,0.45)' : 'rgba(0,0,0,0.6)'
  const light = isLight(color) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.16)'
  for (const k of [0.86, 0.62, 0.3]) {
    ctx.lineWidth = size * 0.022
    ctx.strokeStyle = dark
    ctx.beginPath(); ctx.arc(mid, mid, mid * k, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = size * 0.008
    ctx.strokeStyle = light
    ctx.beginPath(); ctx.arc(mid, mid, mid * k - size * 0.016, 0, Math.PI * 2); ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const BallMesh = forwardRef(function BallMesh(props, ref) {
  const ballColor = useMatchStore((s) => s.ballColor)
  const geometry = useMemo(createCoinGeometry, [])
  const top = useMemo(() => createCoinTopTexture(ballColor), [ballColor])

  return (
    <group ref={ref} position={[0, COIN_H / 2, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial color={ballColor} roughness={0.35} metalness={0} clearcoat={1} clearcoatRoughness={0.15} />
      </mesh>
      <mesh position={[0, COIN_H / 2 + 0.001, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[BALL_RADIUS - EDGE_R, 48]} />
        <meshPhysicalMaterial map={top} roughness={0.3} metalness={0} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
    </group>
  )
})

export default BallMesh
