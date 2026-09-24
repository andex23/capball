/**
 * Reconnect state machine — pure, no PeerJS, timers injectable.
 *
 * When the link drops mid-session:
 *   - the host keeps its room open and waits (no `attempt`), up to `graceMs`;
 *   - the guest retries (`attempt` returns a promise) with exponential backoff
 *     until it gets through or the grace period runs out.
 *
 * Phases: idle → lost → restored → idle (after `noticeMs`)
 *                    ↘ failed (grace period over, `onGiveUp`)
 */

export const RECONNECT = {
  graceMs: 60000,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  noticeMs: 2500,
}

/** Delay before retry number `attempt` (0-based): 1 s, 2 s, 4 s … capped. */
export function backoffDelay(attempt, base = RECONNECT.baseDelayMs, max = RECONNECT.maxDelayMs) {
  const n = Math.max(0, Math.floor(attempt) || 0)
  return Math.min(max, base * 2 ** Math.min(n, 30))
}

/** "m:ss" for a countdown in ms (rounded up, never negative). */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Is an online match currently interrupted (dropped, reconnecting or just back)? */
export function onlineInterrupted(state) {
  if (state?.gameMode !== 'online') return false
  if (state.onlineStatus?.status === 'disconnected') return true
  const phase = state.onlineReconnect?.phase
  return phase === 'lost' || phase === 'restored'
}

export function createReconnectMachine({
  graceMs = RECONNECT.graceMs,
  baseDelayMs = RECONNECT.baseDelayMs,
  maxDelayMs = RECONNECT.maxDelayMs,
  noticeMs = RECONNECT.noticeMs,
  attempt = null, // guest: () => Promise; host: null (just waits)
  onChange = () => {},
  onGiveUp = () => {},
  onRestored = () => {},
  onSettled = () => {},
  now = () => Date.now(),
  timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
} = {}) {
  let state = { phase: 'idle', deadline: 0, attempts: 0, trying: false }
  let giveUpTimer = null
  let retryTimer = null
  let noticeTimer = null
  // Bumped on every transition so a late attempt result from an old round is ignored
  let generation = 0

  const emit = (patch) => {
    state = { ...state, ...patch }
    onChange(state)
  }

  const clearAll = () => {
    for (const id of [giveUpTimer, retryTimer, noticeTimer]) if (id !== null) timers.clearTimeout(id)
    giveUpTimer = retryTimer = noticeTimer = null
  }

  function scheduleRetry(n) {
    const delay = backoffDelay(n, baseDelayMs, maxDelayMs)
    // No point starting an attempt the grace period won't let finish
    if (now() + delay >= state.deadline) return
    retryTimer = timers.setTimeout(() => { retryTimer = null; runAttempt(n) }, delay)
  }

  function runAttempt(n) {
    const gen = generation
    emit({ attempts: n + 1, trying: true })
    let result
    try {
      result = Promise.resolve(attempt())
    } catch (err) {
      result = Promise.reject(err)
    }
    result.then(
      () => { if (gen === generation && state.phase === 'lost') succeed() },
      () => {
        if (gen !== generation || state.phase !== 'lost') return
        emit({ trying: false })
        scheduleRetry(n + 1)
      },
    )
  }

  function giveUp() {
    giveUpTimer = null
    clearAll()
    generation++
    emit({ phase: 'failed', trying: false })
    onGiveUp()
  }

  /** The link dropped. No-op if we're already handling a drop. */
  function start() {
    if (state.phase === 'lost') return false
    clearAll()
    generation++
    emit({ phase: 'lost', deadline: now() + graceMs, attempts: 0, trying: false })
    giveUpTimer = timers.setTimeout(giveUp, graceMs)
    if (attempt) scheduleRetry(0)
    return true
  }

  /** The other side is back (host: guest reconnected; guest: attempt succeeded). */
  function succeed() {
    if (state.phase !== 'lost') return false
    clearAll()
    generation++
    emit({ phase: 'restored', trying: false })
    onRestored()
    noticeTimer = timers.setTimeout(() => {
      noticeTimer = null
      emit({ phase: 'idle' })
      onSettled()
    }, noticeMs)
    return true
  }

  /** Cancel everything (player left). */
  function stop() {
    clearAll()
    generation++
    if (state.phase !== 'idle') emit({ phase: 'idle', trying: false })
  }

  return {
    start,
    succeed,
    stop,
    get state() { return state },
    get active() { return state.phase === 'lost' },
  }
}
