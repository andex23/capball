/**
 * The Training Ground: pick a skill (five tries, stars for goals) or Free
 * play. Nothing here counts. Reached from the little cone in your profile.
 */
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTrainingStore, skillStars } from '../state/trainingStore'
import { SKILLS, LEVELS, TRIES, STAR_GOALS } from '../game/training'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Icon from '../ui/Icon'
import Cone from '../ui/Cone'
import '../ui/training.css'

const Stars = ({ n }) => (
  <span className="tg-stars" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} data-on={i < n ? 'true' : undefined}>★</i>)}</span>
)

export default function TrainingScreen() {
  const best = useTrainingStore((s) => s.best)
  const level = useTrainingStore((s) => s.level)
  const t = useTrainingStore.getState()
  const total = SKILLS.reduce((n, s) => n + skillStars(best, s.id), 0)
  return (
    <div className="screen">
      <div className="shell">
        <header className="shell-head tour-top">
          <button className="tour-back" onClick={() => { playButtonSelect(); useMatchStore.getState().goToScreen(SCREEN.MENU) }} aria-label="Back to the menu"><Icon name="back" size={18} /></button>
          <div>
            <h1 className="display tour-title">Training Ground</h1>
            <div className="tour-sub">No clock, no score, nothing to lose</div>
          </div>
          <span className="tg-cone"><Cone size={30} /></span>
        </header>
        <main className="shell-body tg">
          <div className="tg-sec"><span>Skills</span><b>{total} / {SKILLS.length * 3} ★</b></div>
          <ul className="tg-skills">
            {SKILLS.map((s) => (
              <li key={s.id}>
                <button onClick={() => { playConfirm(); t.startSkill(s.id) }}>
                  <span className="tg-skill"><b>{s.name}</b><small>{s.sub}</small></span>
                  <Stars n={skillStars(best, s.id)} />
                </button>
              </li>
            ))}
          </ul>
          <p className="tg-note">{TRIES} tries each: {STAR_GOALS.map((g, i) => `${'★'.repeat(i + 1)} ${g} goal${g === 1 ? '' : 's'}`).join(' · ')}. Stars count against a Medium or Hard keeper.</p>

          <div className="tg-sec"><span>Keeper</span></div>
          <div className="segmented tg-level" role="group" aria-label="Keeper">
            {LEVELS.map((l) => <button key={l} aria-pressed={level === l} onClick={() => { playButtonSelect(); t.setLevel(l) }}>{l[0].toUpperCase() + l.slice(1)}</button>)}
          </div>

          <div className="tg-sec"><span>Sandbox</span></div>
          <button className="tg-free" onClick={() => { playConfirm(); t.startFree() }}>
            <b>Free play</b>
            <span>Put the caps and ball anywhere, then try it. Undo a flick, slow it down, add a wall. Chips are unlimited.</span>
            <Icon name="next" size={18} />
          </button>
        </main>
      </div>
    </div>
  )
}
