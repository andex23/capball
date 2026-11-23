/**
 * Options → Feedback: a face, what it's about, any suggestions. Sent to our
 * server with no name attached. Only here: the game never asks mid-flow.
 */
import { useState } from 'react'
import { isLagos } from '../platform'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import './feedback.css'

const MOODS = [{ key: 'love', face: '😍', label: 'Love it' }, { key: 'ok', face: '🙂', label: 'It’s OK' }, { key: 'meh', face: '😕', label: 'Not great' }]
const ABOUT = [
  { key: 'too_hard', label: 'Too hard' }, { key: 'controls', label: 'Controls confusing' }, { key: 'crash', label: 'It froze or crashed' },
  { key: 'slow', label: 'Slow on my phone' }, { key: 'boring', label: 'Boring after a while' }, { key: 'idea', label: 'Idea for the game' }, { key: 'other', label: 'Other' },
]

export default function FeedbackPanel({ onDone }) {
  const [mood, setMood] = useState(null)
  const [about, setAbout] = useState([])
  const [text, setText] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error | too-many

  const toggle = (k) => { playButtonSelect(); setAbout((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k])) }
  const send = async () => {
    if (!mood || state === 'sending') return
    playConfirm()
    setState('sending')
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mood, about, text, from: isLagos() ? 'lagos' : 'web' }) })
      setState(r.ok ? 'sent' : r.status === 429 ? 'too-many' : 'error')
    } catch { setState('error') }
  }

  if (state === 'sent') {
    return (
      <div className="fb-thanks" role="status">
        <div aria-hidden>🙌</div>
        <h3 className="display">Thanks!</h3>
        <button className="btn btn-primary btn-block" onClick={onDone}>Done</button>
      </div>
    )
  }
  return (
    <div className="fb">
      <div className="fb-moods" role="radiogroup" aria-label="How’s the game?">
        {MOODS.map((m) => (
          <button key={m.key} role="radio" aria-checked={mood === m.key} onClick={() => { playButtonSelect(); setMood(m.key) }}>
            <span aria-hidden>{m.face}</span><small>{m.label}</small>
          </button>
        ))}
      </div>
      <div className="fb-label">About</div>
      <div className="fb-chips">
        {ABOUT.map((a) => <button key={a.key} aria-pressed={about.includes(a.key)} onClick={() => toggle(a.key)}>{a.label}</button>)}
      </div>
      <label className="fb-label" htmlFor="fb-text">Any suggestions for improvement?</label>
      <textarea id="fb-text" maxLength={500} placeholder="Type here (optional)" value={text} onChange={(e) => setText(e.target.value)} />
      {state === 'error' && <p className="fb-note" role="alert">Couldn’t send it. Check your connection and try again.</p>}
      {state === 'too-many' && <p className="fb-note" role="alert">That’s enough for today. Thanks!</p>}
      <button className="btn btn-gold btn-lg btn-block" disabled={!mood || state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
    </div>
  )
}
