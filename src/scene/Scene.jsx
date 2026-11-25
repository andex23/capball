import { Component, useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo } from 'react'
import { Canvas, useThree, useFrame, advance, _roots } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STADIUMS } from '../data/StadiumData'

import { setCameraRefs, fitCurrentPreset, resetCameraPreset } from './camera'
import { useTurnFacing } from './useTurnFacing'
import { useBallFollow } from './useBallFollow'
import PitchMesh from './PitchMesh'
import Venue, { VenueSky } from './Venues'
import BallTrail from './BallTrail'
import { CAP_ROLES, capLabel } from '../data/TeamOptions'
import { bandStyleOf } from '../game/bandStyle'
import CapMesh from './CapMesh'
import BallMesh from './BallMesh'
import { usePhysicsSync } from '../physics/PhysicsSync'
import { useFlickController } from '../input/FlickController'
import { useAIController } from '../ai/AIController'
import { useCrowdReaction } from './useCrowdReaction'
import { applyPendingBodies, setPendingBodies, saveCurrentMatch } from '../state/savedMatch'
import { isLagos } from '../platform'
import { SHADOWS, SHADOW_MAP, DPR } from './gpuBudget'
import { snapshotBodies, createPhysicsWorld, resetToKickoff, placeBallAt, deOverlapBodies, setupFreeKick, setupPenalty, setupCorner, setupGoalKick, applyCapMasses } from '../physics/PhysicsWorld'
import { massScale } from '../game/squad'
import { playWhistle, playFreeKick, playPenalty } from '../audio/SoundManager'
import { useMatchStore, PHASE, SCREEN, isAuthority, DEFAULT_TEAM_CONFIG } from '../state/MatchStore'
import { teamHomeDir } from '../game/rules'

/** The number on a cap's shirt: the team's own, else the default squad number. */
function squadNumber(config, team, capId) {
  const role = capId.slice(team.length + 1)
  const n = config?.numbers?.[role]
  return Number.isInteger(n) ? n : DEFAULT_TEAM_CONFIG[team].numbers[role]
}

// Aim arrow + predicted cap/ball paths (filled in by FlickController each frame)
function TrajectoryLineManager({ trajectoryRef }) {
  const { scene } = useThree()

  useEffect(() => {
    // === Cap aim arrow (yellow) ===
    const shaftGeom = new THREE.BoxGeometry(1, 0.08, 0.25)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false })
    const shaft = new THREE.Mesh(shaftGeom, mat)
    const headGeom = new THREE.ConeGeometry(0.35, 0.6, 6)
    headGeom.rotateZ(-Math.PI / 2)
    const head = new THREE.Mesh(headGeom, mat)

    const group = new THREE.Group()
    group.add(shaft)
    group.add(head)
    group.visible = false
    group.renderOrder = 999
    scene.add(group)

    // === Predicted paths: flat dots on the pitch, one instanced mesh, per-dot RGBA ===
    const MAX_DOTS = 220
    const dotGeom = new THREE.CircleGeometry(1, 12)
    dotGeom.rotateX(-Math.PI / 2)
    const dotColors = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DOTS * 4), 4)
    dotColors.setUsage(THREE.DynamicDrawUsage)
    dotGeom.setAttribute('aColor', dotColors)
    const dotMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: `
        attribute vec4 aColor;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec4 vColor;
        void main() { gl_FragColor = vColor; }`,
    })
    const dots = new THREE.InstancedMesh(dotGeom, dotMat, MAX_DOTS)
    dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    dots.count = 0
    dots.frustumCulled = false // instances move every frame; bounds would be stale
    dots.renderOrder = 998
    scene.add(dots)

    // === Foul marker: red ring + cross where the cap would hit an opponent first ===
    const foulMat = new THREE.MeshBasicMaterial({ color: 0xff3030, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.95 })
    const foulRingGeom = new THREE.RingGeometry(0.4, 0.56, 20)
    foulRingGeom.rotateX(-Math.PI / 2)
    const foulBarGeom = new THREE.BoxGeometry(0.76, 0.02, 0.13)
    const foul = new THREE.Group()
    foul.add(new THREE.Mesh(foulRingGeom, foulMat))
    const bar1 = new THREE.Mesh(foulBarGeom, foulMat)
    bar1.rotation.y = Math.PI / 4
    const bar2 = new THREE.Mesh(foulBarGeom, foulMat)
    bar2.rotation.y = -Math.PI / 4
    foul.add(bar1, bar2)
    foul.children.forEach((m) => { m.renderOrder = 999 })
    foul.visible = false
    scene.add(foul)

    // === Goal marker at the end of a ball path that goes in ===
    const goalRingGeom = new THREE.RingGeometry(0.55, 0.75, 28)
    const goalRingMat = new THREE.MeshBasicMaterial({ color: 0xffc629, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.9 })
    const goalRing = new THREE.Mesh(goalRingGeom, goalRingMat)
    goalRing.rotation.x = -Math.PI / 2
    goalRing.visible = false
    goalRing.renderOrder = 999
    scene.add(goalRing)

    // === Hit indicator ring on ball ===
    const ringGeom = new THREE.RingGeometry(0.5, 0.65, 24)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.6 })
    const ring = new THREE.Mesh(ringGeom, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.visible = false
    ring.renderOrder = 999
    scene.add(ring)

    // === Aim spread: a faint wedge from the ball showing how far a long shot may drift ===
    const spreadGeom = new THREE.BufferGeometry()
    spreadGeom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, -1, 1, 0, 1], 3))
    const spreadMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 0.16 })
    const spread = new THREE.Mesh(spreadGeom, spreadMat)
    spread.visible = false
    spread.renderOrder = 997
    spread.frustumCulled = false
    scene.add(spread)

    trajectoryRef.current = {
      group, shaft, head, mat,
      spread, spreadMat,
      dots, dotColors, maxDots: MAX_DOTS,
      foul, foulMat,
      goalRing, goalRingMat,
      ring, ringMat,
    }

    return () => {
      scene.remove(group)
      scene.remove(dots)
      scene.remove(foul)
      scene.remove(goalRing)
      scene.remove(ring)
      scene.remove(spread)
      dots.dispose()
      ;[shaftGeom, headGeom, mat, dotGeom, dotMat, foulMat, foulRingGeom, foulBarGeom, goalRingGeom, goalRingMat, ringGeom, ringMat, spreadGeom, spreadMat].forEach(g => g.dispose())
    }
  }, [scene, trajectoryRef])

  return null
}

/* =====================================================
   VENUE — the world around the board (scene/Venues.jsx),
   the floodlights, and the fog and sky colour
   ===================================================== */

function StadiumAtmosphere({ stadiumId, stadiumConfig }) {
  const sc = stadiumConfig
  const k = sc.floodIntensity ?? 1
  return (
    <group>
      <VenueSky color={sc.bgColor} fogColor={sc.fogColor} fogDensity={sc.fogDensity} />
      <Venue stadium={stadiumId} config={sc} />
      {k > 0 && (
        <>
          <FloodLight position={[-20, 20, -16]} intensity={0.7 * k} color={sc.floodColor} />
          <FloodLight position={[20, 20, -16]} intensity={0.7 * k} color={sc.floodColor} />
          <FloodLight position={[-20, 20, 16]} intensity={0.7 * k} color={sc.floodColor} />
          <FloodLight position={[20, 20, 16]} intensity={0.7 * k} color={sc.floodColor} />
          <FloodLight position={[0, 22, -18]} intensity={0.4 * k} color={sc.floodColor} />
          <FloodLight position={[0, 22, 18]} intensity={0.4 * k} color={sc.floodColor} />
        </>
      )}
    </group>
  )
}

function FloodLight({ position, intensity = 0.7, color = '#ffe8cc' }) {
  return (
    <spotLight
      position={position}
      target-position={[0, 0, 0]}
      intensity={intensity}
      angle={Math.PI / 3.5}
      penumbra={0.85}
      distance={65}
      color={color}
      castShadow={false}
    />
  )
}

/* ===================================================== */

/**
 * Free a finished match's graphics memory: every geometry, material and
 * texture under `root`. Each match builds its own (caps, pitch, the room
 * around the table); left behind, they pile up until a phone runs out and
 * new textures come out black. Anything shared and used again is simply
 * uploaded afresh by three.js.
 */
export function disposeTree(root) {
  if (!root) return
  const seen = new Set()
  const free = (x) => { if (x && !seen.has(x) && typeof x.dispose === 'function') { seen.add(x); x.dispose() } }
  root.traverse((o) => {
    free(o.geometry)
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue
      for (const v of Object.values(m)) if (v && v.isTexture) free(v)
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) free(u.value)
      free(m)
    }
  })
}

function GameWorld() {
  const meshRefs = useRef({})
  const rootRef = useRef(null)
  // Before R3F takes the match's objects away, free their graphics memory
  useLayoutEffect(() => () => disposeTree(rootRef.current), [])
  const trajectoryRef = useRef(null)

  const phase = useMatchStore((s) => s.phase)
  const selectedCapId = useMatchStore((s) => s.selectedCapId)
  const freeKickCapId = useMatchStore((s) => s.freeKickCapId)
  const chipArmed = useMatchStore((s) => s.chipArmed)

  // Fresh physics world for every match (GameWorld is keyed by matchKey)
  // Also lays the caps out for whatever is happening right now — the scene can
  // finish loading after the kick-off has already started.
  useLayoutEffect(() => {
    createPhysicsWorld()
    const s = useMatchStore.getState()
    applyCapMasses(s.teamConfig, massScale) // career: a player's PHY sets his cap's weight
    if (!isAuthority(s)) return
    if (s.penaltyShootout) setupPenalty(s.activeTeam)
    else resetToKickoff(s.activeTeam)
    applyPendingBodies() // a saved match being picked back up
  }, [])

  const previousPhase = useRef(phase)

  // Place the caps whenever play restarts. Only the authority does this; an
  // online guest receives positions from the host.
  useEffect(() => {
    const s = useMatchStore.getState()
    const previous = previousPhase.current
    previousPhase.current = phase
    if (!isAuthority(s)) return
    if (previous === PHASE.NO_GOAL && phase === PHASE.SELECT) {
      placeBallAt(0, 0)
      deOverlapBodies()
    }
    if (phase === PHASE.KICKOFF) {
      if (s.penaltyShootout) setupPenalty(s.activeTeam)
      else resetToKickoff(s.activeTeam)
      playWhistle()
    } else if (phase === PHASE.FREE_KICK_SETUP && s.foulData) {
      setupFreeKick(s.foulData.foulSpot, s.foulData.fouledTeam)
      playFreeKick()
    } else if (phase === PHASE.CORNER_SETUP && s.restart) {
      setupCorner(s.restart.team, s.restart.ex, s.restart.ey)
    } else if (phase === PHASE.GOAL_KICK_SETUP && s.restart) {
      setupGoalKick(s.restart.team, s.restart.ex, s.restart.ey)
    } else if (phase === PHASE.PENALTY_SETUP && s.foulData) {
      setupPenalty(s.foulData.fouledTeam)
      playPenalty()
    }
  }, [phase])

  const setMeshRef = useCallback((id) => (el) => {
    meshRefs.current[id] = el
  }, [])

  usePhysicsSync(meshRefs)
  useFlickController(meshRefs, trajectoryRef)
  useAIController()
  useTurnFacing()
  useBallFollow(meshRefs)
  useCrowdReaction(meshRefs)

  const teamConfig = useMatchStore((s) => s.teamConfig)
  const stadiumId = useMatchStore((s) => s.stadium)
  const sc = STADIUMS[stadiumId] || STADIUMS.arena
  const team1 = teamConfig.team1
  const team2 = teamConfig.team2
  // Each team's Band Studio band (kept the same object while it doesn't change)
  const b1 = bandStyleOf(team1)
  const b2 = bandStyleOf(team2)
  const band1 = useMemo(() => b1, [JSON.stringify(b1)]) // eslint-disable-line react-hooks/exhaustive-deps
  const band2 = useMemo(() => b2, [JSON.stringify(b2)]) // eslint-disable-line react-hooks/exhaustive-deps
  // Each keeper stands with his hollow towards the players and his printed side
  // towards the goal he defends (ends swap at half time)
  const team1Side = useMatchStore((s) => s.team1Side) || 'left'
  const face1 = teamHomeDir('team1', team1Side)
  const team1Caps = CAP_ROLES.map((r) => `team1_${r}`)
  const team2Caps = CAP_ROLES.map((r) => `team2_${r}`)

  return (
    <group ref={rootRef}>
      <TrajectoryLineManager trajectoryRef={trajectoryRef} />

      {/* Stadium atmosphere behind the pitch */}
      <StadiumAtmosphere stadiumId={STADIUMS[stadiumId] ? stadiumId : 'arena'} stadiumConfig={sc} />

      <PitchMesh />

      {team1Caps.map((id) => {
        return (
          <CapMesh
            key={id}
            ref={setMeshRef(id)}
            id={id}
            color={team1.primary}
            edgeColor={team1.traits?.[id.slice(6)] ? "#ffcf57" : team1.edge}
            isGk={id.endsWith('_gk')}
            faceDir={face1}
            isSelected={selectedCapId === id || freeKickCapId === id}
            chip={chipArmed === id}
            badge={team1.badge}
            number={squadNumber(team1, 'team1', id)}
            pattern={team1.pattern}
            capText={capLabel(team1, id.slice(6))}
            textColor={team1.textColor}
            skirtColor={team1.traits?.[id.slice(6)] ? "#b8862e" : team1.skirtColor}
            finish={team1.finish}
            bandStyle={band1}
            art={team1.art}
          />
        )
      })}

      {team2Caps.map((id) => {
        return (
          <CapMesh
            key={id}
            ref={setMeshRef(id)}
            id={id}
            color={team2.primary}
            edgeColor={team2.traits?.[id.slice(6)] ? "#ffcf57" : team2.edge}
            isGk={id.endsWith('_gk')}
            faceDir={-face1}
            isSelected={selectedCapId === id || freeKickCapId === id}
            chip={chipArmed === id}
            badge={team2.badge}
            number={squadNumber(team2, 'team2', id)}
            pattern={team2.pattern}
            capText={capLabel(team2, id.slice(6))}
            textColor={team2.textColor}
            skirtColor={team2.traits?.[id.slice(6)] ? "#b8862e" : team2.skirtColor}
            finish={team2.finish}
            bandStyle={band2}
            art={team2.art}
          />
        )
      })}

      <BallMesh ref={setMeshRef('ball')} />
      <BallTrail />

      {/* === LIGHTING — from stadium config === */}
      <directionalLight
        position={[6, 28, 6]}
        intensity={sc.keyLightIntensity}
        castShadow
        shadow-mapSize-width={SHADOW_MAP}
        shadow-mapSize-height={SHADOW_MAP}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={55}
        color={sc.keyLightColor}
      />
      <directionalLight position={[-8, 18, -8]} intensity={sc.fillLightIntensity} color={sc.fillLightColor} />
      <directionalLight position={[0, 12, 12]} intensity={0.25} color={sc.keyLightColor} />
      <ambientLight intensity={sc.ambientIntensity} color={sc.ambientColor} />
      <pointLight position={[0, 1.5, 16]} intensity={0.2} color={sc.rimColor} distance={35} />
      <pointLight position={[0, 1.5, -16]} intensity={0.2} color={sc.rimColor} distance={35} />
      <pointLight position={[-20, 4, 0]} intensity={0.12} color={sc.floodColor} distance={30} />
      <pointLight position={[20, 4, 0]} intensity={0.12} color={sc.floodColor} distance={30} />

      <OrbitControls
        ref={(ref) => setCameraRefs({ controls: ref })}
        enableRotate={true}
        enableZoom={true}
        enablePan={true}
        // Drag the pitch (anywhere but on one of your caps) to turn the view;
        // pinch to zoom, two fingers to slide it. Pressing one of your caps
        // aims instead — the flick controller holds the camera still for that.
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        rotateSpeed={0.6}
        screenSpacePanning={false}
        minDistance={10}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />
      <CameraRefCapture />
    </group>
  )
}

function CameraRefCapture() {
  const { camera, size, gl } = useThree()
  useEffect(() => {
    setCameraRefs({ camera, canvas: gl.domElement })
    resetCameraPreset()
    // Dev only: lets the colour check script find caps on screen
    if (import.meta.env.DEV) { window.__capballCam = camera; window.__capballGl = gl }
  }, [camera, gl])
  // Re-fit when the screen size/orientation changes
  useEffect(() => {
    fitCurrentPreset()
  }, [camera, size.width, size.height])
  return null
}

/* A phone can take the 3D drawing surface away at any moment (low graphics
   memory, another tab or the host app wanting it). The canvas then goes blank
   while the scoreboard carries on. We wait briefly for the phone to hand it
   back; if it doesn't, the canvas is rebuilt with every cap where it was. After
   a few failed rebuilds we say so and offer a reload instead of a blank screen. */
const RESTORE_WAIT_MS = 1200
const MAX_REBUILDS = 4
const STABLE_MS = 15000
// A rebuilt canvas that hasn't started drawing by now never will: try again (or give up)
const REBUILD_TIMEOUT_MS = 3500
const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
// Some phones stop drawing after the screen turns (no "lost" event, or one frame callback
// failing every frame), which freezes the clock and the pitch. If no full frame has run for
// this long while the match is on screen, rebuild the pitch the same way as after a loss.
const STALL_MS = 2500
let lastBeat = 0

/* The pitch draws from our own frame loop rather than three-fiber's. Theirs runs on
   one global requestAnimationFrame chain: if a phone ever drops a frame callback
   (some do while the screen turns), that chain is gone for good and every pitch
   after it stays frozen, even a rebuilt one. Ours can be restarted, and falls back
   to a timer while the phone isn't handing out frames at all. */
let rafId = 0
let fallbackId = 0
let lastRaf = 0
function drawFrame(ms) {
  for (const root of _roots.values()) {
    const st = root.store.getState()
    if (st.frameloop !== 'never' || !st.gl || !st.internal.active) continue
    try { advance(ms / 1000, false, st) } catch (e) { console.error(e) }
  }
}
function onRaf(ms) {
  rafId = requestAnimationFrame(onRaf)
  lastRaf = performance.now()
  drawFrame(ms)
}
function startLoop() {
  cancelAnimationFrame(rafId)
  lastRaf = performance.now()
  rafId = requestAnimationFrame(onRaf)
}
function stopLoop() { cancelAnimationFrame(rafId); clearTimeout(fallbackId); rafId = 0; fallbackId = 0 }
/** No frames from the phone: draw on a timer until they come back. */
function fallback() {
  fallbackId = 0
  if (performance.now() - lastRaf < 500) return
  drawFrame(performance.now())
  fallbackId = setTimeout(fallback, 33)
}
/** Registered last, so it only runs when every earlier frame callback got through. */
function FrameBeat() {
  useFrame(() => {
    lastBeat = performance.now()
    // The pitch is up for this match (lets the counts tell a slow load from a quit)
    globalThis.__counterballPitchDrawn = useMatchStore.getState().matchKey
  })
  return null
}

/** Catches a canvas that couldn't be created at all (no graphics available). */
class PitchBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFail?.() }
  render() { return this.state.failed ? null : this.props.children }
}

/** Inside Lagos Life the game shares the phone's graphics with the host app: draw a little lighter there. */
const GL_OPTIONS = isLagos() ? { antialias: true, powerPreference: 'default' } : { antialias: true, preserveDrawingBuffer: true }

export default function Scene() {
  const matchKey = useMatchStore((s) => s.matchKey)
  // gen: bumped to rebuild the canvas. state: 'ok' | 'lost' (trying) | 'dead' (gave up)
  const [gen, setGen] = useState(0)
  const [state, setState] = useState('ok')
  const rebuilds = useRef(0)
  const timers = useRef({})
  useEffect(() => () => { clearTimeout(timers.current.wait); clearTimeout(timers.current.stable); clearTimeout(timers.current.check) }, [])
  const stateRef = useRef('ok')
  stateRef.current = state

  const rebuild = useCallback(() => {
    clearTimeout(timers.current.wait)
    clearTimeout(timers.current.check)
    // The app is in the background: a phone won't hand out graphics now. Wait until it's back on screen.
    if (hidden()) { timers.current.waitVisible = true; return }
    if (rebuilds.current >= MAX_REBUILDS) { setState('dead'); globalThis.__counterballCount?.('pitch_dead'); return }
    rebuilds.current++
    // If the new canvas never starts drawing (the phone refused it), try again rather than wait forever
    timers.current.check = setTimeout(() => { if (stateRef.current === 'lost') rebuild() }, REBUILD_TIMEOUT_MS)
    current.current = null // the old canvas is on its way out
    // Keep every cap where it is: the new scene lays out a fresh world, then restores these
    if (isAuthority(useMatchStore.getState())) { const snap = snapshotBodies(); if (Object.keys(snap).length) setPendingBodies(snap) }
    setState('lost')
    setGen((g) => g + 1)
  }, [])

  const current = useRef(null)
  const watch = useCallback((canvas) => {
    current.current = canvas
    const onLost = (e) => {
      // Not a real loss: an old canvas being put away (a rebuild), or the match closing
      if (canvas !== current.current || useMatchStore.getState().screen !== SCREEN.PLAYING) return
      e.preventDefault() // lets the phone give it back
      globalThis.__counterballCount?.('pitch_lost', hidden() ? 'hidden' : 'shown')
      setState('lost')
      clearTimeout(timers.current.stable)
      clearTimeout(timers.current.wait)
      timers.current.wait = setTimeout(rebuild, RESTORE_WAIT_MS)
    }
    const onRestored = () => { clearTimeout(timers.current.wait); clearTimeout(timers.current.check); setState('ok'); globalThis.__counterballCount?.('pitch_back', 'restored') }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    // Drawing again: once it has held for a while, forget the earlier failures
    clearTimeout(timers.current.check)
    if (rebuilds.current > 0) globalThis.__counterballCount?.('pitch_back', 'rebuilt')
    setState('ok')
    clearTimeout(timers.current.stable)
    timers.current.stable = setTimeout(() => { rebuilds.current = 0 }, STABLE_MS)
  }, [rebuild])

  const retry = () => { rebuilds.current = 0; rebuild() }

  // Back on screen after the phone took the graphics away in the background: rebuild now
  useEffect(() => {
    const onVisible = () => {
      if (hidden() || !timers.current.waitVisible) return
      timers.current.waitVisible = false
      rebuild()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [rebuild])

  // A pitch that stopped drawing without telling us (often right after the screen turns)
  useEffect(() => {
    lastBeat = performance.now()
    let turnedAt = 0
    const onTurn = () => { turnedAt = performance.now() }
    const check = () => {
      // Drawing on the timer: keep asking the phone for frames again
      if (fallbackId && performance.now() - lastRaf > 1000) startLoop()
      if (hidden() || stateRef.current !== 'ok' || useMatchStore.getState().screen !== SCREEN.PLAYING) { lastBeat = performance.now(); return }
      const canvas = current.current
      const dead = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))?.isContextLost?.()
      if (!dead && performance.now() - lastBeat < STALL_MS) return
      // The phone stopped handing out frames: restart our loop, and draw on a timer meanwhile
      if (!dead && performance.now() - lastRaf > STALL_MS) {
        globalThis.__counterballCount?.('pitch_stall', 'frames')
        startLoop()
        if (!fallbackId) fallback()
        lastBeat = performance.now()
        return
      }
      globalThis.__counterballCount?.('pitch_stall', performance.now() - turnedAt < 10000 ? 'turned' : dead ? 'lost' : 'stuck')
      lastBeat = performance.now()
      rebuild()
    }
    startLoop()
    const t = setInterval(check, 1000)
    window.addEventListener('orientationchange', onTurn)
    window.addEventListener('resize', onTurn)
    return () => { clearInterval(t); stopLoop(); window.removeEventListener('orientationchange', onTurn); window.removeEventListener('resize', onTurn) }
  }, [rebuild])

  // three.js throws "Error creating WebGL context" outside React when a phone refuses a new canvas:
  // treat it as a failed rebuild straight away instead of waiting for the timeout
  useEffect(() => {
    const onError = (e) => {
      if (stateRef.current !== 'lost' || !/WebGL context/i.test(String(e?.message || e?.reason?.message || ''))) return
      e.preventDefault?.()
      clearTimeout(timers.current.check)
      timers.current.check = setTimeout(rebuild, 600)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onError)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError) }
  }, [rebuild])

  return (
    <>
      {state !== 'dead' && (
        <PitchBoundary key={gen} onFail={() => { timers.current.wait = setTimeout(rebuild, RESTORE_WAIT_MS) }}>
          <Canvas
            shadows={SHADOWS}
            dpr={DPR}
            frameloop="never"
            camera={{
              position: [0, 30, 5],
              fov: 55,
              near: 0.1,
              far: 400,
            }}
            gl={GL_OPTIONS}
            style={{ width: '100%', height: '100%' }}
            onCreated={({ camera, scene, gl }) => {
              camera.lookAt(0, 0, 0)
              const stadiumId = useMatchStore.getState().stadium || 'arena'
              const stadiumCfg = STADIUMS[stadiumId] || STADIUMS.arena
              scene.fog = new THREE.FogExp2(stadiumCfg.fogColor, stadiumCfg.fogDensity)
              watch(gl.domElement)
            }}
          >
            <color attach="background" args={[STADIUMS[useMatchStore.getState().stadium || 'arena'].bgColor]} />
            <GameWorld key={matchKey} />
            <FrameBeat />
          </Canvas>
        </PitchBoundary>
      )}
      {state !== 'ok' && (
        <div className="pitch-lost" role="status">
          {state === 'lost' ? <p>Bringing the pitch back…</p> : (
            <>
              <p><b>The pitch couldn’t be drawn.</b></p>
              <p>Your phone is low on graphics memory. Closing other tabs or apps usually fixes it.</p>
              <button className="btn btn-gold" onClick={retry}>Try again</button>
              <button className="btn btn-secondary" onClick={() => { try { saveCurrentMatch() } catch { /* nothing to save */ } window.location.reload() }}>Save and reload</button>
              <p className="pitch-lost-note">Your match is saved first, so you can carry on from Quick Match.</p>
            </>
          )}
        </div>
      )}
    </>
  )
}
