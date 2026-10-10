import { useState } from 'react'
import { rearmTutorial } from '../game/tutorial'
import { playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

const SECTIONS = [
  {
    title: 'How to play',
    items: [
      'Teams take turns. On your turn, flick one of your caps.',
      'Press on a cap, drag back like a slingshot, and let go. Longer drag = more power. (Prefer swiping forward? Switch it in Settings → Aiming.)',
      'The arrow shows where your cap goes; the blue ring shows where the ball will be hit.',
      'Your turn ends when everything stops moving.',
      'If the shot clock is on and runs out, you lose the turn (or the free kick or penalty).',
    ],
  },
  {
    title: 'Goals that count',
    items: [
      'The whole ball must cross the goal line between the posts. A ball resting on the line is not a goal yet — you can still clear it.',
      'A rebound off a goalpost can count. The post is not a pitch-edge cushion; the other scoring restrictions still apply.',
      'Your cap hitting the pitch edge does not disallow a goal. The edge restriction applies to the ball.',
      'In timed matches, most goals at full time wins and teams swap ends at half time. In first-to-score matches, reach the target to win.',
    ],
  },
  {
    title: 'Goal restrictions',
    items: [
      'You cannot score on the kick-off flick.',
      'You cannot score directly into the opponent’s goal from a goal kick, even off a goalpost.',
      'If the ball hits a pitch-edge cushion and then enters the goal without touching another cap, it is no goal. The defending team gets a goal kick.',
      'If the ball touches a cap after its edge bounce, the edge restriction is cleared. The goal can count unless another scoring restriction applies.',
      'Hitting an opponent’s cap before the ball is a foul, not a scoring play.',
    ],
  },
  {
    title: 'Goalkeepers',
    items: [
      'Goalkeepers can score in open play. The direct goal-kick restriction still applies.',
      'The goal-kick restriction does not cancel an own goal; other scoring restrictions still apply.',
      'Goalkeepers must stay inside their penalty area. You can only flick your goalkeeper when the ball is inside that area and within reach.',
    ],
  },
  {
    title: 'Replays and goal clips',
    items: [
      'Goal and no-goal replays explain the decision, including pitch-edge contact and goalpost rebounds.',
      'Only confirmed goals appear in Goal clips. Disallowed goals are not saved as scored-goal clips.',
    ],
  },
  {
    title: 'Play anytime',
    items: [
      'Each player has a set number of turns. Confirmed turns are saved, so you can leave and return to finish the match.',
      'Matches without a turn deadline can wait. If a deadline is set, it keeps running while you are away or the menu is open; missing it loses the match by forfeit.',
      'Most goals after both players finish their turns wins. Knockout draws go to penalties. During Play anytime penalties, the goalkeeper holds the centre.',
    ],
  },
  {
    title: 'Fouls',
    items: [
      'Hitting an opponent’s cap before the ball is a foul. Bouncing off the side cushion first is fine.',
      'A foul gives the other team a free kick from that spot, with a defensive wall.',
      'If the ball gets stuck in a corner: corner kick if the defenders touched it last, otherwise a goal kick.',
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
