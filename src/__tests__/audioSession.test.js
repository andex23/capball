import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireCaptureAudioSession, setPlaybackAudioSession } from '../audio/audioSession'

afterEach(() => vi.unstubAllGlobals())
function session(type = 'playback') {
  const audioSession = { type }
  vi.stubGlobal('navigator', { audioSession })
  return audioSession
}
describe('iOS audio session capture ownership', () => {
  it('switches playback to capture before requesting a microphone and restores on release', () => {
    const audio = session()
    const release = acquireCaptureAudioSession()
    expect(audio.type).toBe('play-and-record')
    release()
    expect(audio.type).toBe('playback')
    release()
    expect(audio.type).toBe('playback')
  })
  it('keeps capture compatible across overlapping requests and game sound initialization', () => {
    const audio = session('auto')
    const oldRequest = acquireCaptureAudioSession(), newRequest = acquireCaptureAudioSession()
    setPlaybackAudioSession()
    expect(audio.type).toBe('play-and-record')
    oldRequest()
    expect(audio.type).toBe('play-and-record')
    newRequest()
    expect(audio.type).toBe('auto')
  })
  it('does not overwrite a category explicitly changed by another owner', () => {
    const audio = session()
    const release = acquireCaptureAudioSession()
    audio.type = 'ambient'
    release()
    expect(audio.type).toBe('ambient')
  })
  it('works on browsers without the audio session API', () => {
    vi.stubGlobal('navigator', {})
    expect(() => { setPlaybackAudioSession(); acquireCaptureAudioSession()() }).not.toThrow()
  })
})
