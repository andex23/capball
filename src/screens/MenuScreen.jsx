import { useState, useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import Modal from '../ui/Modal'
import SettingsPanel from '../ui/SettingsPanel'
import RulesPanel from '../ui/RulesPanel'
import RecordsPanel from '../ui/RecordsPanel'
import Icon from '../ui/Icon'
import TabletopBackdrop from '../ui/TabletopBackdrop'
import InstallPrompt from '../pwa/InstallPrompt'
import { playButtonSelect, playConfirm, playMenuNavigate, playHoverTick } from '../audio/SoundManager'
import { startMenuMusic } from '../audio/MusicManager'

// The other ways to play, as tiles under the big "Play" button
const MODES = [
  { key: 'local', icon: 'users', title: 'Pass & play', sub: 'Two players, one phone', tone: 'red' },
  { key: 'online', icon: 'globe', title: 'Online', sub: 'Play a friend anywhere', tone: 'purple' },
  { key: 'tournament', icon: 'trophy', title: 'Tournament', sub: 'Cups and leagues', tone: 'gold' },
]

const DIFFICULTIES = ['easy', 'medium', 'hard']

export default function MenuScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const setGameMode = useMatchStore((s) => s.setGameMode)
  const aiDifficulty = useMatchStore((s) => s.aiDifficulty)
  const setAiDifficulty = useMatchStore((s) => s.setAiDifficulty)
  const [dialog, setDialog] = useState(null) // 'settings' | 'rules' | 'records' | null

  useEffect(() => { startMenuMusic() }, [])

  const choose = (mode) => {
    playConfirm()
    if (mode === 'tournament') { goToScreen(SCREEN.TOURNAMENT_HOME); return }
    if (mode === 'online') { goToScreen(SCREEN.ONLINE); return }
    setGameMode(mode)
    goToScreen(SCREEN.TEAM_SELECT)
  }

  const open = (d) => { playMenuNavigate(); setDialog(d) }

  return (
    <div className="screen menu-screen">
      <TabletopBackdrop />
      <div className="menu-shade" />

      <div className="menu-layout">
        <header className="menu-brand">
          <div className="eyebrow menu-kicker">Tabletop football</div>
          <h1 className="display menu-title">
            Cap<span>ball</span>
          </h1>
          <p className="menu-tagline">Flick your caps. Beat the keeper. Win the match.</p>
        </header>

        <main className="menu-panel">
          {/* The main event: a game against the computer */}
          <section className="menu-play">
            <button className="btn btn-gold menu-play-btn" onClick={() => choose('ai')} onMouseEnter={playHoverTick}>
              <Icon name="play" size={26} /> Play
              <span className="menu-play-sub">vs computer</span>
            </button>
            <div className="segmented stretch menu-level" role="group" aria-label="Computer level">
              {DIFFICULTIES.map((d) => (
                <button key={d} aria-pressed={aiDifficulty === d} onClick={() => { playButtonSelect(); setAiDifficulty(d) }}>
                  {d[0].toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <nav className="menu-tiles" aria-label="More ways to play">
            {MODES.map((m) => (
              <button key={m.key} className="menu-tile" data-tone={m.tone} onClick={() => choose(m.key)} onMouseEnter={playHoverTick}>
                <span className="menu-tile-icon"><Icon name={m.icon} size={22} /></span>
                <span className="menu-tile-text">
                  <b>{m.title}</b>
                  <small>{m.sub}</small>
                </span>
                <Icon name="next" size={18} />
              </button>
            ))}
          </nav>

          <footer className="menu-foot">
            <button className="menu-link" onClick={() => open('rules')}><Icon name="help" size={18} /> How to play</button>
            <button className="menu-link" onClick={() => open('records')}><Icon name="trophy" size={18} /> Records</button>
            <button className="menu-link" onClick={() => open('settings')}><Icon name="settings" size={18} /> Settings</button>
          </footer>
          <InstallPrompt />
        </main>
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
