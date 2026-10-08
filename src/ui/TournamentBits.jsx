import CapPreview from './CapPreview'
import { displayColor } from './color'

/** A team's cap and name on one line (dimmed when knocked out). */
export function TeamTag({ team, size = 26, strong, out, placeholder = 'TBD' }) {
  if (!team) {
    return (
      <span className="t-team t-team-empty">
        <span className="t-cap-ghost" style={{ width: size, height: size }} aria-hidden />
        <span className="t-team-name">{placeholder}</span>
      </span>
    )
  }
  return (
    <span className="t-team" data-strong={strong ? 'true' : undefined} data-out={out ? 'true' : undefined} style={{ '--team': displayColor(team.primary) }}>
      <CapPreview config={team} size={size} />
      <span className="t-team-name">{team.name}</span>
    </span>
  )
}

/** "2–1" or "1–1 (4–3 p)" for a played fixture; null before it's played. */
export function scoreText(result) {
  if (!result) return null
  const main = `${result.home}–${result.away}`
  return result.pens ? `${main} (${result.pens.home}–${result.pens.away} p)` : main
}

/** Thin progress bar with a label. */
export function ProgressBar({ played, total, label }) {
  const pct = total ? Math.round((played / total) * 100) : 0
  return (
    <div className="t-progress">
      <div className="t-progress-label">
        <span className="eyebrow">{label}</span>
        <span className="eyebrow tabular">{played}/{total} played</span>
      </div>
      <div className="t-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={played}>
        <div className="t-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
