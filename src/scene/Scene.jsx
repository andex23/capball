import { useRef, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STADIUMS } from '../data/StadiumData'

// Camera preset positions — accessible from HUD
export const CAMERA_PRESETS = {
  topDown: { pos: [0, 30, 5], target: [0, 0, 0] },        // slight tilt, not fully flat
  behindGoal: { pos: [-16, 12, 0], target: [2, 0, 0] },    // lower, closer, looking across pitch
  sideline: { pos: [0, 14, 14], target: [0, 0, 0] },       // gentle side angle, readable
}

// Global ref so HUD can trigger camera moves
let _controlsRef = null
let _cameraRef = null
export function setCameraPreset(presetName) {
  const preset = CAMERA_PRESETS[presetName]
  if (!preset || !_controlsRef || !_cameraRef) return
  _cameraRef.position.set(...preset.pos)
  _controlsRef.target.set(...preset.target)
  _controlsRef.update()
}
import PitchMesh from './PitchMesh'
import BallTrail from './BallTrail'
import CapMesh from './CapMesh'
import BallMesh from './BallMesh'
import { usePhysicsSync } from '../physics/PhysicsSync'
import { useFlickController } from '../input/FlickController'
import { useAIController } from '../ai/AIController'
import { createPhysicsWorld, resetToFormation, resetToKickoff, stopAllBodies } from '../physics/PhysicsWorld'
import { resetKickoffProtection } from '../physics/GoalDetector'
import { playWhistle } from '../audio/SoundManager'
import { useMatchStore, PHASE } from '../state/MatchStore'

// Trajectory arrow + ball prediction visuals
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

    // === Ball prediction arrow (cyan) ===
    const ballMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, depthTest: false, transparent: true, opacity: 0.8 })
    const ballShaftGeom = new THREE.BoxGeometry(1, 0.08, 0.18)
    const ballShaft = new THREE.Mesh(ballShaftGeom, ballMat)
    const ballHeadGeom = new THREE.ConeGeometry(0.28, 0.5, 6)
    ballHeadGeom.rotateZ(-Math.PI / 2)
    const ballHead = new THREE.Mesh(ballHeadGeom, ballMat)

    const ballGroup = new THREE.Group()
    ballGroup.add(ballShaft)
    ballGroup.add(ballHead)
    ballGroup.visible = false
    ballGroup.renderOrder = 999
    scene.add(ballGroup)

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
      ballGroup, ballShaft, ballHead, ballMat,
      ring, ringMat,
    }

    return () => {
      scene.remove(group)
      scene.remove(ballGroup)
      scene.remove(ring)
      ;[shaftGeom, headGeom, mat, ballShaftGeom, ballHeadGeom, ballMat, ringGeom, ringMat].forEach(g => g.dispose())
    }
  }, [scene, trajectoryRef])

  return null
}

/* =====================================================
   STADIUM ATMOSPHERE
   - Ground plane (dark stadium floor)
   - Floodlight cones in corners
   - Soft ambient fog
   ===================================================== */

function StadiumAtmosphere({ stadiumConfig }) {
  const sc = stadiumConfig
  return (
    <group>
      {/* ── Stadium floor ── */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={sc.bgColor} roughness={0.95} metalness={0} />
      </mesh>

      {/* ── Ground glow ── */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <circleGeometry args={[28, 64]} />
        <meshBasicMaterial color={sc.groundGlow} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* Warm glow ring closer to pitch */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.035, 0]}>
        <ringGeometry args={[16, 25, 64]} />
        <meshBasicMaterial color="#1e1528" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* ── Crowd stands — dark angled walls around pitch ── */}
      {/* Back stand */}
      <mesh position={[0, 3, -16]} rotation-x={Math.PI * 0.15}>
        <planeGeometry args={[42, 8]} />
        <meshStandardMaterial color="#0c0e1e" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Front stand */}
      <mesh position={[0, 3, 16]} rotation-x={-Math.PI * 0.15}>
        <planeGeometry args={[42, 8]} />
        <meshStandardMaterial color="#0c0e1e" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Left stand */}
      <mesh position={[-22, 3, 0]} rotation-y={Math.PI / 2} rotation-x={Math.PI * 0.15}>
        <planeGeometry args={[38, 8]} />
        <meshStandardMaterial color="#0a0c1a" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Right stand */}
      <mesh position={[22, 3, 0]} rotation-y={-Math.PI / 2} rotation-x={Math.PI * 0.15}>
        <planeGeometry args={[38, 8]} />
        <meshStandardMaterial color="#0a0c1a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* ── Crowd (arena only) ── */}
      {sc.showCrowd && <CrowdDots colors={sc.crowdColors} />}

      {/* ── Corner floodlights ── */}
      <FloodLight position={[-20, 20, -16]} color={sc.floodColor} />
      <FloodLight position={[20, 20, -16]} color={sc.floodColor} />
      <FloodLight position={[-20, 20, 16]} color={sc.floodColor} />
      <FloodLight position={[20, 20, 16]} color={sc.floodColor} />
      <FloodLight position={[0, 22, -18]} intensity={0.4} color={sc.floodColor} />
      <FloodLight position={[0, 22, 18]} intensity={0.4} color={sc.floodColor} />

      {/* ── Light orb visuals ── */}
      <LightOrb position={[-20, 20, -16]} size={0.6} />
      <LightOrb position={[20, 20, -16]} size={0.6} />
      <LightOrb position={[-20, 20, 16]} size={0.6} />
      <LightOrb position={[20, 20, 16]} size={0.6} />

      {/* ── Atmospheric haze ── */}
      <HazeLayer />
    </group>
  )
}

function CrowdDots({ colors: crowdColors }) {
  const dots = useMemo(() => {
    const result = []
    const colors = crowdColors || ['#e53935', '#1e88e5', '#ffd740', '#ff7043', '#66bb6a', '#ab47bc', '#ffffff']
    for (let i = 0; i < 200; i++) {
      const side = Math.floor(Math.random() * 4) // 0=back, 1=front, 2=left, 3=right
      let x, y, z
      if (side === 0) { x = (Math.random() - 0.5) * 38; y = 1 + Math.random() * 5; z = -14 - Math.random() * 3 }
      else if (side === 1) { x = (Math.random() - 0.5) * 38; y = 1 + Math.random() * 5; z = 14 + Math.random() * 3 }
      else if (side === 2) { x = -20 - Math.random() * 3; y = 1 + Math.random() * 5; z = (Math.random() - 0.5) * 28 }
      else { x = 20 + Math.random() * 3; y = 1 + Math.random() * 5; z = (Math.random() - 0.5) * 28 }
      result.push({ x, y, z, color: colors[Math.floor(Math.random() * colors.length)], opacity: 0.15 + Math.random() * 0.35, size: 0.08 + Math.random() * 0.15 })
    }
    return result
  }, [])

  return (
    <group>
      {dots.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, d.z]}>
          <sphereGeometry args={[d.size, 6, 6]} />
          <meshBasicMaterial color={d.color} transparent opacity={d.opacity} />
        </mesh>
      ))}
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

function LightOrb({ position, size = 0.5 }) {
  return (
    <group position={position}>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[size * 0.4, 12, 12]} />
        <meshBasicMaterial color="#fffae0" />
      </mesh>
      {/* Glow */}
      <mesh>
        <sphereGeometry args={[size, 12, 12]} />
        <meshBasicMaterial color="#ffe8b0" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}

function HazeLayer() {
  return (
    <group>
      {/* Low haze */}
      <mesh position={[0, 6, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[55, 35]} />
        <meshBasicMaterial color="#1a1a3a" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Upper haze */}
      <mesh position={[0, 12, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[70, 50]} />
        <meshBasicMaterial color="#0d0d2a" transparent opacity={0.04} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Warm overhead glow */}
      <mesh position={[0, 18, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[20, 32]} />
        <meshBasicMaterial color="#2a1a0a" transparent opacity={0.03} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ===================================================== */

function GameWorld() {
  const meshRefs = useRef({})
  const trajectoryRef = useRef(null)

  const phase = useMatchStore((s) => s.phase)
  const selectedCapId = useMatchStore((s) => s.selectedCapId)
  const startKickoff = useMatchStore((s) => s.startKickoff)
  const finishKickoff = useMatchStore((s) => s.finishKickoff)

  useEffect(() => {
    createPhysicsWorld()
    // Immediately reposition to proper kickoff layout (not formation)
    const activeTeam = useMatchStore.getState().activeTeam || 'team1'
    resetToKickoff(activeTeam)
    resetKickoffProtection()
    playWhistle()
  }, [])

  useEffect(() => {
    if (phase === PHASE.GOAL) {
      const timer = setTimeout(() => {
        stopAllBodies()
        const { lastConceded } = useMatchStore.getState()
        const kickingTeam = lastConceded || 'team1'
        resetToKickoff(kickingTeam)
        resetKickoffProtection()
        playWhistle()
        startKickoff()
        // Show KICK OFF overlay for 2 seconds, then start play
        setTimeout(() => finishKickoff(), 2000)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [phase, startKickoff, finishKickoff])

  const setMeshRef = useCallback((id) => (el) => {
    meshRefs.current[id] = el
  }, [])

  usePhysicsSync(meshRefs)
  useFlickController(meshRefs, trajectoryRef)
  useAIController()

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
      <StadiumAtmosphere stadiumConfig={STADIUMS[useMatchStore.getState().stadium] || STADIUMS.arena} />

      <PitchMesh />

      {team1Caps.map((id) => {
        const pos = id.replace('team1_', '')
        return (
          <CapMesh
            key={id}
            ref={setMeshRef(id)}
            id={id}
            color={team1.primary}
            edgeColor={team1.edge}
            isGk={id.endsWith('_gk')}
            isSelected={selectedCapId === id}
            badge={team1.badge}
            number={null}
            pattern={team1.pattern}
            finish={team1.finish}
          />
        )
      })}

      {team2Caps.map((id) => {
        const pos = id.replace('team2_', '')
        return (
          <CapMesh
            key={id}
            ref={setMeshRef(id)}
            id={id}
            color={team2.primary}
            edgeColor={team2.edge}
            isGk={id.endsWith('_gk')}
            isSelected={selectedCapId === id}
            badge={team2.badge}
            number={null}
            pattern={team2.pattern}
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
        ref={(ref) => { _controlsRef = ref }}
        enableRotate={true}
        enableZoom={true}
        enablePan={true}
        mouseButtons={{
          LEFT: null,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: null,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
        minDistance={10}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />
      <CameraRefCapture />
    </group>
  )
}

function CameraRefCapture() {
  const { camera } = useThree()
  useEffect(() => { _cameraRef = camera }, [camera])
  return null
}

export default function Scene() {
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
      <GameWorld />
    </Canvas>
  )
}
