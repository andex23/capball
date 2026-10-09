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

/**
 * Home screen in the style of a 16-bit console football game: a title card
 * with "Press start", then a boxed mode-select window with a cursor that
 * moves with taps, the mouse or the arrow keys.
 */

const MODES = [
  { key: 'ai', title: 'Vs Computer', tag: '1P' },
  { key: 'local', title: 'Local Match', tag: '2P' },
  { key: 'online', title: 'Online Match', tag: 'NET' },
  { key: 'tournament', title: 'Tournament', tag: 'CUP' },
]
const OPTIONS = [
  { key: 'rules', title: 'How to play' },
  { key: 'records', title: 'Records' },
  { key: 'settings', title: 'Settings' },
  { key: 'account', title: 'Sign in' },
]
const ITEMS = [...MODES.map((m) => m.key), ...OPTIONS.map((o) => o.key)]
const DIFFICULTIES = ['easy', 'medium', 'hard']

// The title card shows once per visit; coming back from a match goes straight to the menu
let pressedStart = false

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

  const activate = (key) => {
    if (OPTIONS.some((o) => o.key === key)) {
      playMenuNavigate()
      setDialog(key)
      return
    }
    playConfirm()
    if (key === 'tournament') { goToScreen(SCREEN.TOURNAMENT_HOME); return }
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
      <div className="iss-sky" aria-hidden="true" />
      <div className="iss-pitch" aria-hidden="true" />
      <div className="iss-scan" aria-hidden="true" />

      <div className="iss-layout">
        <header className="iss-brand">
          <h1 className="iss-logo" aria-label="Capball">
            <span className="iss-logo-depth" aria-hidden="true">CAPBALL</span>
            <span className="iss-logo-word">CAPBALL</span>
          </h1>
          <div className="iss-ribbon">Tabletop Football</div>
        </header>

        {!started ? (
          <button className="iss-press" onClick={(e) => { e.stopPropagation(); start() }}>
            Press start
          </button>
        ) : (
          <main className="iss-window" aria-label="Mode select">
            <div className="iss-window-tab">Mode select</div>
            <ul className="iss-list" role="menu">
              {MODES.map((m, i) => (
                <li key={m.key} role="none" className={`iss-row${cursor === i ? ' is-on' : ''}`} onPointerEnter={(e) => e.pointerType === 'mouse' && moveTo(i)}>
                  {cursor === i && <CapCursor />}
                  <button role="menuitem" className="iss-item" onClick={() => activate(m.key)} onFocus={() => setCursor(i)}>
                    {m.title}
                  </button>
                  {m.key === 'ai' ? (
                    <span className="iss-level" role="group" aria-label="Computer level">
                      <button className="iss-arrow" aria-label="Easier" onClick={() => { setCursor(i); shiftLevel(-1) }}>◄</button>
                      <span className="iss-level-name" data-level={aiDifficulty}>{level}</span>
                      <button className="iss-arrow" aria-label="Harder" onClick={() => { setCursor(i); shiftLevel(1) }}>►</button>
                    </span>
                  ) : (
                    <span className="iss-tag">{m.tag}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="iss-rule" aria-hidden="true" />
            <ul className="iss-options" role="menu">
              {OPTIONS.map((o, j) => {
                const i = MODES.length + j
                const title = o.key === 'account' && username ? username : o.title
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
        <Modal title={username ? 'Your account' : 'Save your game'} onClose={() => setDialog(null)}>
          <AccountPanel />
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
