import { useEffect } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { updateMenuMusicVolume } from '../audio/MusicManager'
import { playButtonSelect } from '../audio/SoundManager'
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
  const { setMasterVolume, setSfxVolume, setMusicVolume, toggleMute } = useMatchStore.getState()

  useEffect(() => { updateMenuMusicVolume() }, [masterVolume, musicVolume, muted])

  return (
    <>
      <button className={`btn ${muted ? 'btn-danger' : 'btn-secondary'}`} aria-pressed={muted} onClick={() => { toggleMute(); playButtonSelect() }}>
        <Icon name={muted ? 'mute' : 'volume'} size={18} /> {muted ? 'Sound off' : 'Sound on'}
      </button>
      <Slider label="Master" value={masterVolume} onChange={setMasterVolume} disabled={muted} />
      <Slider label="Effects" value={sfxVolume} onChange={setSfxVolume} disabled={muted} />
      <Slider label="Music" value={musicVolume} onChange={setMusicVolume} disabled={muted} />
    </>
  )
}
