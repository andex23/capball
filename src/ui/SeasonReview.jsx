/**
 * The end of a career season, the FIFA way: the season in numbers and its
 * best player, then (once the new season is set up) a summer review of what
 * changed: the academy's best youngster, who retired or left, what the clubs
 * in your new division bought, and what the board wants. Opens once.
 */
import { DIVISIONS, TARGETS, seasonRecord } from '../game/career'
import { money } from '../game/squad'
import { useCareerStore } from '../state/careerStore'
import { playConfirm } from '../audio/SoundManager'
import Icon from './Icon'

/** Wins, goals and clean sheets, plus the player of the season (on the season-end card). */
export function SeasonNumbers({ career, awards }) {
  const r = seasonRecord(career.league)
  const best = awards?.pots
  const boot = awards?.boot
  return (
    <>
      <div className="sr-tiles">
        <div><b>{r.w}</b><small>Won</small></div>
        <div><b>{r.gf}</b><small>Goals</small></div>
        <div><b>{r.cs}</b><small>Clean sheets</small></div>
      </div>
      {best && (
        <div className="sr-pots">
          <span className="sr-pots-badge" aria-hidden>★</span>
          <div>
            <small>Player of the season</small>
            <b>{best.name}</b>
            <span>Average rating {best.avg}{boot?.name === best.name ? ` · ${boot.goals} goal${boot.goals === 1 ? '' : 's'}` : ''}</span>
          </div>
        </div>
      )}
    </>
  )
}

/** The summer's news, as items: [{ icon, tone, title, text }], most exciting first. */
export function summerItems(career) {
  const s = career.lastSummer
  if (!s) return []
  const items = []
  const kid = (s.youthIn || []).slice().sort((a, b) => (b.pot || 0) - (a.pot || 0))[0]
  if (kid) items.push({ icon: 'star', tone: 'gold', title: kid.pot >= 75 ? 'Wonderkid from the academy' : 'New from the academy', text: `${kid.name}, ${kid.age || 16}, ${kid.pos} · ${kid.rating} now${kid.pot ? `, potential ${kid.pot}` : ''}` })
  const ups = (s.changes || []).filter((c) => c.to > c.from).sort((a, b) => (b.to - b.from) - (a.to - a.from))[0]
  if (ups) items.push({ icon: 'up', tone: 'good', title: 'Big summer for', text: `${ups.name}: ${ups.from} → ${ups.to}` })
  for (const r of (s.retired || []).slice(0, 2)) items.push({ icon: 'wave', tone: '', title: `${r.name} retires`, text: `at ${r.age}${r.left ? '' : '. A youth player takes his place.'}` })
  for (const n of (s.left || []).slice(0, 2)) items.push({ icon: 'out', tone: 'bad', title: `${n} has left`, text: 'His contract ran out and he went on a free.' })
  for (const n of (s.unhappy || []).slice(0, 1)) items.push({ icon: 'out', tone: 'bad', title: `${n} wants out`, text: 'He’s unhappy with his game time.' })
  for (const p of (s.loansBack || []).slice(0, 1)) items.push({ icon: 'back', tone: '', title: `${p.name} is back from loan`, text: `Now rated ${p.rating}.` })
  // What the clubs you'll face this season did in the market
  const rivals = (s.world || []).filter((n) => n.type === 'transfer' && n.level === career.level).slice(0, 2)
  for (const n of rivals) items.push({ icon: 'money', tone: '', title: `${n.to} sign ${n.name}`, text: `${n.ovr} OVR${n.fee ? ` for ${money(n.fee)}` : ' on a free'}. Your rivals are spending.` })
  return items
}

const ICON = { star: '🌟', up: '📈', wave: '👋', out: '🚪', back: '↩️', money: '💸', board: '📋' }

/** The summer review: opens once when a new season starts. */
export function SummerReview({ career }) {
  const items = summerItems(career)
  const last = career.past?.[0]
  const close = () => { playConfirm(); useCareerStore.getState().seeSummer() }
  return (
    <div className="sr-overlay" role="dialog" aria-modal="true" aria-label={`Summer before season ${career.season}`}>
      <div className="sr-sheet">
        <div className="sr-tab">This summer</div>
        <h2 className="sr-title">Season {career.season}</h2>
        <p className="sr-sub">{DIVISIONS[career.level].name}{last ? ` · last season: ${ordinal(last.position)} in the ${last.division}` : ''}</p>
        <ul className="sr-news">
          {items.map((it, i) => (
            <li key={i} data-tone={it.tone || undefined}>
              <span aria-hidden>{ICON[it.icon]}</span>
              <div><b>{it.title}</b> {it.text}</div>
            </li>
          ))}
          {career.target && (
            <li data-tone="gold">
              <span aria-hidden>{ICON.board}</span>
              <div><b>The board’s goal:</b> {TARGETS[career.target]}.{career.warning ? ' You’re on a final warning.' : ''}</div>
            </li>
          )}
        </ul>
        <button className="btn btn-gold btn-lg btn-block" onClick={close}>Start season {career.season} <Icon name="next" size={18} /></button>
      </div>
    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
