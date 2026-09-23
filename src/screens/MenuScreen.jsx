import { useState, useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import StadiumBackground from '../ui/StadiumBackground'
import Modal from '../ui/Modal'
import SettingsPanel from '../ui/SettingsPanel'
import RulesPanel from '../ui/RulesPanel'
import RecordsPanel from '../ui/RecordsPanel'
import Icon from '../ui/Icon'
import { playButtonSelect, playConfirm, playMenuNavigate, playHoverTick } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'

const MODES = [
  { key: 'local', icon: 'users', title: 'Local match', color: 'red' },
  { key: 'ai', icon: 'cpu', title: 'Vs computer', color: 'blue' },
  { key: 'online', icon: 'globe', title: 'Online match', color: 'purple' },
]

const DIFFICULTIES = ['easy', 'medium', 'hard']

export default function MenuScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const setGameMode = useMatchStore((s) => s.setGameMode)
  const aiDifficulty = useMatchStore((s) => s.aiDifficulty)
  const setAiDifficulty = useMatchStore((s) => s.setAiDifficulty)
  const [imgFailed, setImgFailed] = useState(false)
  const [dialog, setDialog] = useState(null) // 'settings' | 'rules' | 'records' | null

  useEffect(() => { startMenuMusic() }, [])

  const choose = (mode) => {
    playConfirm()
    if (mode === 'online') {
      goToScreen(SCREEN.ONLINE)
      return
    }
    setGameMode(mode)
    goToScreen(SCREEN.TEAM_SELECT)
  }

  return (
    <div className="screen">
      {imgFailed ? <StadiumBackground /> : <img className="screen-photo" src="/assets/menu-bg.jpg" alt="" onError={() => setImgFailed(true)} />}
      <div className="screen-shade" />

      <div className="screen-content menu-layout">
        <header>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>Tabletop football</div>
          <h1 className="display" style={{ fontSize: 'clamp(64px, 10vw, 112px)' }}>
            Cap<span style={{ color: 'var(--accent)' }}>ball</span>
          </h1>
          <p className="muted" style={{ maxWidth: 360, marginTop: 8 }}>Flick your caps, beat the keeper, win the match.</p>
        </header>

        <nav className="menu-modes" aria-label="Game mode">
          {MODES.map((m) => (
            <button key={m.key} className={`btn btn-${m.color} mode-btn`} onClick={() => choose(m.key)} onMouseEnter={playHoverTick}>
              <Icon name={m.icon} size={26} /> {m.title}
            </button>
          ))}
          <div className="label-row" style={{ padding: '2px 4px', flexWrap: 'wrap' }}>
            <span className="eyebrow">CPU level</span>
            <div className="segmented" role="group" aria-label="CPU difficulty">
              {DIFFICULTIES.map((d) => (
                <button key={d} aria-pressed={aiDifficulty === d} onClick={() => { playButtonSelect(); setAiDifficulty(d) }} style={{ textTransform: 'capitalize' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <footer style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { playMenuNavigate(); setDialog('rules') }}>
            <Icon name="help" size={18} /> How to play
          </button>
          <button className="btn btn-secondary" onClick={() => { playMenuNavigate(); setDialog('settings') }}>
            <Icon name="settings" size={18} /> Settings
          </button>
          <button className="btn btn-secondary" onClick={() => { playMenuNavigate(); setDialog('records') }}>
            <Icon name="trophy" size={18} /> Records
          </button>
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
      {dialog === 'rules' && (
        <Modal title="How to play" onClose={() => setDialog(null)}>
          <RulesPanel />
        </Modal>
      )}
    </div>
  )
}
