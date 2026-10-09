import { useAchievementStore } from '../state/achievementStore'
import { ACHIEVEMENTS } from '../game/achievements'
import Icon from './Icon'

/** Every badge: earned ones lit up, the rest show how to get them. */
export default function AchievementList() {
  const earned = useAchievementStore((s) => s.earned)
  const count = ACHIEVEMENTS.filter((a) => earned[a.id]).length
  return (
    <section>
      <h3 className="saved-h">Achievements <small className="muted">{count}/{ACHIEVEMENTS.length}</small></h3>
      <ul className="ach-grid">
        {ACHIEVEMENTS.map((a) => (
          <li key={a.id} data-earned={earned[a.id] ? 'true' : undefined} title={a.desc}>
            <span className="ach-badge" data-earned={earned[a.id] ? 'true' : undefined}><Icon name={earned[a.id] ? a.icon : 'lock'} size={20} /></span>
            <b>{a.name}</b>
            <small>{a.desc}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
