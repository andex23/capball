import { useState } from 'react'
import { rearmTutorial } from '../game/tutorial'
import { playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

const SECTIONS = [
  {
    title: 'How to play',
    items: [
      'Teams take turns. On your turn, flick one of your caps.',
      'Press on a cap, drag back like a slingshot, and let go. Longer drag = more power.',
      'The arrow shows where your cap goes; the blue ring shows where the ball will be hit.',
      'Your turn ends when everything stops moving.',
    ],
  },
  {
    title: 'Scoring',
    items: [
      'Knock the ball into your opponent’s goal. Most goals at full time wins.',
      'You can’t score straight from a kick-off flick.',
      'Goalkeepers can’t score (own goals still count).',
      'Goalkeepers must stay inside their penalty area.',
      'Teams swap ends at half time.',
    ],
  },
  {
    title: 'Fouls',
    items: [
      'Hitting an opponent’s cap before the ball is a foul. Bouncing off the side cushion first is fine.',
      'A foul gives the other team a free kick from that spot, with a defensive wall.',
      'A foul in your own penalty area gives away a penalty.',
      'Only the designated taker can take a free kick or penalty.',
    ],
  },
  {
    title: 'Draws',
    items: ['A draw can be settled with a penalty shootout: best of three each, then sudden death.'],
  },
  {
    title: 'Camera',
    items: ['Right-drag (or two fingers) to rotate. Scroll or pinch to zoom. Use the camera button for preset views.'],
  },
]

/** Re-arms the first-match coach marks. */
function ReplayTutorial() {
  const [armed, setArmed] = useState(false)
  const replay = () => {
    playButtonSelect()
    rearmTutorial()
    setArmed(true)
  }
  return (
    <section>
      <h3 className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 8 }}>Tutorial</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-blue" onClick={replay}><Icon name="restart" size={18} /> Replay tutorial</button>
        <span className="muted" role="status" style={{ fontSize: 13 }}>
          {armed ? 'It’ll play on your next turn in a local or CPU match.' : ''}
        </span>
      </div>
    </section>
  )
}

export default function RulesPanel() {
  return SECTIONS.map((s) => (
    <section key={s.title}>
      <h3 className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 8 }}>{s.title}</h3>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18, color: 'var(--text-2)' }}>
        {s.items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </section>
  )).concat(<ReplayTutorial key="replay-tutorial" />)
}
