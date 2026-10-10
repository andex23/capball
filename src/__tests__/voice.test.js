import { describe, it, expect, vi, afterEach } from 'vitest'
import { createVoiceChat } from '../multiplayer/voice'

const active = []
afterEach(() => { active.splice(0).forEach(v => v.dispose()); vi.useRealTimers() })
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
