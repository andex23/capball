/**
 * The Training Ground in play: a thin strip at the top (the skill, its five
 * tries, or Free play), one line after each flick, the end-of-skill stars,
 * and Free play's tools behind a single button.
 */
import { useEffect, useState } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { useTrainingStore } from '../state/trainingStore'
import { skillById, TRIES, starsFor, LEVELS, STAR_GOALS } from '../game/training'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Icon from './Icon'
import './training.css'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

function Note() {
  const note = useTrainingStore((s) => s.note)
  const [shown, setShown] = useState(null)
  useEffect(() => {
    if (!note) { setShown(null); return }
    setShown(note)
    const t = setTimeout(() => setShown(null), 1800)
    return () => clearTimeout(t)
  }, [note])
  if (!shown) return null
  return <div className="tg-toast" role="status" data-good={shown.outcome === 'goal' ? 'true' : undefined}>{shown.text}</div>
}

function Done({ training }) {
  const t = useTrainingStore.getState()
  const goals = training.results.filter((r) => r === 'goal').length
  const stars = starsFor(goals)
  const skill = skillById(training.skill)
  const next = STAR_GOALS.find((g) => g > goals)
  const lvl = LEVELS.indexOf(training.level)
  return (
    <div className="tg-done" role="dialog" aria-label="Skill result">
      <div className="challenge-tab">{skill?.name}</div>
      <div className="tg-big" aria-label={`${stars} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} data-on={i < stars ? 'true' : undefined}>★</i>)}</div>
      <p><b>{goals}</b> of {TRIES} in{next ? ` · score ${next} for ${stars + 1 === 1 ? 'a star' : `${stars + 1} stars`}` : ' · full marks!'}{training.level === 'easy' ? ' · stars count against a Medium or Hard keeper' : ''}</p>
      <p className="tg-tip"><b>Tip:</b> {skill?.tip}</p>
      <div className="challenge-actions">
        <button className="btn btn-gold" onClick={() => { playConfirm(); t.again() }}><Icon name="restart" size={18} /> Try again</button>
        {lvl < LEVELS.length - 1 && <button className="btn btn-secondary" onClick={() => { playConfirm(); t.setLevel(LEVELS[lvl + 1]); t.again() }}>Harder keeper</button>}
        <button className="btn btn-secondary" onClick={() => { playButtonSelect(); t.leave() }}><Icon name="exit" size={18} /> Training Ground</button>
      </div>
    </div>
  )
}

function Tools() {
  const s = useTrainingStore()
  const level = useMatchStore((m) => m.training?.level || 'medium')
  const phase = useMatchStore((m) => m.phase)
  const busy = phase === PHASE.RESOLVE || phase === PHASE.GOAL
  const act = (fn) => () => { playButtonSelect(); fn() }
  const nextLevel = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]
  return (
    <div className="tg-tools">
      <button className="tg-tb" aria-expanded={s.tools} onClick={act(s.toggleTools)}>Tools {s.tools ? '▴' : '▾'}</button>
      {s.tools && (
        <div className="tg-tray">
          <button aria-pressed={s.moving} onClick={act(s.toggleMove)}>{s.moving ? 'Moving: on' : 'Move caps'}</button>
          <button disabled={busy} onClick={act(() => s.undo())}>Undo flick</button>
          <button onClick={act(s.resetPitch)}>Reset</button>
          <button aria-pressed={s.slow} onClick={act(s.toggleSlow)}>Slow-mo</button>
          <button onClick={act(() => s.setLevel(nextLevel))}>Keeper: {cap(level)}</button>
          <button disabled={busy} onClick={act(s.addWall)}>Add wall</button>
          <button disabled={busy} onClick={act(s.clearPitch)}>Clear pitch</button>
          <button onClick={act(s.leave)}>Leave</button>
        </div>
      )}
    </div>
  )
}

export default function TrainingHud() {
  const training = useMatchStore((s) => s.training)
  const paused = useMatchStore((s) => s.paused)
  const moving = useTrainingStore((s) => s.moving)
  if (!training || paused) return null
  if (training.mode === 'skill' && training.done) return <Done training={training} />
  const skill = skillById(training.skill)
  return (
    <>
      <div className="tg-strip" role="status">
        {training.mode === 'skill' ? (
          <>
            <b>{skill?.name}</b>
            <span className="tg-dots" aria-label={`${training.results.filter((r) => r === 'goal').length} goals so far`}>
              {Array.from({ length: TRIES }, (_, i) => <i key={i} data-r={training.results[i] || undefined} data-now={i === training.n ? 'true' : undefined} />)}
            </span>
            <span>Try <b>{Math.min(training.n + 1, TRIES)}</b>/{TRIES}</span>
          </>
        ) : (
          <><b>Free play</b><span>{moving ? 'Drag any cap or the ball' : `${cap(training.level)} keeper`}</span></>
        )}
        <button className="tg-x" onClick={() => { playButtonSelect(); useTrainingStore.getState().leave() }} aria-label="Leave"><Icon name="close" size={14} /></button>
      </div>
      {training.mode === 'free' && <Tools />}
      <Note />
    </>
  )
}
