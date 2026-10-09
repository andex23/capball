import { useState, useEffect, useCallback } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import Modal from '../ui/Modal'
import SettingsPanel from '../ui/SettingsPanel'
import RulesPanel from '../ui/RulesPanel'
import RecordsPanel from '../ui/RecordsPanel'
import AccountPanel from '../ui/AccountPanel'
import { useAccountStore } from '../state/accountStore'
import InstallPrompt from '../pwa/InstallPrompt'
import { playButtonSelect, playConfirm, playMenuNavigate, playCoinInsert } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'
import { useSavedStore, resumeSavedMatch, describeSave } from '../state/savedMatch'
import { useTournamentStore } from '../state/tournamentStore'
import { RetroBackdrop, RetroLogo } from '../ui/Retro'
import { useDailyStore, playDaily, liveStreak } from '../state/dailyStore'
import { challengeFor, dayKey } from '../game/daily'

/**
 * Home screen in the style of a 16-bit console football game: a title card
 * with "Press start", then a boxed mode-select window with a cursor that
 * moves with taps, the mouse or the arrow keys.
 */

const MODES = [
  { key: 'ai', title: 'Vs Computer', tag: '1P' },
  { key: 'career', title: 'Career', tag: 'PRO' },
  { key: 'local', title: 'Local Match', tag: '2P' },
  { key: 'online', title: 'Online Match', tag: 'NET' },
  { key: 'tournament', title: 'Tournament' },
  { key: 'daily', title: 'Daily Challenge' },
]
const OPTIONS = [
  { key: 'rules', title: 'How to play' },
  { key: 'records', title: 'Records' },
  { key: 'settings', title: 'Settings' },
  { key: 'account', title: 'My games' },
]
const DIFFICULTIES = ['easy', 'medium', 'hard']
const FORMATS = [{ key: 'league', label: 'League' }, { key: 'knockout', label: 'Cup' }]

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
  const [dialog, setDialog] = useState(null) // 'settings' | 'rules' | 'records' | 'account' | null
  const [started, setStarted] = useState(pressedStart)
  const [cursor, setCursor] = useState(0)
  const saved = useSavedStore((s) => s.saved)
  const setupFormat = useTournamentStore((s) => s.setupFormat)
  const daily = useDailyStore()
  const doneToday = !!daily.tries?.[dayKey()]?.won
  const streak = liveStreak(daily)
  // A saved match goes at the top of the list
  const modes = saved ? [{ key: 'continue', title: 'Continue', tag: 'SAVE' }, ...MODES] : MODES
  const ITEMS = [...modes.map((m) => m.key), ...OPTIONS.map((o) => o.key)]

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

  const shiftFormat = () => {
    playButtonSelect()
    useTournamentStore.getState().setSetupFormat(setupFormat === 'league' ? 'knockout' : 'league')
  }

  const activate = (key) => {
    if (OPTIONS.some((o) => o.key === key)) {
      playMenuNavigate()
      setDialog(key)
      return
    }
    playConfirm()
    if (key === 'continue') { resumeSavedMatch(); return }
    if (key === 'tournament') { goToScreen(SCREEN.TOURNAMENT_HOME); return }
    if (key === 'career') { goToScreen(SCREEN.CAREER); return }
    if (key === 'daily') { setDialog('daily'); return }
    if (key === 'online') { goToScreen(SCREEN.ONLINE); return }
    setGameMode(key)
    goToScreen(SCREEN.TEAM_SELECT)
  }

  // Arrow keys / Enter, like a pad
  useEffect(() => {
    const onKey = (e) => {
      if (dialog) return
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return
      if (!started) {
        if (['Enter', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); start() }
        return
      }
      const n = ITEMS.length
      if (e.key === 'ArrowDown') { e.preventDefault(); playMenuNavigate(); setCursor((c) => (c + 1) % n) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); playMenuNavigate(); setCursor((c) => (c - 1 + n) % n) }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ITEMS[cursor] === 'ai') {
        e.preventDefault(); shiftLevel(e.key === 'ArrowLeft' ? -1 : 1)
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ITEMS[cursor] === 'tournament') {
        e.preventDefault(); shiftFormat()
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault(); activate(ITEMS[cursor])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const level = aiDifficulty[0].toUpperCase() + aiDifficulty.slice(1)

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
          <main className="iss-window" aria-label="Mode select">
            <div className="iss-window-tab">Mode select</div>
            <ul className="iss-list" role="menu">
              {modes.map((m, i) => (
                <li key={m.key} role="none" className={`iss-row${cursor === i ? ' is-on' : ''}`} onPointerEnter={(e) => e.pointerType === 'mouse' && moveTo(i)}>
                  {cursor === i && <CapCursor />}
                  <button role="menuitem" className="iss-item" onClick={() => activate(m.key)} onFocus={() => setCursor(i)}>
                    {m.title}
                    {m.key === 'continue' && <small className="iss-sub">{describeSave(saved)}</small>}
                  </button>
                  {m.key === 'ai' ? (
                    <span className="iss-level" role="group" aria-label="Computer level">
                      <button className="iss-arrow" aria-label="Easier" onClick={() => { setCursor(i); shiftLevel(-1) }}>◄</button>
                      <span className="iss-level-name" data-level={aiDifficulty}>{level}</span>
                      <button className="iss-arrow" aria-label="Harder" onClick={() => { setCursor(i); shiftLevel(1) }}>►</button>
                    </span>
                  ) : m.key === 'tournament' ? (
                    <span className="iss-level" role="group" aria-label="League or cup">
                      <button className="iss-arrow" aria-label="League or cup" onClick={() => { setCursor(i); shiftFormat() }}>◄</button>
                      <span className="iss-level-name" data-level="format">{FORMATS.find((f) => f.key === setupFormat)?.label || 'Cup'}</span>
                      <button className="iss-arrow" aria-label="League or cup" onClick={() => { setCursor(i); shiftFormat() }}>►</button>
                    </span>
                  ) : (
                    <span className="iss-tag" data-done={m.key === 'daily' && doneToday ? 'true' : undefined}>
                      {m.key === 'daily' ? (doneToday ? 'DONE' : streak ? `x${streak}` : 'NEW') : m.tag}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="iss-rule" aria-hidden="true" />
            <ul className="iss-options" role="menu">
              {OPTIONS.map((o, j) => {
                const i = modes.length + j
                const title = o.key === 'account' && username ? `${username}` : o.title
                return (
                  <li key={o.key} role="none" className={`iss-opt${cursor === i ? ' is-on' : ''}`} onPointerEnter={(e) => e.pointerType === 'mouse' && moveTo(i)}>
                    {cursor === i && <CapCursor />}
                    <button role="menuitem" className="iss-item" onClick={() => activate(o.key)} onFocus={() => setCursor(i)}>{title}</button>
                  </li>
                )
              })}
            </ul>
            <InstallPrompt />
          </main>
        )}

        <footer className="iss-foot">
          <span>© 2026 Capball</span>
          <span className="iss-keys">▲▼ Select &nbsp; Enter OK</span>
        </footer>
      </div>

      {dialog === 'settings' && (
        <Modal title="Settings" onClose={() => setDialog(null)}>
          <SettingsPanel />
        </Modal>
      )}
      {dialog === 'records' && (
        <Modal title="Records" onClose={() => setDialog(null)}>
          <RecordsPanel />
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
          </Modal>
        )
      })()}
      {dialog === 'rules' && (
        <Modal title="How to play" onClose={() => setDialog(null)}>
          <RulesPanel />
        </Modal>
      )}
    </div>
  )
}
