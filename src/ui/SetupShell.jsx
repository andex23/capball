import Icon from './Icon'
import OnlineReadyBar from './OnlineReadyBar'
import { useMatchStore } from '../state/MatchStore'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'

const STEPS = ['Teams', 'Venue', 'Formation']

/**
 * Shared frame for the pre-match setup screens: step indicator, title,
 * scrollable body, and a sticky footer with Back / Next (or the online
 * ready bar, where the host moves both players on together).
 */
export default function SetupShell({ step, title, subtitle, onBack, next, onBothReady, children }) {
  const isOnline = useMatchStore((s) => s.gameMode === 'online')

  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head">
          <div>
            <div className="eyebrow">Match setup · Step {step + 1} of {STEPS.length}</div>
            <h1 className="display shell-title">{title}</h1>
            {subtitle && <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p>}
          </div>
          <ol className="stepper" aria-label="Setup progress">
            {STEPS.map((label, i) => (
              <li key={label} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
                <span className="dot">{i < step ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}</span>
                <span className="label">{label}</span>
              </li>
            ))}
          </ol>
        </header>

        <main className="shell-body">{children}</main>

        <footer className="shell-foot">
          <div className="shell-foot-inner">
            {isOnline ? (
              <OnlineReadyBar onBothReady={onBothReady} />
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => { playButtonSelect(); onBack() }} onMouseEnter={playHoverTick}>
                  <Icon name="back" size={18} /> Back
                </button>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => { playConfirm(); next.onClick() }}
                  onMouseEnter={playHoverTick}
                  disabled={next.disabled}
                >
                  {next.label} <Icon name={next.icon || 'next'} size={18} />
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
