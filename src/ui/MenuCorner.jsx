/**
 * Top right of the main menu: a bell with what's new (game updates,
 * achievements, today's challenge, the next career match) and the player's
 * own cap, which opens their profile and the settings shortcuts.
 */
import { useState, useMemo, useEffect } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { useAccountStore } from '../state/accountStore'
import { useAchievementStore } from '../state/achievementStore'
import { useDailyStore, liveStreak } from '../state/dailyStore'
import { useCareerStore } from '../state/careerStore'
import { useSavedStore } from '../state/savedMatch'
import { useInboxStore } from '../state/inboxStore'
import { inboxItems, unreadCount, whenLabel } from '../game/inbox'
import { ACHIEVEMENTS } from '../game/achievements'
import { dayKey } from '../game/daily'
import { careerNext, careerDate, formatGameDate, ME } from '../game/career'
import { teamById } from '../game/tournament'
import { playButtonSelect, playMenuNavigate } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

const KIND_LABEL = { update: 'Game update', achievement: 'Achievement', daily: 'Daily challenge', career: 'Career' }
const KIND_TONE = { update: 'blue', achievement: 'gold', daily: 'green', career: 'purple' }
const TABS = [['all', 'All'], ['update', 'Updates'], ['achievement', 'Achievements']]

/** Everything the bell knows about right now. */
function useInbox() {
  const username = useAccountStore((s) => s.username)
  const earned = useAchievementStore((s) => s.earned)
  const daily = useDailyStore()
  const career = useCareerStore((s) => s.career)
  const seen = useInboxStore((s) => s.seen)
  return useMemo(() => {
    const today = dayKey()
    const dailyItem = username && !daily.tries?.[today]?.won ? { ready: true, day: today, streak: liveStreak(daily) } : null
    let careerItem = null
    const due = career && careerNext(career)
    if (due) {
      const t = due.kind === 'cup' ? career.cup?.tournament : career.league
      const f = due.fixture
      const opp = t && teamById(t, f.home === ME ? f.away : f.home)
      const when = careerDate(career)
      careerItem = { key: `${career.season}:${due.kind}:${f.id}`, text: `${career.club.name} v ${opp?.name || 'TBD'} on ${formatGameDate(when, { year: false })}.`, date: today }
    }
    return inboxItems({ earned: username ? earned : {}, daily: dailyItem, career: careerItem, seen })
  }, [username, earned, daily, career, seen])
}

function Bell({ count, open, onClick }) {
  return (
    <button className="corner-btn" aria-pressed={open} aria-label={count ? `What's new: ${count} unread` : "What's new"} onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
        <path fill="currentColor" d="M5 1h2v1h1v1h1v4h1v1H2V7h1V3h1V2h1zM5 9h2v1H5z" />
      </svg>
      {count > 0 && <span className="corner-badge">{count > 9 ? '9+' : count}</span>}
    </button>
  )
}

function WhatsNew({ items, onClose }) {
  const [tab, setTab] = useState('all')
  const shown = items.filter((i) => tab === 'all' || i.kind === tab)
  return (
    <section className="corner-sheet" role="dialog" aria-label="What's new">
      <header className="corner-sheet-head"><b>What’s new</b><button className="corner-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></header>
      <div className="corner-tabs" role="group">
        {TABS.map(([k, label]) => <button key={k} aria-pressed={tab === k} onClick={() => { playButtonSelect(); setTab(k) }}>{label}</button>)}
      </div>
      <ul className="corner-list">
        {shown.map((i) => (
          <li key={i.id} data-unread={i.unread ? 'true' : undefined}>
            <span className="corner-ic" data-tone={KIND_TONE[i.kind]}><Icon name={i.icon} size={20} /></span>
            <span className="corner-item">
              <b>{KIND_LABEL[i.kind]}</b>
              <strong>{i.title}</strong>
              <span>{i.text}</span>
              <small>{whenLabel(i.date)}</small>
            </span>
            {i.unread && <i className="corner-dot" aria-label="New" />}
          </li>
        ))}
        {!shown.length && <li className="corner-empty">Nothing here yet. Play a match and check back.</li>}
      </ul>
    </section>
  )
}

function Profile({ onClose, onOpen }) {
  const username = useAccountStore((s) => s.username)
  const kit = useMatchStore((s) => s.teamConfig.team1)
  const totals = useSavedStore((s) => s.career) || {}
  const earned = useAchievementStore((s) => s.earned)
  const badges = Object.keys(earned || {}).length
  const rows = [
    ['records', 'Records & badges', `${badges} of ${ACHIEVEMENTS.length}`],
    ['settings', 'Sound & settings', 'Sound, camera, controls'],
    ['account', username ? 'My games & account' : 'Save my games', username ? `Saved to ${username}` : 'Free account'],
    ['rules', 'How to play', 'Rules and tips'],
  ]
  return (
    <section className="corner-sheet" role="dialog" aria-label="Your profile">
      <header className="corner-sheet-head"><b>Your cap</b><button className="corner-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></header>
      <div className="corner-prof">
        <div className="corner-who">
          <CapPreview config={kit} size={78} number={kit.numbers?.atk1 ?? 10} />
          <div><div className="corner-name">{username || 'Guest'}</div><small>{username ? kit.name : 'Sign in to keep your records'}</small></div>
        </div>
        <div className="corner-stats">
          <div><b>{totals.played || 0}</b><span>Played</span></div>
          <div><b>{totals.won || 0}</b><span>Won</span></div>
          <div><b>{totals.goalsFor || 0}</b><span>Goals</span></div>
          <div><b>{badges}</b><span>Badges</span></div>
        </div>
        <nav className="corner-rows">
          {rows.map(([k, title, sub]) => (
            <button key={k} onClick={() => { playMenuNavigate(); onOpen(k) }}><b>{title}</b><small>{sub}</small><Icon name="next" size={16} /></button>
          ))}
        </nav>
      </div>
    </section>
  )
}

/** onOpen(dialog): opens one of the menu's dialogs ('records', 'settings', 'account', 'rules'). */
export default function MenuCorner({ onOpen }) {
  const [open, setOpen] = useState(null) // 'bell' | 'me' | null
  const items = useInbox()
  const count = unreadCount(items)
  const username = useAccountStore((s) => s.username)
  const kit = useMatchStore((s) => s.teamConfig.team1)
  // Opening the bell reads everything in it
  useEffect(() => { if (open === 'bell' && count) useInboxStore.getState().markSeen(items.filter((i) => i.unread).map((i) => i.id)) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the unread marks showing while the sheet is open
  const [snapshot, setSnapshot] = useState(items)
  const toggle = (which) => { playButtonSelect(); if (which === 'bell') setSnapshot(items); setOpen(open === which ? null : which) }
  return (
    <>
      <div className="menu-corner">
        <Bell count={count} open={open === 'bell'} onClick={() => toggle('bell')} />
        <button className="corner-me" aria-pressed={open === 'me'} aria-label="Your profile" onClick={() => toggle('me')}>
          <CapPreview config={kit} size={34} number={kit.numbers?.atk1 ?? 10} />
          <span>{username || 'Guest'}</span>
        </button>
      </div>
      {open && <div className="corner-dim" onClick={() => setOpen(null)} />}
      {open === 'bell' && <WhatsNew items={snapshot} onClose={() => setOpen(null)} />}
      {open === 'me' && <Profile onClose={() => setOpen(null)} onOpen={(d) => { setOpen(null); onOpen(d) }} />}
    </>
  )
}
