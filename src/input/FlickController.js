import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { applyFlick } from '../physics/PhysicsWorld'
import { PHYSICS, CAP_RADIUS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { playFlick } from '../audio/SoundManager'

// Ray-circle intersection: returns distance to hit or -1
function rayCircleIntersect(ox, oz, dx, dz, cx, cz, r) {
  const fx = ox - cx, fz = oz - cz
  const a = dx * dx + dz * dz
  const b = 2 * (fx * dx + fz * dz)
  const c = fx * fx + fz * fz - r * r
  let disc = b * b - 4 * a * c
  if (disc < 0) return -1
  disc = Math.sqrt(disc)
  const t = (-b - disc) / (2 * a)
  return t > 0.1 ? t : -1
}

// Flick controller using native DOM pointer events + manual raycasting
// This approach works reliably across desktop (mouse) and mobile (touch)
export function useFlickController(meshRefs, trajectoryRef) {
  const { camera, gl } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const pitchPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragging = useRef(false)
  const dragCurrent = useRef(null)

  // Convert clientX/clientY to world position on the pitch plane
  const getWorldPos = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.current.setFromCamera(ndc, camera)
    const hit = new THREE.Vector3()
    raycaster.current.ray.intersectPlane(pitchPlane.current, hit)
    return hit
  }, [camera, gl])

  // Find active team's cap at position
  const findCapAtPosition = useCallback((worldPos) => {
    const currentTeam = useMatchStore.getState().activeTeam
    const refs = meshRefs.current
    if (!refs) return null

    for (const [id, mesh] of Object.entries(refs)) {
      if (!mesh || id === 'ball') continue
      if (!id.startsWith(currentTeam)) continue

      const isGk = id.endsWith('_gk')
      const radius = isGk ? GK_RADIUS : CAP_RADIUS
      const dx = worldPos.x - mesh.position.x
      const dz = worldPos.z - mesh.position.z
      if (Math.sqrt(dx * dx + dz * dz) < radius + 0.3) return id
    }
    return null
  }, [meshRefs])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerDown = (e) => {
      const state = useMatchStore.getState()

      // Online multiplayer: only allow input on your turn
      if (state.gameMode === 'online') {
        try {
          const { isMyTurn } = require('../multiplayer/MultiplayerManager')
          if (!isMyTurn()) return
        } catch (e) {}
      }

      const clientX = e.clientX
      const clientY = e.clientY
      const worldPos = getWorldPos(clientX, clientY)

      if (state.phase === PHASE.SELECT || state.phase === PHASE.FREE_KICK_AIM || state.phase === PHASE.PENALTY_AIM) {
        const capId = findCapAtPosition(worldPos)
        if (capId) {
          // If a specific cap must take the kick (free kick/penalty), only allow that one
          const requiredCap = state.freeKickCapId
          if (requiredCap && capId !== requiredCap) return // wrong cap, ignore

          state.selectCap(capId)
          dragging.current = true
          dragCurrent.current = worldPos.clone()
        }
      } else if (state.phase === PHASE.AIM && state.selectedCapId) {
        dragging.current = true
        dragCurrent.current = worldPos.clone()
      }
    }

    const handlePointerMove = (e) => {
      if (!dragging.current) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const worldPos = getWorldPos(clientX, clientY)
      if (worldPos) dragCurrent.current = worldPos.clone()
    }

    const handlePointerUp = (e) => {
      if (!dragging.current) return
      dragging.current = false

      const state = useMatchStore.getState()
      const selectedId = state.selectedCapId
      if (!selectedId || !dragCurrent.current) return

      const capMesh = meshRefs.current[selectedId]
      if (!capMesh) return

      // Slingshot: drag BACK from cap, cap shoots in opposite direction
      // Use cap position on pitch plane (x, z in 3D = x, y in physics)
      const capX = capMesh.position.x
      const capZ = capMesh.position.z
      const dragX = dragCurrent.current.x
      const dragZ = dragCurrent.current.z

      // Direction: from drag point toward cap (slingshot)
      const dx = capX - dragX
      const dz = capZ - dragZ
      const dragDist = Math.sqrt(dx * dx + dz * dz)

      if (dragDist < PHYSICS.minFlickThreshold) {
        useMatchStore.setState({ phase: PHASE.SELECT, selectedCapId: null })
        dragCurrent.current = null
        return
      }

      // Clear foul data and kicker restriction when set piece is taken
      const foulData = useMatchStore.getState().foulData
      if (foulData || useMatchStore.getState().freeKickCapId) {
        useMatchStore.setState({ foulData: null, freeKickCapId: null })
      }

      // Normalize direction and calculate power
      const nx = dx / dragDist
      const nz = dz / dragDist
      const power = Math.min(dragDist * 0.8, PHYSICS.maxFlickVelocity)

      // Apply velocity: Three.js x,z → Matter.js x,y
      playFlick()
      applyFlick(selectedId, { x: nx * power, y: nz * power })
      useMatchStore.getState().setLastFlickedCap(selectedId)
      state.startResolve()
      dragCurrent.current = null
    }

    // Pointer events handle both mouse and touch
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    // Prevent default touch to avoid scroll/zoom during drag
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('touchend', handlePointerUp)
    }
  }, [gl, getWorldPos, findCapAtPosition, meshRefs])

  // Update trajectory arrow + ball prediction each frame
  useFrame(() => {
    const arrow = trajectoryRef.current
    if (!arrow) return

    const state = useMatchStore.getState()
    const show = (state.phase === PHASE.AIM)
      && dragging.current
      && dragCurrent.current
      && state.selectedCapId

    if (!show) {
      arrow.group.visible = false
      arrow.ballGroup.visible = false
      arrow.ring.visible = false
      useMatchStore.getState().setDragPower(0)
      return
    }

    const capMesh = meshRefs.current[state.selectedCapId]
    const ballMesh = meshRefs.current.ball
    if (!capMesh) { arrow.group.visible = false; arrow.ballGroup.visible = false; arrow.ring.visible = false; return }

    const cx = capMesh.position.x
    const cz = capMesh.position.z
    const dx = cx - dragCurrent.current.x
    const dz = cz - dragCurrent.current.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.1) { arrow.group.visible = false; arrow.ballGroup.visible = false; arrow.ring.visible = false; return }

    const nx = dx / dist
    const nz = dz / dist
    const arrowLen = Math.min(dist * 0.8, PHYSICS.maxFlickVelocity) * 0.8

    // Position cap aim arrow
    const midX = cx + nx * arrowLen * 0.5
    const midZ = cz + nz * arrowLen * 0.5
    arrow.shaft.position.set(midX, 0.15, midZ)
    arrow.shaft.scale.x = arrowLen
    arrow.shaft.rotation.y = -Math.atan2(nz, nx)
    arrow.head.position.set(cx + nx * arrowLen, 0.15, cz + nz * arrowLen)
    arrow.head.rotation.y = -Math.atan2(nz, nx)
    arrow.group.visible = true

    // Color: green → yellow → red based on power
    const power = Math.min(dist / (PHYSICS.maxFlickVelocity / 0.8), 1)
    useMatchStore.getState().setDragPower(power)
    const color = arrow.mat.color
    if (power < 0.5) {
      color.setRGB(power * 2, 1, 0)
    } else {
      color.setRGB(1, 2 - power * 2, 0)
    }

    // === Ball prediction ===
    if (!ballMesh) { arrow.ballGroup.visible = false; arrow.ring.visible = false; return }

    const bx = ballMesh.position.x
    const bz = ballMesh.position.z
    const isGk = state.selectedCapId.endsWith('_gk')
    const capRadius = isGk ? GK_RADIUS : CAP_RADIUS
    const hitRadius = capRadius + BALL_RADIUS // collision distance

    // Ray from cap center in flick direction — check if it hits the ball
    const t = rayCircleIntersect(cx, cz, nx, nz, bx, bz, hitRadius)

    if (t < 0 || t > 30) {
      // No hit predicted
      arrow.ballGroup.visible = false
      arrow.ring.visible = false
      return
    }

    // Cap position at moment of collision
    const hitCapX = cx + nx * t
    const hitCapZ = cz + nz * t

    // Ball deflection: direction from cap center at impact → ball center
    const deflectX = bx - hitCapX
    const deflectZ = bz - hitCapZ
    const deflectDist = Math.sqrt(deflectX * deflectX + deflectZ * deflectZ)
    if (deflectDist < 0.01) { arrow.ballGroup.visible = false; arrow.ring.visible = false; return }

    const bnx = deflectX / deflectDist
    const bnz = deflectZ / deflectDist
    const ballArrowLen = power * 1.5 // prediction length scales with power

    // Position ball prediction arrow
    const bMidX = bx + bnx * ballArrowLen * 0.5
    const bMidZ = bz + bnz * ballArrowLen * 0.5
    arrow.ballShaft.position.set(bMidX, 0.15, bMidZ)
    arrow.ballShaft.scale.x = ballArrowLen
    arrow.ballShaft.rotation.y = -Math.atan2(bnz, bnx)
    arrow.ballHead.position.set(bx + bnx * ballArrowLen, 0.15, bz + bnz * ballArrowLen)
    arrow.ballHead.rotation.y = -Math.atan2(bnz, bnx)
    arrow.ballGroup.visible = true

    // Hit indicator ring around ball
    arrow.ring.position.set(bx, 0.05, bz)
    arrow.ring.visible = true

    // Pulse the ring opacity
    const pulse = 0.4 + Math.sin(Date.now() * 0.005) * 0.2
    arrow.ringMat.opacity = pulse
  })
}
