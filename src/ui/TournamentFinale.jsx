import { useEffect, useMemo } from 'react'
import { tournamentStory } from '../game/tournamentStory'
import { playButtonSelect, playCrowdRoar, playCrowdGroan, playFinalWhistle } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'
import { displayColor, inkOn } from './color'

/** A plain gold cup, drawn here (generic trophy shape). */
function Trophy({ tone = 'gold' }) {
  const [hi, mid, lo] = tone === 'silver' ? ['#ffffff', '#cfd6e4', '#8a93a6'] : ['#fff3b0', '#ffc531', '#b7790a']
  return (
    <svg className="finale-trophy" viewBox="0 0 120 140" aria-hidden="true">
      <defs>
        <linearGradient id={`cup-${tone}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lo} /><stop offset="0.35" stopColor={hi} /><stop offset="0.6" stopColor={mid} /><stop offset="1" stopColor={lo} />
        </linearGradient>
      </defs>
      <g stroke="#0b0830" strokeWidth="4" strokeLinejoin="round">
        <path d="M30 18 H90 V44 C90 66 76 80 60 82 C44 80 30 66 30 44 Z" fill={`url(#cup-${tone})`} />
        <path d="M30 26 H16 C14 46 22 56 34 60" fill="none" strokeWidth="6" stroke={mid} />
        <path d="M90 26 H104 C106 46 98 56 86 60" fill="none" strokeWidth="6" stroke={mid} />
        <path d="M30 26 H16 C14 46 22 56 34 60 M90 26 H104 C106 46 98 56 86 60" fill="none" />
        <rect x="52" y="82" width="16" height="18" fill={`url(#cup-${tone})`} />
        <path d="M38 100 H82 L88 122 H32 Z" fill={`url(#cup-${tone})`} />
        <rect x="26" y="122" width="68" height="10" fill="#3a2a10" />
      </g>
      <path d="M42 26 V44 C42 56 48 64 54 68" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function Confetti({ colors }) {
  const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 14) * 0.18, dur: 2.6 + (i % 5) * 0.5, rot: (i * 47) % 360, color: colors[i % colors.length], w: 6 + (i % 3) * 3,
  })), [colors])
  return (
    <div className="finale-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: b.color, width: b.w, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  )
}

/** The end of a tournament, told from the player's side. */
export default function TournamentFinale({ t, mine, onClose, onNew }) {
  const story = useMemo(() => tournamentStory(t, mine), [t, mine])
  const outcome = story?.outcome
  useEffect(() => {
    if (!outcome) return
    if (outcome === 'champion') playCrowdRoar()
    else if (outcome === 'runnerUp' || outcome === 'knockedOut') playCrowdGroan()
    else playFinalWhistle()
  }, [outcome])
  if (!story) return null
  const hero = story.team || story.champ
  const color = displayColor(hero.primary)
  const win = outcome === 'champion' || outcome === 'watched'
  const close = () => { playButtonSelect(); onClose() }
  const r = story.record
  return (
    <div className="finale" data-outcome={outcome} role="dialog" aria-modal="true" aria-label={story.title} style={{ '--team': color, '--team-ink': inkOn(hero.primary) }}>
      <div className="finale-rays" aria-hidden="true" />
      {win && <Confetti colors={[color, displayColor(hero.edge || '#ffffff'), '#ffd23f', '#ffffff']} />}
      <div className="finale-card">
        <div className="finale-top">
          {(outcome === 'champion' || outcome === 'watched') && <Trophy />}
          {outcome === 'runnerUp' && <Trophy tone="silver" />}
          <div className="finale-cap"><CapPreview config={hero} size={112} /></div>
        </div>
        <div className="finale-title">{story.title}</div>
        <h2 className="finale-headline">{story.headline}</h2>
        {story.lines.map((l) => <p key={l} className="finale-line">{l}</p>)}
        {r && (
          <div className="finale-record" aria-label="Record">
            <span><b>{r.p}</b><small>Played</small></span>
            <span data-tone="good"><b>{r.w}</b><small>Won</small></span>
            <span><b>{r.d}</b><small>Drawn</small></span>
            <span data-tone="bad"><b>{r.l}</b><small>Lost</small></span>
            <span><b>{r.gf}</b><small>Scored</small></span>
            <span><b>{r.ga}</b><small>Conceded</small></span>
          </div>
        )}
        {story.scorer && (
          <p className="finale-scorer">
            <Icon name="ball" size={16} /> Golden Cap: <b>{story.scorer.number != null ? `#${story.scorer.number} ` : ''}{story.scorer.name}</b> ({story.scorer.team}) · {story.scorer.goals} goal{story.scorer.goals === 1 ? '' : 's'}
          </p>
        )}
        {outcome !== 'champion' && outcome !== 'watched' && <p className="finale-champ"><Icon name="trophy" size={16} /> {story.champ.name} are the {t.format === 'league' ? 'champions' : 'cup winners'}</p>}
        <div className="finale-actions">
          <button className="btn btn-gold btn-lg" onClick={() => { playButtonSelect(); onNew() }}>{outcome === 'champion' ? 'Defend the title' : 'Go again'} <Icon name="next" size={18} /></button>
          <button className="btn btn-secondary" onClick={close}>{t.format === 'league' ? 'See the table' : 'See the bracket'}</button>
        </div>
      </div>
    </div>
  )
}
