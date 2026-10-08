import { useEffect, useRef, useState } from 'react'
import { orbitBy, setStickActive } from '../scene/camera'

const RADIUS = 22 // how far the knob travels from the centre, px
const TURN_SPEED = 1.9 // radians a second round the pitch at full tilt
const TILT_SPEED = 1.1 // radians a second up/down at full tilt

/**
 * A little thumb-stick for the camera: push the knob left/right to swing
 * round the pitch, up/down to tilt. Easier to find than gestures, and it
 * never gets mixed up with aiming a cap.
 */
export default function CameraStick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const vec = useRef({ x: 0, y: 0 })
  const centre = useRef(null)
  const raf = useRef(0)
  const pointer = useRef(null)

  useEffect(() => () => { cancelAnimationFrame(raf.current); setStickActive(false) }, [])

  const loop = (last) => (now) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    const { x, y } = vec.current
    if (x || y) orbitBy(-x * TURN_SPEED * dt, y * TILT_SPEED * dt)
    raf.current = requestAnimationFrame(loop(now))
  }

  const move = (e) => {
    if (!centre.current) return
    let dx = e.clientX - centre.current.x
    let dy = e.clientY - centre.current.y
    const d = Math.hypot(dx, dy)
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d }
    setKnob({ x: dx, y: dy })
    // A small dead zone so resting a thumb on it doesn't drift the view
    const mag = Math.hypot(dx, dy) / RADIUS
    vec.current = mag < 0.15 ? { x: 0, y: 0 } : { x: dx / RADIUS, y: dy / RADIUS }
  }

  const start = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    centre.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    pointer.current = e.pointerId
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setStickActive(true)
    move(e)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop(performance.now()))
  }

  const end = (e) => {
    if (pointer.current !== null && e.pointerId !== pointer.current) return
    pointer.current = null
    centre.current = null
    vec.current = { x: 0, y: 0 }
    setKnob({ x: 0, y: 0 })
    setStickActive(false)
    cancelAnimationFrame(raf.current)
  }

  return (
    <div
      className="cam-stick"
      role="slider"
      aria-label="Move the camera: push the stick to turn and tilt the view"
      aria-valuetext="Camera stick"
      tabIndex={-1}
      onPointerDown={start}
      onPointerMove={(e) => { if (pointer.current === e.pointerId) move(e) }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <span className="cam-stick-ring" aria-hidden />
      <span className="cam-stick-knob" aria-hidden style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
