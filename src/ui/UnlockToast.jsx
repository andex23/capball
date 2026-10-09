import { useEffect, useState } from 'react'
import { useProgress, takeNewUnlocks } from '../state/unlocks'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playConfirm } from '../audio/SoundManager'
import CapPreview from './CapPreview'

/** "New cap unlocked!" — pops up anywhere but mid-match when a rare design is earned. */
export default function UnlockToast() {
  const progress = useProgress()
  const screen = useMatchStore((s) => s.screen)
  const [shown, setShown] = useState(null)
  const key = JSON.stringify(progress)

  useEffect(() => {
    if (screen === SCREEN.PLAYING || screen === SCREEN.SPLASH) return
    const fresh = takeNewUnlocks()
    if (!fresh.length) return
    setShown(fresh[0])
    playConfirm()
    const t = setTimeout(() => setShown(null), 4500)
    return () => clearTimeout(t)
  }, [key, screen])

  if (!shown) return null
  return (
    <div className="unlock-toast" role="status" onClick={() => setShown(null)}>
      <CapPreview config={shown} size={54} />
      <div>
        <div className="unlock-toast-title">New cap unlocked!</div>
        <div className="unlock-toast-name">{shown.name}</div>
        <small>Find it under Designs when you pick your kit.</small>
      </div>
    </div>
  )
}
