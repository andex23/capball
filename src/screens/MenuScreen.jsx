import { useState, useEffect, useCallback } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import Modal from '../ui/Modal'
import SettingsPanel from '../ui/SettingsPanel'
import RulesPanel from '../ui/RulesPanel'
import RankingsPanel from '../ui/RankingsPanel'
import AccountPanel from '../ui/AccountPanel'
import { useAccountStore } from '../state/accountStore'
import InstallGuide from '../pwa/InstallGuide'
import { useCanInstall, promptInstall, isStandalone } from '../pwa/install'
import { playButtonSelect, playConfirm, playMenuNavigate, playCoinInsert } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'
import { useSavedStore, resumeSavedMatch, describeSave } from '../state/savedMatch'
import { useTournamentStore } from '../state/tournamentStore'
import { allFixtures } from '../game/tournament'
import { RetroBackdrop, RetroLogo } from '../ui/Retro'
import { useDailyStore, playDaily, liveStreak } from '../state/dailyStore'
import { challengeFor, dayKey } from '../game/daily'
import { useCareerStore } from '../state/careerStore'
import { DIVISIONS } from '../game/career'

/**
 * Home screen in the style of a 16-bit console football game: a title card
 * with "Press start", then a boxed mode-select window with a cursor that
 * moves with taps, the mouse or the arrow keys.
 */

// The menu is a few short pages, like an old console game: the main page,
// and one page each for quick matches, tournaments and options
const PAGE_TITLES = { main: 'Main menu', play: 'Quick match', tournament: 'Tournament', options: 'Options' }
const DIFFICULTIES = ['easy', 'medium', 'hard']

// The title card shows once per visit; coming back from a match goes straight to the menu
let pressedStart = false
/** The splash screen is the title card: once it's been tapped, go straight to the menu. */
export function markStarted() { pressedStart = true }

/** The cursor: a little pixel bottle cap. */
function CapCursor() {
  return (
    <svg className="iss-cursor" viewBox="0 0 10 10" width="20" height="20" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#1a0b00" d="M3 0h4v1h2v2h1v4H9v2H7v1H3V9H1V7H0V3h1V1h2z" />
      <path fill="#e8261f" d="M3 1h4v1h1v1h1v4H8v1H7v1H3V8H2V7H1V3h1V2h1z" />
      <path fill="#ffd23f" d="M4 3h2v1h1v2H6v1H4V6H3V4h1z" />
      <path fill="#ffffff" d="M3 2h2v1H3z" />
    </svg>
  )
}

export default function MenuScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const setGameMode = useMatchStore((s) => s.setGameMode)
  const aiDifficulty = useMatchStore((s) => s.aiDifficulty)
  const setAiDifficulty = useMatchStore((s) => s.setAiDifficulty)
  const username = useAccountStore((s) => s.username)
  const canInstall = useCanInstall()
  const installed = isStandalone()
  const localT = useTournamentStore((s) => s.local)
  const localFixtures = localT ? allFixtures(localT) : []
  const localDone = localFixtures.filter((f) => f.result).length
  const localTotal = localFixtures.length
  const [dialog, setDialog] = useState(null) // 'settings' | 'rules' | 'records' | 'account' | 'daily' | null
  const [started, setStarted] = useState(pressedStart)
  const [cursor, setCursor] = useState(0)
  const saved = useSavedStore((s) => s.saved)
  const career = useCareerStore((s) => s.career)
  const daily = useDailyStore()
  const doneToday = !!daily.tries?.[dayKey()]?.won
  const streak = liveStreak(daily)
  const [page, setPage] = useState('main')
  useEffect(() => { startMenuMusic() }, [])

  const start = useCallback(() => {
    if (pressedStart) return
    pressedStart = true
    playCoinInsert()
    setStarted(true)
  }, [])

  const moveTo = (i) => {
    if (i === cursor) return
    playMenuNavigate()
    setCursor(i)
  }

  const shiftLevel = (step) => {
    const i = DIFFICULTIES.indexOf(aiDifficulty)
    const next = DIFFICULTIES[(i + step + DIFFICULTIES.length) % DIFFICULTIES.length]
    playButtonSelect()
    setAiDifficulty(next)
  }

  const go = (p) => { playMenuNavigate(); setPage(p); setCursor(0) }
  const openDialog = (d) => { playMenuNavigate(); setDialog(d) }
  const play = (mode) => { playConfirm(); setGameMode(mode); goToScreen(SCREEN.TEAM_SELECT) }
  const tournament = (format) => {
    playConfirm()
    useTournamentStore.getState().setSetupFormat(format)
    goToScreen(SCREEN.TOURNAMENT_HOME)
  }
  const level = aiDifficulty[0].toUpperCase() + aiDifficulty.slice(1)
  const back = { key: 'back', title: '◄ Back', small: true, action: () => go('main') }

  // Each item: key, title, optional sub (a line under it), right (a tag or picker), action
  const PAGES = {
    main: [
      ...(saved ? [{ key: 'continue', title: 'Continue', sub: describeSave(saved), tag: 'SAVE', action: () => { playConfirm(); resumeSavedMatch() } }] : []),
      ...(localT && !localT.championId ? [{
        key: 'continueT', title: `Continue ${localT.format === 'league' ? 'league' : 'cup'}`,
        sub: `${localT.teams.length} teams · ${localDone}/${localTotal} played — saved`, tag: 'SAVE',
        action: () => { playConfirm(); useTournamentStore.getState().openHub('local') },
      }] : []),
      { key: 'play', title: 'Quick Match', sub: 'Vs computer, two players, online', tag: '►', action: () => go('play') },
      { key: 'career', title: 'Career', sub: !username ? 'Needs an account — saved as you play' : career ? `${career.club.name} · Season ${career.season} · ${DIVISIONS[career.level].name}` : 'Take your club from the Sunday League to the top', tag: 'PRO', action: () => { playConfirm(); goToScreen(SCREEN.CAREER) } },
      { key: 'tournament', title: 'Tournament', sub: 'Leagues and cups, here or online', tag: '►', action: () => go('tournament') },
      { key: 'daily', title: 'Daily Challenge', sub: !username ? 'Needs an account — build a streak for rewards' : doneToday ? 'Beaten today — back tomorrow' : 'A new puzzle every day', tag: !username ? 'PRO' : doneToday ? 'DONE' : streak ? `x${streak}` : 'NEW', done: !!username && doneToday, action: () => openDialog('daily') },
      { key: 'options', title: 'Options', sub: 'Rankings, my games, settings, how to play', tag: '►', action: () => go('options') },
      ...(!installed ? [{ key: 'install', title: 'Add to Home Screen', sub: 'Play full screen, like an app', tag: '+', action: () => { playConfirm(); if (canInstall) promptInstall(); else openDialog('install') } }] : []),
    ],
    play: [
      { key: 'ai', title: 'Vs Computer', picker: 'level', action: () => play('ai') },
      { key: 'local', title: 'Local Match', sub: 'Two players, one phone', tag: '2P', action: () => play('local') },
      { key: 'online', title: 'Online Match', sub: 'Play a friend on their own phone', tag: 'NET', action: () => { playConfirm(); goToScreen(SCREEN.ONLINE) } },
      back,
    ],
    tournament: [
      { key: 'league', title: 'League', sub: 'Everyone plays everyone; most points wins', action: () => tournament('league') },
      { key: 'cup', title: 'Cup', sub: 'Knockout ties; lose and you’re out', action: () => tournament('knockout') },
      back,
    ],
    options: [
      { key: 'records', title: 'Rankings', sub: 'Leaderboards and your records', action: () => openDialog('records') },
      { key: 'account', title: username ? `My games · ${username}` : 'My games', sub: username ? 'Saved match, career totals, results' : 'Save your games to an account', action: () => openDialog('account') },
      { key: 'settings', title: 'Settings', sub: 'Sound, music, aiming', action: () => openDialog('settings') },
      { key: 'rules', title: 'How to play', action: () => openDialog('rules') },
      back,
    ],
  }
  const items = PAGES[page]

  // Arrow keys / Enter, like a pad
  useEffect(() => {
    const onKey = (e) => {
      if (dialog) return
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return
      if (!started) {
        if (['Enter', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); start() }
        return
      }
      const n = items.length
      const item = items[Math.min(cursor, n - 1)]
      if (e.key === 'ArrowDown') { e.preventDefault(); playMenuNavigate(); setCursor((c) => (c + 1) % n) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); playMenuNavigate(); setCursor((c) => (c - 1 + n) % n) }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && item?.picker === 'level') {
        e.preventDefault(); shiftLevel(e.key === 'ArrowLeft' ? -1 : 1)
      } else if ((e.key === 'Escape' || e.key === 'Backspace') && page !== 'main') {
        e.preventDefault(); go('main')
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault(); item?.action()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`screen iss${started ? ' is-started' : ''}`} onClick={!started ? start : undefined}>
      <RetroBackdrop />

      <div className="iss-layout">
        <RetroLogo />

        {!started ? (
          <button className="iss-press" onClick={(e) => { e.stopPropagation(); start() }}>
            Press start
          </button>
        ) : (
          <main className="iss-window" aria-label={PAGE_TITLES[page]} key={page}>
            <div className="iss-window-tab">{PAGE_TITLES[page]}</div>
            <ul className="iss-list" role="menu">
              {items.map((m, i) => (
                <li key={m.key} role="none" className={`iss-row${m.small ? ' is-small' : ''}${cursor === i ? ' is-on' : ''}`} onPointerEnter={(e) => e.pointerType === 'mouse' && moveTo(i)}>
                  {cursor === i && <CapCursor />}
                  <button role="menuitem" className="iss-item" onClick={m.action} onFocus={() => setCursor(i)}>
                    {m.title}
                    {m.sub && <small className="iss-sub">{m.sub}</small>}
                  </button>
                  {m.picker === 'level' ? (
                    <span className="iss-level" role="group" aria-label="Computer level">
                      <button className="iss-arrow" aria-label="Easier" onClick={() => { setCursor(i); shiftLevel(-1) }}>◄</button>
                      <span className="iss-level-name" data-level={aiDifficulty}>{level}</span>
                      <button className="iss-arrow" aria-label="Harder" onClick={() => { setCursor(i); shiftLevel(1) }}>►</button>
                    </span>
                  ) : m.tag ? (
                    <span className="iss-tag" data-done={m.done ? 'true' : undefined} data-arrow={m.tag === '►' ? 'true' : undefined}>{m.tag}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </main>
        )}

        <footer className="iss-foot">
          <span>© 2026 Capball</span>
          <span className="iss-keys">▲▼ Select &nbsp; Enter OK &nbsp; Esc Back</span>
        </footer>
      </div>

      {dialog === 'settings' && (
        <Modal title="Settings" onClose={() => setDialog(null)}>
          <SettingsPanel />
        </Modal>
      )}
      {dialog === 'records' && (
        <Modal title="Rankings" onClose={() => setDialog(null)}>
          <RankingsPanel />
        </Modal>
      )}
      {dialog === 'account' && (
        <Modal title={username ? `${username} — my games` : 'My games'} onClose={() => setDialog(null)}>
          <AccountPanel />
        </Modal>
      )}
      {dialog === 'daily' && (() => {
        const c = challengeFor(dayKey())
        return (
          <Modal title="Daily challenge" onClose={() => setDialog(null)}>
            {!username ? (
              <div className="daily-panel">
                <p className="t-note">The daily challenge counts towards your streak and rewards, so it needs an account. Sign in or create one — it only takes a username and a password.</p>
                <AccountPanel formOnly />
              </div>
            ) : (
            <div className="daily-panel">
              <div className="eyebrow">Today · {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <h3 className="display daily-name">{c.name}</h3>
              <p>{c.text} Score with your caps in <b>{c.flicks} flick{c.flicks === 1 ? '' : 's'}</b>. Everyone gets the same one today.</p>
              <div className="career-grid daily-stats">
                <div className="career-stat" data-tone="gold"><b>{streak}</b><small>Day streak</small></div>
                <div className="career-stat"><b>{daily.best}</b><small>Best streak</small></div>
                <div className="career-stat" data-tone={doneToday ? 'good' : undefined}><b>{doneToday ? '✓' : daily.tries?.[dayKey()]?.tries || 0}</b><small>{doneToday ? 'Beaten' : 'Tries today'}</small></div>
              </div>
              <p className="muted t-note">Beat it 7 days running to unlock the Lucky Seven cap.</p>
              <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); setDialog(null); playDaily() }}>Play today’s challenge</button>
            </div>
            )}
          </Modal>
        )
      })()}
      {dialog === 'install' && (
        <Modal title="Add to Home Screen" onClose={() => setDialog(null)}>
          <InstallGuide />
        </Modal>
      )}
      {dialog === 'rules' && (
        <Modal title="How to play" onClose={() => setDialog(null)}>
          <RulesPanel />
        </Modal>
      )}
    </div>
  )
}
