import { useMatchStore, PHASE } from '../state/MatchStore'

/** A short celebration for confirmed goals; routine commentary stays in the HUD. */
export default function GoalSplash() {
  const phase = useMatchStore(s => s.phase)
  const paused = useMatchStore(s => s.paused)
  const replaying = useMatchStore(s => s.replaying)
  const own = useMatchStore(s => s.lastGoalOwn && !s.penaltyShootout)
  const event = useMatchStore(s => [s.matchKey, s.score.team1, s.score.team2, s.penaltyScores.team1, s.penaltyScores.team2].join(':'))
  if (phase !== PHASE.GOAL || paused || replaying) return null
  return <div key={event} className="goal-splash" role="status" aria-live="polite"><strong>{own ? 'OWN GOAL' : 'GOAL!'}</strong></div>
}
