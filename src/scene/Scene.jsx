import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STADIUMS } from '../data/StadiumData'

import { setCameraRefs, fitCurrentPreset, resetCameraPreset } from './camera'
import { useTurnFacing } from './useTurnFacing'
import PitchMesh from './PitchMesh'
import Venue, { VenueSky } from './Venues'
import BallTrail from './BallTrail'
import CapMesh from './CapMesh'
import BallMesh from './BallMesh'
import { usePhysicsSync } from '../physics/PhysicsSync'
import { useFlickController } from '../input/FlickController'
import { useAIController } from '../ai/AIController'
import { useCrowdReaction } from './useCrowdReaction'
import { applyPendingBodies } from '../state/savedMatch'
import { createPhysicsWorld, resetToKickoff, setupFreeKick, setupPenalty, setupCorner, setupGoalKick } from '../physics/PhysicsWorld'
import { playWhistle, playFreeKick, playPenalty } from '../audio/SoundManager'
import { useMatchStore, PHASE, isAuthority, DEFAULT_TEAM_CONFIG } from '../state/MatchStore'

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

    trajectoryRef.current = {
      group, shaft, head, mat,
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
      dots.dispose()
      ;[shaftGeom, headGeom, mat, dotGeom, dotMat, foulMat, foulRingGeom, foulBarGeom, goalRingGeom, goalRingMat, ringGeom, ringMat].forEach(g => g.dispose())
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

function GameWorld() {
  const meshRefs = useRef({})
  const trajectoryRef = useRef(null)

  const phase = useMatchStore((s) => s.phase)
  const selectedCapId = useMatchStore((s) => s.selectedCapId)
  const freeKickCapId = useMatchStore((s) => s.freeKickCapId)

  // Fresh physics world for every match (GameWorld is keyed by matchKey)
  // Also lays the caps out for whatever is happening right now — the scene can
  // finish loading after the kick-off has already started.
  useLayoutEffect(() => {
    createPhysicsWorld()
    const s = useMatchStore.getState()
    if (!isAuthority(s)) return
    if (s.penaltyShootout) setupPenalty(s.activeTeam)
    else resetToKickoff(s.activeTeam)
    applyPendingBodies() // a saved match being picked back up
  }, [])

  // Place the caps whenever play restarts. Only the authority does this; an
  // online guest receives positions from the host.
  useEffect(() => {
    const s = useMatchStore.getState()
    if (!isAuthority(s)) return
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
  useCrowdReaction(meshRefs)

  const teamConfig = useMatchStore((s) => s.teamConfig)
  const stadiumId = useMatchStore((s) => s.stadium)
  const sc = STADIUMS[stadiumId] || STADIUMS.arena
  const team1 = teamConfig.team1
  const team2 = teamConfig.team2
  const team1Caps = ['team1_gk', 'team1_def1', 'team1_def2', 'team1_atk1', 'team1_atk2']
  const team2Caps = ['team2_gk', 'team2_def1', 'team2_def2', 'team2_atk1', 'team2_atk2']

  return (
    <group>
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
            edgeColor={team1.edge}
            isGk={id.endsWith('_gk')}
            isSelected={selectedCapId === id || freeKickCapId === id}
            badge={team1.badge}
            number={squadNumber(team1, 'team1', id)}
            pattern={team1.pattern}
            capText={team1.capText}
            finish={team1.finish}
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
            edgeColor={team2.edge}
            isGk={id.endsWith('_gk')}
            isSelected={selectedCapId === id || freeKickCapId === id}
            badge={team2.badge}
            number={squadNumber(team2, 'team2', id)}
            pattern={team2.pattern}
            capText={team2.capText}
            finish={team2.finish}
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
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
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
  }, [camera, gl])
  // Re-fit when the screen size/orientation changes
  useEffect(() => {
    fitCurrentPreset()
  }, [camera, size.width, size.height])
  return null
}

export default function Scene() {
  const matchKey = useMatchStore((s) => s.matchKey)
  return (
    <Canvas
      shadows
      camera={{
        position: [0, 30, 5],
        fov: 55,
        near: 0.1,
        far: 200,
      }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera, scene }) => {
        camera.lookAt(0, 0, 0)
        const stadiumId = useMatchStore.getState().stadium || 'arena'
        const stadiumCfg = STADIUMS[stadiumId] || STADIUMS.arena
        scene.fog = new THREE.FogExp2(stadiumCfg.fogColor, stadiumCfg.fogDensity)
      }}
    >
      <color attach="background" args={[STADIUMS[useMatchStore.getState().stadium || 'arena'].bgColor]} />
      <GameWorld key={matchKey} />
    </Canvas>
  )
}
