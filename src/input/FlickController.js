import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMatchStore, PHASE, INPUT_PHASES } from '../state/MatchStore'
import { performFlick, flickError, controllableTeams } from '../game/flick'
import { getIsHost, sendFlick, sendSelect, sendCancel } from '../multiplayer/MultiplayerManager'
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

// Flick controller using native DOM pointer events + manual raycasting.
// Works for mouse and touch. Down is on the canvas; move/up are on window so a
// release outside the canvas still ends the drag.
export function useFlickController(meshRefs, trajectoryRef) {
  const { camera, gl } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const pitchPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragCapId = useRef(null)  // cap being dragged (local — not overwritten by online sync)
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
    return raycaster.current.ray.intersectPlane(pitchPlane.current, hit) ? hit : null
  }, [camera, gl])

  // Find the active team's cap nearest to a pitch position
  const findCapAtPosition = useCallback((worldPos) => {
    const currentTeam = useMatchStore.getState().activeTeam
    const refs = meshRefs.current
    if (!refs) return null

    let best = null
    let bestDist = Infinity
    for (const [id, mesh] of Object.entries(refs)) {
      if (!mesh || !id.startsWith(`${currentTeam}_`)) continue
      const radius = id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS
      const d = Math.hypot(worldPos.x - mesh.position.x, worldPos.z - mesh.position.z)
      if (d < radius + 0.3 && d < bestDist) { best = id; bestDist = d }
    }
    return best
  }, [meshRefs])

  useEffect(() => {
    const canvas = gl.domElement

    const endDrag = () => {
      dragCapId.current = null
      dragCurrent.current = null
    }

    const handlePointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return // right/middle = camera
      const state = useMatchStore.getState()
      if (state.paused || !INPUT_PHASES.includes(state.phase)) return
      // Only the teams this client controls (not the CPU's, not the online opponent's)
      if (!controllableTeams(state).includes(state.activeTeam)) return

      const worldPos = getWorldPos(e.clientX, e.clientY)
      if (!worldPos) return

      let capId = findCapAtPosition(worldPos)
      // Already aiming: a press anywhere keeps dragging the selected cap
      if (!capId && state.phase === PHASE.AIM && dragCapId.current === null) capId = state.selectedCapId
      if (!capId) return
      // Free kick / penalty: only the designated taker
      if (state.freeKickCapId && capId !== state.freeKickCapId) return

      dragCapId.current = capId
      dragCurrent.current = worldPos.clone()
      state.selectCap(capId)
      if (state.gameMode === 'online' && !getIsHost()) sendSelect(capId)
    }

    const handlePointerMove = (e) => {
      if (!dragCapId.current) return
      const worldPos = getWorldPos(e.clientX, e.clientY)
      if (worldPos) dragCurrent.current = worldPos.clone()
    }

    const handlePointerUp = () => {
      const capId = dragCapId.current
      const dragPos = dragCurrent.current
      endDrag()
      if (!capId || !dragPos) return

      const state = useMatchStore.getState()
      const capMesh = meshRefs.current[capId]
      if (!capMesh) return

      // Slingshot: drag BACK from the cap, it shoots the opposite way
      const dx = capMesh.position.x - dragPos.x
      const dz = capMesh.position.z - dragPos.z
      const dragDist = Math.hypot(dx, dz)

      if (dragDist < PHYSICS.minFlickThreshold) {
        state.cancelAim()
        if (state.gameMode === 'online' && !getIsHost()) sendCancel()
        return
      }

      const power = Math.min(dragDist * 0.8, PHYSICS.maxFlickVelocity)
      // Three.js x,z → Matter.js x,y
      const velocity = { x: (dx / dragDist) * power, y: (dz / dragDist) * power }

      if (state.gameMode === 'online' && !getIsHost()) {
        // Guest: the host validates and runs the flick, then streams the result back
        if (flickError(state, { capId, velocity }) === null) {
          playFlick()
          sendFlick(capId, velocity)
        }
        state.setDragPower(0)
        return
      }

      if (performFlick(capId, velocity) === null) playFlick()
      else state.cancelAim()
    }

    const handlePointerCancel = () => {
      if (!dragCapId.current) return
      endDrag()
      const state = useMatchStore.getState()
      state.cancelAim()
      if (state.gameMode === 'online' && !getIsHost()) sendCancel()
    }

    // Stop the page scrolling/zooming while dragging on touch screens
    const preventTouch = (e) => e.preventDefault()

    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('touchstart', preventTouch, { passive: false })
    canvas.addEventListener('touchmove', preventTouch, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('touchstart', preventTouch)
      canvas.removeEventListener('touchmove', preventTouch)
    }
  }, [gl, getWorldPos, findCapAtPosition, meshRefs])

  // Update trajectory arrow + ball prediction each frame
  useFrame(() => {
    const arrow = trajectoryRef.current
    if (!arrow) return

    const state = useMatchStore.getState()
    const capId = dragCapId.current
    const show = capId && dragCurrent.current && !state.paused && INPUT_PHASES.includes(state.phase)

    if (!show) {
      arrow.group.visible = false
      arrow.ballGroup.visible = false
      arrow.ring.visible = false
      useMatchStore.getState().setDragPower(0)
      return
    }

    const capMesh = meshRefs.current[capId]
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
    const isGk = capId.endsWith('_gk')
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
