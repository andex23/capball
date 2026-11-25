/**
 * A cap up close: the real match cap in 3D, turning slowly. Drag to spin it
 * any way, pinch or scroll to zoom, and flip it to see underneath.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import CapMesh from '../scene/CapMesh'
import { capLabel } from '../data/TeamOptions'
import { bandColor } from '../data/bands'
import Icon from './Icon'
import { loadArtFonts } from '../game/capArt'
import './capViewer.css'

function Spinner({ flipped, children }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (!g.current) return
    // ease towards the side asked for (top up, or turned over)
    const want = flipped ? Math.PI : 0
    g.current.rotation.x += (want - g.current.rotation.x) * Math.min(1, dt * 6)
  })
  return <group ref={g}>{children}</group>
}

export default function CapViewer({ config, number = 10, role = 'atk1', height = 300 }) {
  const [flipped, setFlipped] = useState(false)
  const [spin, setSpin] = useState(true)
  // The print uses the game's fonts: draw only once they're in
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let on = true
    const f = document.fonts
    Promise.all([loadArtFonts(), f?.load('800 20px "Barlow Condensed"'), f?.load('italic 800 20px "Barlow Condensed"')].map((p) => Promise.resolve(p).catch(() => {})))
      .then(() => on && setReady(true))
    return () => { on = false }
  }, [])
  return (
    <div className="cap-viewer" style={{ height }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 2.2, 2.4], fov: 32 }} gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerDown={() => setSpin(false)}>
        <color attach="background" args={['#0b1236']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#cfe0ff" />
        <pointLight position={[0, -2, 0]} intensity={0.6} />
        <Suspense fallback={null}>
          {ready && <Spinner flipped={flipped}>
            <CapMesh
              color={config.primary}
              edgeColor={config.edge}
              textColor={config.textColor}
              skirtColor={config.skirtColor}
              badge={config.badge}
              pattern={config.pattern}
              finish={config.finish}
              capText={capLabel(config, role)}
              band={bandColor(config.bands?.[role])}
              art={config.art}
              number={number}
              faceDir={1}
              hq
            />
          </Spinner>}
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.6} maxDistance={5} autoRotate={spin} autoRotateSpeed={1.6} />
      </Canvas>
      <div className="cap-viewer-bar">
        <button className="btn btn-ghost" onClick={() => setFlipped((f) => !f)}><Icon name="restart" size={16} /> {flipped ? 'Top' : 'Underneath'}</button>
        <span>Drag to turn · pinch to zoom</span>
      </div>
    </div>
  )
}
