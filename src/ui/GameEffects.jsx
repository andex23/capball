import { useMemo } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'

/** Confetti burst in the scoring team's colours when a goal goes in. */
export default function GameEffects() {
  const phase = useMatchStore((s) => s.phase)
  const lastScorer = useMatchStore((s) => s.lastScorer)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const goalCount = useMatchStore((s) => s.score.team1 + s.score.team2 + s.penaltyScores.team1 + s.penaltyScores.team2)

  const colors = lastScorer ? [teamConfig[lastScorer].primary, teamConfig[lastScorer].edge, '#ffc83d', '#ffffff'] : ['#ffc83d', '#ffffff']
  const pieces = useMemo(
    () => Array.from({ length: 48 }, (_, i) => ({
      id: `${goalCount}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.6 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 1080,
      size: 6 + Math.random() * 8,
      color: colors[i % colors.length],
    })),
    // New set per goal
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goalCount]
  )

  if (phase !== PHASE.GOAL) return null
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
