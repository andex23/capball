import { useState, useEffect, useRef } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'

/**
 * GAME EFFECTS OVERLAY
 * - Commentary callouts (WHAT A SAVE!, CLOSE!, etc)
 * - Confetti on goals
 * - Screen shake on hard hits
 */

const CALLOUTS = {
  goal: ['GOAL!', 'WHAT A STRIKE!', 'BRILLIANT!', 'UNSTOPPABLE!'],
  foul: ['FOUL!', 'RECKLESS!', 'BAD TACKLE!'],
  save: ['SAVED!', 'WHAT A SAVE!', 'KEEPER!'],
  close: ['CLOSE!', 'JUST WIDE!', 'SO CLOSE!', 'OFF THE POST!'],
  kickoff: ['KICK OFF!', 'HERE WE GO!', "LET'S PLAY!"],
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function GameEffects() {
  const phase = useMatchStore((s) => s.phase)
  const [callout, setCallout] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const prevPhase = useRef(phase)

  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = phase

    if (phase === PHASE.GOAL && prev !== PHASE.GOAL) {
      setCallout(randomFrom(CALLOUTS.goal))
      setConfetti(true)
      setTimeout(() => setCallout(null), 1800)
      setTimeout(() => setConfetti(false), 2500)
    } else if (phase === PHASE.FOUL && prev !== PHASE.FOUL) {
      setCallout(randomFrom(CALLOUTS.foul))
      setTimeout(() => setCallout(null), 1200)
    } else if (phase === PHASE.KICKOFF && prev !== PHASE.KICKOFF) {
      setCallout(randomFrom(CALLOUTS.kickoff))
      setTimeout(() => setCallout(null), 1500)
    }
  }, [phase])

  return (
    <>
      {/* Commentary callout */}
      {callout && (
        <div style={styles.callout}>
          <span style={styles.calloutText}>{callout}</span>
        </div>
      )}

      {/* Confetti on goal */}
      {confetti && <ConfettiEffect />}
    </>
  )
}

function ConfettiEffect() {
  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40,
      y: -5 - Math.random() * 10,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 2 + 1,
      color: ['#FFD740', '#E53935', '#1E88E5', '#4CAF50', '#FF9800', '#9C27B0'][Math.floor(Math.random() * 6)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    }))
  )

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      particles.current.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.rotation += 5
      })
      setTick(t => t + 1)
    }, 30)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={styles.confettiContainer}>
      {particles.current.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: p.size,
          height: p.size * 0.6,
          backgroundColor: p.color,
          transform: `rotate(${p.rotation}deg)`,
          borderRadius: '1px',
          opacity: Math.max(0, 1 - p.y / 120),
        }} />
      ))}
    </div>
  )
}

const styles = {
  callout: {
    position: 'absolute',
    top: '28%',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 15,
    pointerEvents: 'none',
    animation: 'fadeIn 0.2s ease-out',
  },
  calloutText: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '28px',
    fontWeight: '900',
    color: 'white',
    letterSpacing: '4px',
    textShadow: '0 0 20px rgba(255,215,64,0.5), 0 3px 0 rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.6)',
    background: 'rgba(0,0,0,0.4)',
    padding: '8px 24px',
    borderRadius: '8px',
    backdropFilter: 'blur(4px)',
  },
  confettiContainer: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 14,
  },
}
