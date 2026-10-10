import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ peers: [] }))
vi.mock('peerjs', () => {
  class Events {
    handlers = new Map()
    on(name, fn) { if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(fn) }
    off(name, fn) { this.handlers.get(name)?.delete(fn) }
    emit(name, data) { for (const fn of [...(this.handlers.get(name) || [])]) fn(data) }
  }
  class Peer extends Events {
    constructor(id, options) { super(); this.options = options || id; this.id = typeof id === 'string' ? id : ''; mocks.peers.push(this) }
    destroy = vi.fn()
    disconnect = vi.fn()
    connect() { this.connection = Object.assign(new Events(), { open: true, close: vi.fn(), send: vi.fn() }); return this.connection }
  }
  return { default: Peer, util: { defaultConfig: { iceServers: [{ urls: 'stun:example.test' }] } } }
})
import { createAutomaticLanRoom, joinAutomaticLanRoom, createRoom, disconnect } from '../multiplayer/MultiplayerManager'
import { useMatchStore } from '../state/MatchStore'

beforeEach(() => { vi.useFakeTimers(); mocks.peers.length = 0 })
afterEach(() => { disconnect(); vi.clearAllTimers(); vi.useRealTimers() })

describe('automatic LAN transport', () => {
  it('creates an automatic invite using only local ICE candidates', async () => {
    const opening = createAutomaticLanRoom()
    const peer = mocks.peers[0]
    expect(peer.options.config.iceServers).toEqual([])
    peer.emit('open')
    expect(await opening).toMatch(/^COUNTERBALL-AUTO1:[A-Z2-9]{12}$/)
    expect(useMatchStore.getState().onlineTransport).toBe('lan')
  })
  it('does not remove the ordinary online ICE configuration', async () => {
    const opening = createRoom()
    const peer = mocks.peers[0]
    expect(peer.options.config.iceServers.length).toBeGreaterThan(0)
    peer.emit('open')
    expect(await opening).toHaveLength(6)
  })
  it('joins without a guest reply scan and disconnects signalling once ready', async () => {
    const joining = joinAutomaticLanRoom('COUNTERBALL-AUTO1:ABCDEFGHJKLM')
    const peer = mocks.peers[0]
    expect(peer.options.config.iceServers).toEqual([])
    peer.emit('open')
    peer.connection.emit('data', { type: 'welcome', data: { token: 'a'.repeat(32) } })
    await joining
    expect(useMatchStore.getState().onlineStatus.status).toBe('connected')
    expect(useMatchStore.getState().onlineTransport).toBe('lan')
    expect(peer.disconnect).toHaveBeenCalledOnce()
    expect(peer.connection.close).not.toHaveBeenCalled()
  })
  it('times out unavailable signalling and offers offline pairing', async () => {
    const opening = createAutomaticLanRoom()
    const rejected = expect(opening).rejects.toThrow(/offline pairing/)
    await vi.advanceTimersByTimeAsync(15000)
    await rejected
    expect(mocks.peers[0].destroy).toHaveBeenCalled()
  })
  it('rejects malformed automatic room references before networking', async () => {
    await expect(joinAutomaticLanRoom('not-a-room')).rejects.toThrow(/fresh host invite/)
    expect(mocks.peers).toHaveLength(0)
  })
})
