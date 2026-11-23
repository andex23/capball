import { useEffect, useRef, useState } from 'react'
import { useMatchStore, INPUT_PHASES } from '../state/MatchStore'
import { displayColor } from './color'
import CapPreview from './CapPreview'

/**
 * Two players on one phone: a big "Player 2 · your turn" across the pitch for a
 * moment each time the turn changes hands, in that side's colour.
 */
export default function TurnBanner() {
  const local = useMatchStore((s) => s.gameMode === 'local' && !s.challenge && !s.training && !s.penaltyShootout)
  const active = useMatchStore((s) => s.activeTeam)
  const ready = useMatchStore((s) => INPUT_PHASES.includes(s.phase) && !s.paused && !s.replaying)
  const kit = useMatchStore((s) => s.teamConfig[s.activeTeam])
  const [show, setShow] = useState(null)
  const last = useRef(null)
  useEffect(() => {
    if (!local || !ready || !active || last.current === active) return
    last.current = active
    setShow(active)
    const t = setTimeout(() => setShow(null), 1400)
    return () => clearTimeout(t)
  }, [local, ready, active])
  if (!local || !show || !kit) return null
  const n = show === 'team1' ? 1 : 2
  return (
    <div className="turn-banner" role="status" key={`${show}-${n}`} style={{ '--team': displayColor(kit.primary) }}>
      <CapPreview config={kit} size={56} />
      <div>
        <b>Player {n}</b>
        <span>Your turn</span>
        <small>{kit.name}</small>
      </div>
    </div>
  )
}
