import { describe, it, expect, vi, afterEach } from 'vitest'
import { createVoiceChat, microphoneErrorMessage, requestMicrophone, voiceSessionId } from '../multiplayer/voice'

const active = []
afterEach(() => { active.splice(0).forEach(v => v.dispose()); vi.useRealTimers(); vi.unstubAllGlobals() })
function setup(extra = {}) {
  const track = { enabled: true, stop: vi.fn() }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  const send = vi.fn(), state = {}, pcs = []
  class PC {
    constructor(config) { this.config = config; this.iceGatheringState = 'complete'; pcs.push(this) }
    addTrack = vi.fn()
    close = vi.fn()
    createOffer = async () => ({ type: 'offer', sdp: 'v=0\r\na=audio' })
    createAnswer = async () => ({ type: 'answer', sdp: 'v=0\r\na=audio' })
    setLocalDescription = async d => { this.localDescription = d; this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable' }
    setRemoteDescription = vi.fn(async () => {})
  }
  const audio = { play: vi.fn(async () => {}), pause: vi.fn(), srcObject: null }
  const gum = vi.fn(async () => stream)
  const voice = createVoiceChat({ send, isHost: true, onState: p => Object.assign(state, p), getUserMedia: gum, PeerConnection: PC, createAudio: () => audio, makeId: () => 'local', ...extra })
  active.push(voice)
  return { voice, send, state, track, stream, gum, pcs, audio }
}

describe('opt-in live voice', () => {
  it('never requests a mic or answers an unsolicited offer before local consent', async () => {
    const t = setup({ isHost: false })
    await t.voice.receive({ kind: 'ready', id: 'remote' })
    await t.voice.receive({ kind: 'sdp', from: 'remote', to: null, description: { type: 'offer', sdp: 'v=0' } })
    expect(t.gum).not.toHaveBeenCalled()
    expect(t.pcs).toHaveLength(0)
    expect(t.state.remoteReady).toBe(true)
  })
  it('offers audio only after both join, supports mute, and releases everything on leave', async () => {
    const t = setup()
    await t.voice.enable()
    expect(t.pcs).toHaveLength(0)
    await t.voice.receive({ kind: 'ready', id: 'remote' })
    expect(t.gum).toHaveBeenCalledWith(expect.objectContaining({ video: false }))
    expect(t.pcs[0].config.iceServers).toEqual([])
    expect(t.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sdp', from: 'local', to: 'remote' }))
    t.voice.toggleMute(); expect(t.track.enabled).toBe(false)
    t.voice.toggleMute(); expect(t.track.enabled).toBe(true)
    t.voice.leave()
    expect(t.track.stop).toHaveBeenCalledOnce()
    expect(t.pcs[0].close).toHaveBeenCalledOnce()
    expect(t.audio.srcObject).toBeNull()
    expect(t.state.enabled).toBe(false)
  })
  it('stops a microphone permission request that completes after cancellation', async () => {
    let resolve
    const t = setup({ getUserMedia: () => new Promise(r => { resolve = r }) })
    const enabling = t.voice.enable()
    t.voice.leave()
    resolve(t.stream)
    await enabling
    expect(t.track.stop).toHaveBeenCalledOnce()
    expect(t.send).not.toHaveBeenCalled()
    expect(t.state.enabled).toBe(false)
  })
  it('opponent readiness during the permission prompt does not cancel local joining', async () => {
    let resolve
    const t = setup({ getUserMedia: () => new Promise(r => { resolve = r }) })
    const enabling = t.voice.enable()
    await t.voice.receive({ kind: 'ready', id: 'remote' })
    resolve(t.stream); await enabling
    expect(t.state.enabled).toBe(true)
    expect(t.pcs).toHaveLength(1)
  })
  it('reports denied permission without starting a connection', async () => {
    const t = setup({ getUserMedia: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }) } })
    await t.voice.enable()
    expect(t.state.error).toMatch(/denied/)
    expect(t.pcs).toHaveLength(0)
  })
  it('ignores stale SDP and duplicate readiness; audio playback can be retried', async () => {
    const t = setup({ isHost: false })
    await t.voice.enable()
    await t.voice.receive({ kind: 'ready', id: 'remote' })
    await t.voice.receive({ kind: 'sdp', from: 'old', to: 'local', description: { type: 'offer', sdp: 'v=0' } })
    expect(t.pcs).toHaveLength(0)
    await t.voice.receive({ kind: 'sdp', from: 'remote', to: 'local', description: { type: 'offer', sdp: 'v=0' } })
    await t.voice.receive({ kind: 'ready', id: 'remote' })
    expect(t.pcs).toHaveLength(1)
    t.audio.play.mockRejectedValueOnce(new Error('autoplay'))
    t.pcs[0].ontrack({ streams: [t.stream] })
    await Promise.resolve(); await Promise.resolve()
    expect(t.state.needsPlayback).toBe(true)
    await t.voice.playAudio()
    expect(t.state.needsPlayback).toBe(false)
    await t.voice.receive({ kind: 'leave', id: 'remote' })
    expect(t.state.status).toBe('waiting')
    expect(t.audio.srcObject).toBeNull()
  })
  it('releases capture if connecting times out', async () => {
    vi.useFakeTimers()
    const t = setup()
    await t.voice.enable(); await t.voice.receive({ kind: 'ready', id: 'remote' })
    await vi.advanceTimersByTimeAsync(30000)
    expect(t.state.enabled).toBe(false)
    expect(t.track.stop).toHaveBeenCalledOnce()
  })
})


describe('phone microphone recovery', () => {
  it('falls back to basic audio when processing settings are rejected', async () => {
    const gum = vi.fn().mockRejectedValueOnce({ name: 'OverconstrainedError' })
    const t = setup({ getUserMedia: gum })
    gum.mockResolvedValueOnce(t.stream)
    await t.voice.enable()
    expect(gum).toHaveBeenLastCalledWith({ audio: true, video: false })
    expect(t.state.enabled).toBe(true)
  })
  it.each(['NotAllowedError', 'NotReadableError', 'NotFoundError'])('does not repeat capture requests for %s', async name => {
    const gum = vi.fn().mockRejectedValue({ name })
    const t = setup({ getUserMedia: gum })
    await t.voice.enable()
    expect(gum).toHaveBeenCalledTimes(1)
    expect(t.state.error).toBe(microphoneErrorMessage({ name }))
    expect(t.state.error).not.toMatch(/HTTPS/)
    expect(t.state.enabled).toBe(false)
  })
  it('distinguishes insecure pages from browsers without microphone support', () => {
    vi.stubGlobal('isSecureContext', false)
    expect(() => requestMicrophone({ audio: true })).toThrow('InsecureContext')
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', {})
    expect(() => requestMicrophone({ audio: true })).toThrow('MediaUnsupported')
  })
  it('releases capture if setup fails after microphone permission succeeds', async () => {
    const t = setup({ makeId: () => { throw new Error('setup failed') } })
    await t.voice.enable()
    expect(t.track.stop).toHaveBeenCalledOnce()
    expect(t.state.error).toContain('[VOICE_SESSION_Error]')
  })
})


describe('voice startup compatibility', () => {
  it('restores the audio category after denial and allows a fresh explicit retry', async () => {
    const audioSession = { type: 'playback' }
    vi.stubGlobal('navigator', { audioSession })
    const gum = vi.fn().mockRejectedValueOnce({ name: 'NotAllowedError' })
    const t = setup({ getUserMedia: gum })
    await t.voice.enable()
    expect(audioSession.type).toBe('playback')
    gum.mockResolvedValueOnce(t.stream)
    await t.voice.enable()
    expect(t.state.enabled).toBe(true)
    expect(audioSession.type).toBe('play-and-record')
    t.voice.dispose()
    expect(audioSession.type).toBe('playback')
  })
  it('deduplicates clicks and keeps a newer capture compatible when a cancelled request settles late', async () => {
    const audioSession = { type: 'playback' }
    vi.stubGlobal('navigator', { audioSession })
    let resolve
    const gum = vi.fn(() => new Promise(r => { resolve = r }))
    const first = setup({ getUserMedia: gum })
    const old = first.voice.enable()
    await first.voice.enable()
    expect(gum).toHaveBeenCalledTimes(1)
    first.voice.dispose()
    const second = setup()
    await second.voice.enable()
    resolve(first.stream)
    await old
    expect(first.track.stop).toHaveBeenCalledOnce()
    expect(first.send).not.toHaveBeenCalled()
    expect(audioSession.type).toBe('play-and-record')
    expect(second.state.enabled).toBe(true)
    second.voice.leave()
    expect(audioSession.type).toBe('playback')
  })
  it('rejects already-ended tracks and cleans up a track ending after join', async () => {
    const stale = setup()
    stale.track.readyState = 'ended'
    await stale.voice.enable()
    expect(stale.state.enabled).toBe(false)
    expect(stale.state.error).toContain('[MIC_ENDED]')
    expect(stale.track.stop).toHaveBeenCalledOnce()
    const live = setup()
    await live.voice.enable()
    live.track.onended()
    expect(live.state.enabled).toBe(false)
    expect(live.track.onended).toBeNull()
    expect(live.track.stop).toHaveBeenCalledOnce()
  })
  it('does not request capture from a hidden or prerendered document', () => {
    const gum = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: gum } })
    vi.stubGlobal('document', { visibilityState: 'hidden' })
    expect(() => requestMicrophone({ audio: true })).toThrow('PageInactive')
    vi.stubGlobal('document', { visibilityState: 'visible', prerendering: true })
    expect(() => requestMicrophone({ audio: true })).toThrow('PageInactive')
    expect(gum).not.toHaveBeenCalled()
  })
  it('satisfies WebKit capture-category checks before the first user-gesture request', async () => {
    const audioSession = { type: 'playback' }
    vi.stubGlobal('navigator', { audioSession })
    const gum = vi.fn(async () => {
      if (audioSession.type !== 'play-and-record') throw new DOMException('AudioSession category is not compatible with audio capture.', 'InvalidStateError')
      return t.stream
    })
    const t = setup({ getUserMedia: gum })
    await t.voice.enable()
    expect(t.state.enabled).toBe(true)
    expect(gum).toHaveBeenCalledTimes(1)
    expect(audioSession.type).toBe('play-and-record')
    t.voice.leave()
    expect(audioSession.type).toBe('playback')
  })
  it('joins when Web Crypto is available without randomUUID', async () => {
    let seed = 0
    vi.stubGlobal('crypto', { getRandomValues: bytes => { bytes.fill(++seed); return bytes } })
    const t = setup({ makeId: voiceSessionId })
    await t.voice.enable()
    expect(t.state.enabled).toBe(true)
    const first = t.send.mock.calls[0][0].id
    expect(first).toMatch(/^[a-f0-9]{32}$/)
    t.voice.leave()
    await t.voice.enable()
    expect(t.send.mock.lastCall[0].id).not.toBe(first)
  })
  it('distinguishes capture exceptions from failures after permission', async () => {
    const t = setup({ getUserMedia: async () => { throw new TypeError('private device details') } })
    await t.voice.enable()
    expect(t.state.error).toContain('[VOICE_CAPTURE_TypeError]')
    expect(t.state.error).not.toContain('private device details')
  })
})
