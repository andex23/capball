import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMatchStore, PHASE, INPUT_PHASES } from '../state/MatchStore'
import { performFlick, flickError, controllableTeams } from '../game/flick'
import { getIsHost, sendFlick, sendSelect, sendCancel } from '../multiplayer/MultiplayerManager'
import { PHYSICS, CAP_RADIUS, GK_RADIUS, BALL_RADIUS } from '../data/TeamData'
import { playFlick } from '../audio/SoundManager'
import { haptic } from './haptics'
import { classifyContact } from '../game/rules'
import { predictShot, createShot, createPrediction, capBounds, goalFor } from '../game/predict'

const DOT_SPACING = 0.5
const DOT_FADE_LEN = 40 // dots fade out over this distance along a path

// Lay dots along a predicted path (flat [x, y, ...] in physics coords, y → z)
// into the instanced dot mesh, starting `skip` in from its start and fading
// with distance. Writes straight into the instance buffers: no allocation.
// Returns the next free dot index.
function layDots(t, path, points, skip, i, size, r, g, b, alpha) {
  const m = t.dots.instanceMatrix.array
  const c = t.dotColors.array
  let along = 0
  let next = skip
  for (let p = 0; p + 1 < points && i < t.maxDots; p++) {
    const x0 = path[p * 2], y0 = path[p * 2 + 1]
    const dx = path[p * 2 + 2] - x0, dy = path[p * 2 + 3] - y0
    const len = Math.hypot(dx, dy)
    while (next <= along + len && i < t.maxDots) {
      const f = len > 0 ? (next - along) / len : 0
      const fade = Math.max(0.15, 1 - next / DOT_FADE_LEN)
      const s = size * (0.6 + 0.4 * fade)
      const o = i * 16 // scale + translation of an otherwise identity matrix
      m[o] = s; m[o + 5] = s; m[o + 10] = s
      m[o + 12] = x0 + dx * f; m[o + 13] = 0.07; m[o + 14] = y0 + dy * f
      const k = i * 4
      c[k] = r; c[k + 1] = g; c[k + 2] = b; c[k + 3] = alpha * fade
      i++
      next += DOT_SPACING
    }
    along += len
  }
  return i
}

function hidePreview(t) {
  t.group.visible = false
  t.dots.count = 0
  t.foul.visible = false
  t.goalRing.visible = false
  t.ring.visible = false
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
  const shotRef = useRef(null)  // reused predictShot input/output (no per-frame allocation)
  const predRef = useRef(null)

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
          haptic('flick')
          sendFlick(capId, velocity)
        }
        state.setDragPower(0)
        return
      }

      if (performFlick(capId, velocity) === null) {
        playFlick()
        haptic('flick')
      } else state.cancelAim()
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

  // Update the aim arrow and the predicted cap/ball paths each frame
  useFrame(() => {
    const t = trajectoryRef.current
    if (!t) return

    const state = useMatchStore.getState()
    // The turn ended under the player's finger (shot clock) — drop the drag
    if (dragCapId.current && !INPUT_PHASES.includes(state.phase)) { dragCapId.current = null; dragCurrent.current = null }
    const capId = dragCapId.current
    const show = capId && dragCurrent.current && !state.paused && INPUT_PHASES.includes(state.phase)

    if (!show) {
      hidePreview(t)
      useMatchStore.getState().setDragPower(0)
      return
    }

    const refs = meshRefs.current
    const capMesh = refs[capId]
    const ballMesh = refs.ball
    if (!capMesh) { hidePreview(t); return }

    const cx = capMesh.position.x
    const cz = capMesh.position.z
    const dx = cx - dragCurrent.current.x
    const dz = cz - dragCurrent.current.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.1) { hidePreview(t); return }

    const nx = dx / dist
    const nz = dz / dist
    const flickSpeed = Math.min(dist * 0.8, PHYSICS.maxFlickVelocity) // same as handlePointerUp
    let arrowLen = flickSpeed * 0.8

    // Color: green → yellow → red based on power
    const power = Math.min(dist / (PHYSICS.maxFlickVelocity / 0.8), 1)
    useMatchStore.getState().setDragPower(power)
    const color = t.mat.color
    if (power < 0.5) {
      color.setRGB(power * 2, 1, 0)
    } else {
      color.setRGB(1, 2 - power * 2, 0)
    }

    // === Prediction (physics x,y = three x,z) ===
    if (!shotRef.current) { shotRef.current = createShot(); predRef.current = createPrediction() }
    const shot = shotRef.current
    const pred = predRef.current
    const isGk = capId.endsWith('_gk')
    const capRadius = isGk ? GK_RADIUS : CAP_RADIUS
    shot.x = cx; shot.y = cz
    shot.r = capRadius
    shot.mass = isGk ? PHYSICS.gkMass : PHYSICS.playerMass
    shot.vx = nx * flickSpeed; shot.vy = nz * flickSpeed
    shot.ballX = ballMesh ? ballMesh.position.x : 1e6
    shot.ballY = ballMesh ? ballMesh.position.z : 1e6
    let n = 0
    for (const id in refs) {
      const mesh = refs[id]
      if (!mesh || id === 'ball' || id === capId || n >= shot.bodies.length) continue
      const b = shot.bodies[n++]
      b.x = mesh.position.x; b.y = mesh.position.z
      b.r = id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS
      b.contact = classifyContact(capId, id)
    }
    shot.bodyCount = n
    const team1Side = state.team1Side || 'left'
    capBounds(capId, team1Side, shot)
    predictShot(shot, pred)

    // Cap aim arrow — stops where the cap's straight run ends (contact or cushion)
    if (pred.capPoints >= 2) {
      const run = Math.hypot(pred.capPath[2] - cx, pred.capPath[3] - cz)
      arrowLen = Math.max(0.3, Math.min(arrowLen, run))
    }
    const midX = cx + nx * arrowLen * 0.5
    const midZ = cz + nz * arrowLen * 0.5
    t.shaft.position.set(midX, 0.15, midZ)
    t.shaft.scale.x = arrowLen
    t.shaft.rotation.y = -Math.atan2(nz, nx)
    t.head.position.set(cx + nx * arrowLen, 0.15, cz + nz * arrowLen)
    t.head.rotation.y = -Math.atan2(nz, nx)
    t.group.visible = true

    // Dotted paths: the cap's run (pale), then the ball's (cyan; gold into the
    // opponent's goal, red into your own)
    let dots = layDots(t, pred.capPath, pred.capPoints, capRadius + 0.2, 0, 0.07, 1, 1, 1, 0.55)
    const goal = goalFor(pred, capId, team1Side)
    const ballOnPath = pred.contact === 'ball' && pred.ballPoints >= 2
    if (ballOnPath) {
      let r = 0.3, g = 0.95, b = 1
      if (goal === 'score') { r = 1; g = 0.78; b = 0.16 }
      else if (goal === 'own') { r = 1; g = 0.2; b = 0.2 }
      dots = layDots(t, pred.ballPath, pred.ballPoints, BALL_RADIUS + 0.15, dots, 0.11, r, g, b, 0.95)
      if (goal) {
        const e = (pred.ballPoints - 1) * 2
        t.goalRing.position.set(pred.ballPath[e], 0.06, pred.ballPath[e + 1])
        t.goalRingMat.color.setRGB(r, g, b)
      }
    }
    t.dots.count = dots
    t.dots.instanceMatrix.needsUpdate = true
    t.dotColors.needsUpdate = true
    t.goalRing.visible = ballOnPath && goal !== null

    // Foul (opponent first) = red marker; teammate first (wasted turn) = amber
    const blocked = pred.contact === 'foul' || pred.contact === 'teammate'
    if (blocked) {
      t.foul.position.set(pred.contactX, 0.08, pred.contactY)
      if (pred.contact === 'foul') t.foulMat.color.setRGB(1, 0.19, 0.19)
      else t.foulMat.color.setRGB(1, 0.62, 0.1)
    }
    t.foul.visible = blocked

    // Hit indicator ring around the ball
    t.ring.visible = pred.contact === 'ball' && !!ballMesh
    if (t.ring.visible) {
      t.ring.position.set(ballMesh.position.x, 0.05, ballMesh.position.z)
      t.ringMat.opacity = 0.4 + Math.sin(Date.now() * 0.005) * 0.2 // pulse
    }
  })
}
