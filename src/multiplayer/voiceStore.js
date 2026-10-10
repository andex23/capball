import { create } from 'zustand'
import { createVoiceChat } from './voice'

const initial = { available: false, enabled: false, muted: false, remoteReady: false, status: 'off', error: '', needsPlayback: false }
export const useVoiceStore = create(() => ({ ...initial }))
let voice = null
export function connectVoice(options) {
  disconnectVoice()
  voice = createVoiceChat({ ...options, onState: patch => useVoiceStore.setState(patch) })
  useVoiceStore.setState({ available: true })
}
export function disconnectVoice() {
  voice?.dispose()
  voice = null
  useVoiceStore.setState({ ...initial })
}
export const receiveVoice = data => { void voice?.receive(data) }
export const joinVoice = () => voice?.enable()
export const leaveVoice = () => voice?.leave()
export const muteVoice = () => voice?.toggleMute()
export const playVoice = () => voice?.playAudio()

// Backgrounding ends microphone capture; returning never silently re-enables it.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leaveVoice() })
  window.addEventListener('pagehide', leaveVoice)
}
