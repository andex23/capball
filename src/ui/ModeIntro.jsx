/**
 * How a mode works: a few swipeable cards (a real screenshot, a title, a line
 * or two), shown once to players new to the mode and any time from its "?".
 * Mounted once in App; opened through useIntroStore.
 */
import { useState, useEffect, useRef } from 'react'
import { useIntroStore } from '../state/introStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { MODE_INTROS } from '../data/modeIntros'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Icon from './Icon'
import './modeIntro.css'

/** "**bold**" in the card text. */
function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>))
}

export default function ModeIntro() {
  const mode = useIntroStore((s) => s.open)
  if (!mode || !MODE_INTROS[mode]) return null
  return <Cards key={mode} intro={MODE_INTROS[mode]} />
}

function Cards({ intro }) {
  const [i, setI] = useState(0)
  const start = useRef(null)
  const cards = intro.cards
  const last = i === cards.length - 1
  const close = () => { playConfirm(); useIntroStore.getState().close() }
  const go = (n) => { if (n >= 0 && n < cards.length) { playButtonSelect(); setI(n) } }
  // Keyboard: arrows move, Enter goes on, Escape skips
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); if (last) close(); else go(i + 1) }
      if (e.key === 'ArrowLeft') go(i - 1)
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const c = cards[i]
  return (
    <div className="mi-overlay" role="dialog" aria-modal="true" aria-label={`How ${intro.label} works`}
      onPointerDown={(e) => { start.current = e.clientX }}
      onPointerUp={(e) => { if (start.current == null) return; const dx = e.clientX - start.current; start.current = null; if (dx < -40) go(i + 1); if (dx > 40) go(i - 1) }}>
      <div className="mi-card">
        <div className="mi-tab">{intro.label}</div>
        <button className="mi-skip" onClick={close}>{last ? 'Close' : 'Skip'}</button>
        <img className="mi-shot" src={`${import.meta.env.BASE_URL}intro/${c.img}.webp`} alt="" draggable="false" />
        <h2 className="mi-title">{c.title}</h2>
        <p className="mi-text"><Rich text={c.text} /></p>
        <div className="mi-foot">
          <div className="mi-dots" aria-label={`Card ${i + 1} of ${cards.length}`}>
            {cards.map((_, k) => <button key={k} aria-label={`Card ${k + 1}`} aria-current={k === i ? 'true' : undefined} onClick={() => go(k)} />)}
          </div>
          <div className="mi-btns">
            {i > 0 && <button className="mi-back" onClick={() => go(i - 1)} aria-label="Back"><Icon name="back" size={16} /></button>}
            <button className="btn btn-gold mi-next" onClick={() => (last ? close() : go(i + 1))}>{last ? 'Got it' : 'Next'} <Icon name={last ? 'check' : 'next'} size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The "?" a mode's screen shows: its cards again. */
export function IntroButton({ mode, className = '' }) {
  return (
    <button className={`mi-help ${className}`} onClick={() => { playButtonSelect(); useIntroStore.getState().show(mode) }} aria-label={`How ${MODE_INTROS[mode]?.label || 'this mode'} works`}>?</button>
  )
}

/** Which mode's cards belong to the match on screen (for its pause menu), or null. */
export function modeOfMatch(ms = useMatchStore.getState(), playing = useTournamentStore.getState().playing) {
  if (ms.challenge) return 'daily'
  if (playing) {
    if (['career', 'careerCup', 'careerCcl'].includes(playing.kind)) return 'career'
    if (playing.kind === 'local') return useTournamentStore.getState().local?.weekly ? 'weekly' : 'tournament'
    return null
  }
  return ms.gameMode === 'local' ? 'local' : null
}

/** The daily challenge and two players on one phone: their cards show as the first match kicks off. */
export function MatchIntros() {
  useEffect(() => useMatchStore.subscribe((s, prev) => {
    if (s.screen !== SCREEN.PLAYING || prev.screen === SCREEN.PLAYING) return
    const mode = modeOfMatch(s)
    if (mode === 'daily' || mode === 'local') useIntroStore.getState().maybeShow(mode)
  }), [])
  return null
}
