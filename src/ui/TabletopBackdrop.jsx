import CapPreview from './CapPreview'

/**
 * Menu backdrop: looking down on a wooden table with the felt board on it,
 * a few caps and the ball mid-game. Plain SVG and CSS — no 3D, so the menu
 * opens instantly and stays light on phones.
 */

// Caps scattered over the board: [x %, y %, size vmin, kit]
const RED = { primary: '#D32F2F', edge: '#FFD700', badge: 'none', pattern: 'none', finish: 'gloss' }
const BLUE = { primary: '#1565C0', edge: '#FFFFFF', badge: 'none', pattern: 'none', finish: 'gloss' }
const CAPS = [
  [58, 30, 13, RED, 10],
  [72, 52, 13, RED, 9],
  [50, 64, 13, RED, 4],
  [84, 28, 13, BLUE, 7],
  [88, 70, 13, BLUE, 11],
  [66, 80, 13, BLUE, 3],
]

export default function TabletopBackdrop() {
  return (
    <div className="tabletop" aria-hidden="true">
      <div className="tabletop-board">
        <svg className="tabletop-lines" viewBox="0 0 300 200" preserveAspectRatio="none">
          <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2">
            <rect x="4" y="4" width="292" height="192" />
            <line x1="150" y1="4" x2="150" y2="196" />
            <circle cx="150" cy="100" r="28" />
            <rect x="4" y="40" width="58" height="120" />
            <rect x="238" y="40" width="58" height="120" />
            <rect x="4" y="70" width="24" height="60" />
            <rect x="272" y="70" width="24" height="60" />
          </g>
          <circle cx="150" cy="100" r="2" fill="rgba(255,255,255,0.7)" />
        </svg>
        {CAPS.map(([x, y, s, kit, n], i) => (
          <div key={i} className="tabletop-cap" style={{ left: `${x}%`, top: `${y}%`, width: `${s}vmin`, height: `${s}vmin`, '--d': `${i * 0.15}s` }}>
            <CapPreview config={kit} size={120} number={n} />
          </div>
        ))}
        <div className="tabletop-ball" style={{ left: '63%', top: '45%' }} />
      </div>
    </div>
  )
}
