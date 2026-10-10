import { useVoiceStore, joinVoice, leaveVoice, muteVoice, playVoice } from '../multiplayer/voiceStore'
import Icon from './Icon'

export default function VoiceChat({ compact = false }) {
  const voice = useVoiceStore()
  if (!voice.available) return null
  if (compact) return voice.enabled ? <button className="icon-btn" onClick={muteVoice}
    aria-label={voice.muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={voice.muted}
    title={voice.muted ? 'Microphone muted' : 'Microphone on'}>
    <Icon name={voice.muted ? 'micOff' : 'mic'} size={18} />
  </button> : null
  const status = voice.status === 'permission' ? 'Waiting for microphone permission…'
    : voice.status === 'connecting' ? 'Connecting voice…'
      : voice.status === 'connected' ? voice.muted ? 'Connected · your microphone is muted' : 'Connected · your microphone is on'
        : voice.enabled ? 'Microphone ready · waiting for your opponent to join voice'
          : voice.remoteReady ? 'Your opponent has joined voice chat.' : 'Talk to your opponent during this match.'
  return <section className="voice-panel" aria-label="Voice chat">
    <strong>Voice chat</strong>
    <p role="status">{status}</p>
    {voice.error && <p role="alert">{voice.error}</p>}
    <div className="voice-actions">
      {voice.enabled ? <>
        <button className="btn btn-secondary" onClick={muteVoice}><Icon name={voice.muted ? 'micOff' : 'mic'} size={18} />{voice.muted ? 'Unmute' : 'Mute'}</button>
        <button className="btn btn-secondary" onClick={leaveVoice}>Leave voice</button>
      </> : voice.status === 'permission'
        ? <button className="btn btn-secondary" onClick={leaveVoice}>Cancel voice</button>
        : <button className="btn btn-secondary" onClick={joinVoice}><Icon name="mic" size={18} /> Join voice</button>}
      {voice.needsPlayback && <button className="btn btn-primary" onClick={playVoice}><Icon name="volume" size={18} /> Hear opponent</button>}
    </div>
    <small>Both players choose to join. Audio is live and isn’t recorded by the game. Leaving the match or switching apps turns your microphone off.</small>
  </section>
}
