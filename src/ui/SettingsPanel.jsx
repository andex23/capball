import { useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { useCareerStore } from '../state/careerStore'
import { updateMenuMusicVolume, changeMenuMusic, MUSIC_TRACKS, DEFAULT_MUSIC_TRACK } from '../audio/MusicManager'
import { playButtonSelect } from '../audio/SoundManager'
import { canVibrate, haptic } from '../input/haptics'
import Icon from './Icon'

function Slider({ label, value, onChange, disabled }) {
  const id = `vol-${label.toLowerCase()}`
  return (
    <div>
      <div className="label-row" style={{ marginBottom: 6 }}>
        <label className="eyebrow" htmlFor={id}>{label}</label>
        <span className="tabular muted" style={{ fontSize: 13 }}>{Math.round(value * 100)}%</span>
      </div>
      <input id={id} className="range" type="range" min="0" max="1" step="0.05" value={value} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

const LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]

/** In a match against the computer: change how well it plays, from its next flick. */
function ComputerLevel() {
  const level = useMatchStore((s) => s.aiDifficulty)
  const playing = useTournamentStore((s) => s.playing)
  const career = playing?.kind === 'career' || playing?.kind === 'careerCup'
  const pick = (k) => {
    playButtonSelect()
    useMatchStore.getState().changeAiDifficulty(k)
    // A career keeps its level for the matches after this one too
    if (career) useCareerStore.getState().setSettings({ difficulty: k })
  }
  return (
    <div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Computer difficulty</div>
      <div className="segmented stretch" role="group" aria-label="Computer difficulty">
        {LEVELS.map(([k, label]) => <button key={k} aria-pressed={level === k} onClick={() => pick(k)}>{label}</button>)}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Takes effect from the computer’s next flick{career ? ' and stays for the rest of your career' : ''}. Your record counts the match at the easiest level you played it on.
      </p>
    </div>
  )
}

export default function SettingsPanel() {
  const masterVolume = useMatchStore((s) => s.masterVolume)
  const sfxVolume = useMatchStore((s) => s.sfxVolume)
  const musicVolume = useMatchStore((s) => s.musicVolume)
  const muted = useMatchStore((s) => s.muted)
  const vibration = useMatchStore((s) => s.vibration)
  const turnView = useMatchStore((s) => s.turnView)
  const followBall = useMatchStore((s) => s.followBall)
  const swipeAim = useMatchStore((s) => s.swipeAim)
  const musicTrack = useMatchStore((s) => s.musicTrack)
  const vsComputer = useMatchStore((s) => s.screen === SCREEN.PLAYING && s.gameMode === 'ai' && !s.challenge)
  const { setMasterVolume, setSfxVolume, setMusicVolume, toggleMute, toggleVibration, toggleTurnView, toggleFollowBall, toggleSwipeAim } = useMatchStore.getState()

  useEffect(() => { updateMenuMusicVolume() }, [masterVolume, musicVolume, muted])

  return (
    <>
      {vsComputer && (
        <>
          <h3 className="eyebrow" style={{ margin: 0 }}>Opponent</h3>
          <ComputerLevel />
        </>
      )}
      {/* Controls first: it's what players come to change mid-match */}
      <h3 className="eyebrow" style={{ margin: vsComputer ? '8px 0 0' : 0 }}>Controls</h3>
      <div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>How to flick</div>
        <div className="segmented stretch" role="group" aria-label="How to aim a flick">
          <button aria-pressed={!swipeAim} onClick={() => { if (swipeAim) toggleSwipeAim(); playButtonSelect() }}>Pull back</button>
          <button aria-pressed={swipeAim} onClick={() => { if (!swipeAim) toggleSwipeAim(); playButtonSelect() }}>Swipe forward</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {swipeAim ? 'Press a cap and swipe the way you want it to go.' : 'Press a cap and drag back like a slingshot; it shoots the other way.'}
        </p>
      </div>
      {/* Only phones that can actually vibrate get the option */}
      {canVibrate() && (
        <button className="btn btn-secondary" aria-pressed={vibration} onClick={() => { toggleVibration(); playButtonSelect(); haptic('flick') }}>
          <Icon name="vibrate" size={18} /> {vibration ? 'Vibration on' : 'Vibration off'}
        </button>
      )}
      <h3 className="eyebrow" style={{ margin: '8px 0 0' }}>Camera</h3>
      <button className="btn btn-secondary" aria-pressed={turnView} onClick={() => { toggleTurnView(); playButtonSelect() }}>
        <Icon name="camera" size={18} /> {turnView ? 'Turn view each turn: on' : 'Turn view each turn: off'}
      </button>
      <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>Local matches on one device: the pitch swings round so whoever’s turn it is plays from their own end.</p>
      <button className="btn btn-secondary" aria-pressed={followBall} onClick={() => { toggleFollowBall(); playButtonSelect() }}>
        <Icon name="camera" size={18} /> {followBall ? 'Camera follows the ball: on' : 'Camera follows the ball: off'}
      </button>
      <h3 className="eyebrow" style={{ margin: '8px 0 0' }}>Sound</h3>
      <button className={`btn ${muted ? 'btn-danger' : 'btn-secondary'}`} aria-pressed={muted} onClick={() => { toggleMute(); playButtonSelect() }}>
        <Icon name={muted ? 'mute' : 'volume'} size={18} /> {muted ? 'Sound off' : 'Sound on'}
      </button>
      <Slider label="Master" value={masterVolume} onChange={setMasterVolume} disabled={muted} />
      <Slider label="Effects" value={sfxVolume} onChange={setSfxVolume} disabled={muted} />
      <Slider label="Music" value={musicVolume} onChange={setMusicVolume} disabled={muted} />
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Menu music</div>
        <div className="segmented stretch" role="group" aria-label="Menu music">
          {MUSIC_TRACKS.map((t, i) => (
            <button
              key={t.key}
              aria-pressed={(MUSIC_TRACKS[musicTrack] ? musicTrack : DEFAULT_MUSIC_TRACK) === i}
              onClick={() => {
                playButtonSelect()
                useMatchStore.getState().setMusicTrack(i)
                // In a match the menu music is silent anyway: the choice applies back in the menus
                if (useMatchStore.getState().screen !== SCREEN.PLAYING) changeMenuMusic()
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
