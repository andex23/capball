import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
describe('voice page lifecycle', () => {
  it('releases capture on background/pagehide and never silently restarts on foreground', async () => {
    const document = new EventTarget(), window = new EventTarget()
    document.visibilityState = 'visible'
    const audioSession = { type: 'playback' }
    vi.stubGlobal('document', document)
    vi.stubGlobal('window', window)
    vi.stubGlobal('navigator', { audioSession })
    const track = { readyState: 'live', stop: vi.fn() }
    const gum = vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }))
    const { connectVoice, disconnectVoice, joinVoice, useVoiceStore } = await import('../multiplayer/voiceStore')
    connectVoice({ send: vi.fn(), isHost: true, getUserMedia: gum, PeerConnection: class {}, makeId: () => 'local' })
    try {
      await joinVoice()
      expect(audioSession.type).toBe('play-and-record')
      document.visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      expect(track.stop).toHaveBeenCalledTimes(1)
      expect(audioSession.type).toBe('playback')
      expect(useVoiceStore.getState().enabled).toBe(false)
      document.visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pageshow'))
      expect(gum).toHaveBeenCalledTimes(1)
      await joinVoice()
      window.dispatchEvent(new Event('pagehide'))
      expect(track.stop).toHaveBeenCalledTimes(2)
      expect(audioSession.type).toBe('playback')
    } finally { disconnectVoice() }
  })
})
