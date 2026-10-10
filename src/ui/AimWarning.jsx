import { useMatchStore, PHASE } from '../state/MatchStore'

export default function AimWarning() {
  const risk = useMatchStore(s => s.phase === PHASE.AIM && !s.paused && s.aimOwnGoal)
  if (!risk) return null
  return <div className="match-event aim-warning" role="status"><strong>Own-goal risk</strong><span>Aim wide or use a cap behind the ball.</span></div>
}
