import { useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { updateMenuMusicVolume, changeMenuMusic, MUSIC_TRACKS, DEFAULT_MUSIC_TRACK } from '../audio/MusicManager'
import { playButtonSelect } from '../audio/SoundManager'
import { canVibrate, haptic } from '../input/haptics'
import { canSpeak } from '../audio/voice'
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

export default function SettingsPanel() {
  const masterVolume = useMatchStore((s) => s.masterVolume)
  const sfxVolume = useMatchStore((s) => s.sfxVolume)
  const musicVolume = useMatchStore((s) => s.musicVolume)
  const muted = useMatchStore((s) => s.muted)
  const vibration = useMatchStore((s) => s.vibration)
  const voiceCommentary = useMatchStore((s) => s.voiceCommentary)
  const toggleVoiceCommentary = useMatchStore((s) => s.toggleVoiceCommentary)
  const turnView = useMatchStore((s) => s.turnView)
  const swipeAim = useMatchStore((s) => s.swipeAim)
  const musicTrack = useMatchStore((s) => s.musicTrack)
  const { setMasterVolume, setSfxVolume, setMusicVolume, toggleMute, toggleVibration, toggleTurnView, toggleSwipeAim } = useMatchStore.getState()

  useEffect(() => { updateMenuMusicVolume() }, [masterVolume, musicVolume, muted])

  return (
    <>
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
      <button className="btn btn-secondary" aria-pressed={turnView} onClick={() => { toggleTurnView(); playButtonSelect() }}>
        <Icon name="camera" size={18} /> {turnView ? 'Turn view each turn: on' : 'Turn view each turn: off'}
      </button>
      <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>Local matches on one device: the pitch swings round so whoever’s turn it is plays from their own end.</p>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Aiming</div>
        <div className="segmented stretch" role="group" aria-label="How to aim a flick">
          <button aria-pressed={!swipeAim} onClick={() => { if (swipeAim) toggleSwipeAim(); playButtonSelect() }}>Pull back</button>
          <button aria-pressed={swipeAim} onClick={() => { if (!swipeAim) toggleSwipeAim(); playButtonSelect() }}>Swipe forward</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {swipeAim ? 'Press a cap and swipe the way you want it to go.' : 'Press a cap and drag back like a slingshot; it shoots the other way.'}
        </p>
      </div>
      {canSpeak() && (
        <button className="btn btn-secondary" aria-pressed={voiceCommentary} onClick={() => { toggleVoiceCommentary(); playButtonSelect() }}>
          <Icon name="volume" size={18} /> {voiceCommentary ? 'Spoken commentary on' : 'Spoken commentary off'}
        </button>
      )}
      {/* Only phones that can actually vibrate get the option */}
      {canVibrate() && (
        <button className="btn btn-secondary" aria-pressed={vibration} onClick={() => { toggleVibration(); playButtonSelect(); haptic('flick') }}>
          <Icon name="vibrate" size={18} /> {vibration ? 'Vibration on' : 'Vibration off'}
        </button>
      )}
    </>
  )
}
