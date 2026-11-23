/**
 * Lagos Life: progress saved on another phone (or that loaded late) is waiting.
 * One tap loads it; the game restarts on it.
 */
import { useLagosStore } from './lagosStore'

export default function CloudNotice() {
  const waiting = useLagosStore((s) => !!s.cloudWaiting)
  if (!waiting) return null
  return (
    <div className="cloud-notice" role="alert">
      <span>Your saved progress is ready.</span>
      <button className="btn btn-gold" onClick={() => useLagosStore.getState().loadCloud()}>Load it</button>
    </div>
  )
}
