import { useEffect, useState } from 'react'
import { useAchievementStore } from '../state/achievementStore'
import { ACHIEVEMENTS } from '../game/achievements'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playConfirm } from '../audio/SoundManager'
import Icon from './Icon'

/** "Achievement unlocked!" — one at a time, never over live play. */
export default function AchievementToast() {
  const fresh = useAchievementStore((s) => s.fresh)
  const screen = useMatchStore((s) => s.screen)
  const [shown, setShown] = useState(null)

  useEffect(() => {
    if (shown || !fresh.length || screen === SCREEN.PLAYING || screen === SCREEN.SPLASH) return undefined
    const id = useAchievementStore.getState().takeFresh()
    const a = ACHIEVEMENTS.find((x) => x.id === id)
    if (!a) return undefined
    setShown(a)
    playConfirm()
    return undefined
  }, [fresh, screen, shown])

  useEffect(() => {
    if (!shown) return undefined
    const t = setTimeout(() => setShown(null), 4200)
    return () => clearTimeout(t)
  }, [shown])

  if (!shown) return null
  return (
    <div className="unlock-toast ach-toast" role="status" onClick={() => setShown(null)}>
      <span className="ach-badge" data-earned="true"><Icon name={shown.icon} size={26} /></span>
      <div>
        <div className="unlock-toast-title">Achievement unlocked!</div>
        <div className="unlock-toast-name">{shown.name}</div>
        <small>{shown.desc}</small>
      </div>
    </div>
  )
}
