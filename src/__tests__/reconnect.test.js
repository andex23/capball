import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createReconnectMachine, backoffDelay, formatCountdown, onlineInterrupted, RECONNECT } from '../multiplayer/reconnect'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

/** A controllable attempt: each call returns a promise the test settles. */
function attempts() {
  const calls = []
  const fn = vi.fn(() => new Promise((resolve, reject) => calls.push({ resolve, reject, at: Date.now() })))
  return { fn, calls }
}

describe('backoff and countdown helpers', () => {
  it('doubles from 1 s up to the cap', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n, 1000, 16000))).toEqual([1000, 2000, 4000, 8000, 16000, 16000, 16000])
    expect(backoffDelay(-3)).toBe(RECONNECT.baseDelayMs)
    expect(backoffDelay(1e9)).toBe(RECONNECT.maxDelayMs)
  })

  it('formats m:ss, rounding up', () => {
    expect(formatCountdown(60000)).toBe('1:00')
    expect(formatCountdown(59001)).toBe('1:00')
    expect(formatCountdown(59000)).toBe('0:59')
    expect(formatCountdown(4200)).toBe('0:05')
    expect(formatCountdown(-5)).toBe('0:00')
    expect(formatCountdown(undefined)).toBe('0:00')
  })

  it('knows when an online match is interrupted', () => {
    const base = { gameMode: 'online', onlineStatus: { status: 'connected' }, onlineReconnect: null }
    expect(onlineInterrupted(base)).toBe(false)
    expect(onlineInterrupted({ ...base, onlineReconnect: { phase: 'lost' } })).toBe(true)
    expect(onlineInterrupted({ ...base, onlineReconnect: { phase: 'restored' } })).toBe(true)
    expect(onlineInterrupted({ ...base, onlineStatus: { status: 'disconnected' } })).toBe(true)
    expect(onlineInterrupted({ ...base, gameMode: 'local', onlineStatus: { status: 'disconnected' } })).toBe(false)
  })
})

describe('host: waiting for the guest', () => {
  it('counts down the grace period, then gives up', () => {
    const onGiveUp = vi.fn()
    const changes = []
    const m = createReconnectMachine({ graceMs: 60000, onGiveUp, onChange: (s) => changes.push(s.phase) })
    const t0 = Date.now()
    expect(m.start()).toBe(true)
    expect(m.state).toMatchObject({ phase: 'lost', deadline: t0 + 60000 })
    expect(m.start()).toBe(false) // already waiting
    vi.advanceTimersByTime(59999)
    expect(onGiveUp).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onGiveUp).toHaveBeenCalledOnce()
    expect(m.state.phase).toBe('failed')
    expect(changes).toEqual(['lost', 'failed'])
  })

  it('shows "back" for a moment when the guest returns, then settles', () => {
    const onGiveUp = vi.fn()
    const onRestored = vi.fn()
    const onSettled = vi.fn()
    const m = createReconnectMachine({ graceMs: 60000, noticeMs: 2500, onGiveUp, onRestored, onSettled })
    m.start()
    vi.advanceTimersByTime(20000)
    expect(m.succeed()).toBe(true)
    expect(m.state.phase).toBe('restored')
    expect(onRestored).toHaveBeenCalledOnce()
    expect(m.succeed()).toBe(false)
    vi.advanceTimersByTime(2499)
    expect(onSettled).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onSettled).toHaveBeenCalledOnce()
    expect(m.state.phase).toBe('idle')
    vi.advanceTimersByTime(120000)
    expect(onGiveUp).not.toHaveBeenCalled()
  })

  it('can drop again after recovering', () => {
    const onGiveUp = vi.fn()
    const m = createReconnectMachine({ graceMs: 1000, noticeMs: 100, onGiveUp })
    m.start()
    m.succeed()
    vi.advanceTimersByTime(100)
    expect(m.start()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(onGiveUp).toHaveBeenCalledOnce()
  })

  it('stop() cancels everything', () => {
    const onGiveUp = vi.fn()
    const m = createReconnectMachine({ graceMs: 1000, onGiveUp })
    m.start()
    m.stop()
    vi.advanceTimersByTime(5000)
    expect(onGiveUp).not.toHaveBeenCalled()
    expect(m.state.phase).toBe('idle')
    expect(m.active).toBe(false)
  })
})

describe('guest: retrying with backoff', () => {
  it('retries at 1 s, 2 s, 4 s … after each failure', async () => {
    const { fn, calls } = attempts()
    const m = createReconnectMachine({ graceMs: 60000, baseDelayMs: 1000, maxDelayMs: 16000, attempt: fn })
    const t0 = Date.now()
    m.start()
    expect(fn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(m.state).toMatchObject({ attempts: 1, trying: true })

    calls[0].reject(new Error('peer-unavailable'))
    await vi.advanceTimersByTimeAsync(0)
    expect(m.state.trying).toBe(false)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)

    calls[1].reject(new Error('timeout'))
    await vi.advanceTimersByTimeAsync(4000)
    expect(fn).toHaveBeenCalledTimes(3)
    expect(calls.map((c) => c.at - t0)).toEqual([1000, 3000, 7000])
  })

  it('succeeds when an attempt gets through', async () => {
    const { fn, calls } = attempts()
    const onRestored = vi.fn()
    const onGiveUp = vi.fn()
    const m = createReconnectMachine({ graceMs: 60000, attempt: fn, onRestored, onGiveUp })
    m.start()
    await vi.advanceTimersByTimeAsync(1000)
    calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(m.state.phase).toBe('restored')
    expect(onRestored).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(120000)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(onGiveUp).not.toHaveBeenCalled()
  })

  it('treats a throwing attempt as a failed one', async () => {
    const fn = vi.fn(() => { throw new Error('boom') })
    const m = createReconnectMachine({ graceMs: 10000, attempt: fn })
    m.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('stops retrying and gives up when the grace period ends', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('nope')))
    const onGiveUp = vi.fn()
    const m = createReconnectMachine({ graceMs: 60000, baseDelayMs: 1000, maxDelayMs: 16000, attempt: fn, onGiveUp })
    m.start()
    await vi.advanceTimersByTimeAsync(60000)
    // 1, 3, 7, 15, 31, 47 s — the next (63 s) would start after the deadline
    expect(fn).toHaveBeenCalledTimes(6)
    expect(onGiveUp).toHaveBeenCalledOnce()
    expect(m.state.phase).toBe('failed')
    await vi.advanceTimersByTimeAsync(60000)
    expect(fn).toHaveBeenCalledTimes(6)
  })

  it('ignores an attempt that settles after the player left', async () => {
    const { fn, calls } = attempts()
    const onRestored = vi.fn()
    const m = createReconnectMachine({ graceMs: 60000, attempt: fn, onRestored })
    m.start()
    await vi.advanceTimersByTimeAsync(1000)
    m.stop()
    calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(onRestored).not.toHaveBeenCalled()
    expect(m.state.phase).toBe('idle')
  })

  it('ignores an attempt that settles after giving up', async () => {
    const { fn, calls } = attempts()
    const onRestored = vi.fn()
    const m = createReconnectMachine({ graceMs: 5000, attempt: fn, onRestored })
    m.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(m.state.phase).toBe('failed')
    calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(onRestored).not.toHaveBeenCalled()
    expect(m.state.phase).toBe('failed')
  })
})
