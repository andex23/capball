import { describe, it, expect, afterEach, vi } from 'vitest'
import { createReplayBuffer, playbackDuration, playbackTime, REPLAY } from '../game/replay'
import { useMatchStore, PHASE, TIMING, clearMatchTimers } from '../state/MatchStore'

const IDS = ['a', 'ball']

/** Push frames at `fps` from t0 for `seconds`; body a sits at x = t, ball at x = 2t. */
function fill(buf, seconds, fps = 60, t0 = 0) {
  const n = Math.round(seconds * fps)
  for (let i = 0; i <= n; i++) {
    const t = t0 + i / fps
    buf.push(t, [t, -t, 2 * t, 0])
  }
}

describe('replay buffer', () => {
  it('keeps at most `capacity` frames, dropping the oldest', () => {
    const buf = createReplayBuffer(IDS, { capacity: 10, windowSec: 100 })
    for (let i = 0; i < 25; i++) buf.push(i, [i, 0, 0, 0])
    expect(buf.size).toBe(10)
    expect(buf.start).toBe(15)
    expect(buf.end).toBe(24)
    for (let i = 0; i < 10; i++) expect(buf.timeAt(i)).toBe(15 + i) // still oldest → newest
  })

  it('only keeps the last `windowSec` seconds', () => {
    const buf = createReplayBuffer(IDS, { capacity: 1000, windowSec: 3 })
    fill(buf, 10)
    expect(buf.end).toBeCloseTo(10)
    expect(buf.span).toBeLessThanOrEqual(3 + 1e-9)
    expect(buf.span).toBeGreaterThan(3 - 1 / 60)
    expect(buf.size).toBeLessThanOrEqual(3 * 60 + 1)
  })

  it('interpolates between frames and clamps at the ends', () => {
    const buf = createReplayBuffer(IDS, { capacity: 100, windowSec: 10 })
    buf.push(0, [0, 0, 0, 0])
    buf.push(1, [10, -10, 20, 4])
    const mid = buf.sample(0.25)
    expect(Array.from(mid)).toEqual([2.5, -2.5, 5, 1])
    expect(Array.from(buf.sample(-5))).toEqual([0, 0, 0, 0])
    expect(Array.from(buf.sample(9))).toEqual([10, -10, 20, 4])
  })

  it('samples correctly after wrapping around', () => {
    const buf = createReplayBuffer(IDS, { capacity: 7, windowSec: 100 })
    fill(buf, 1, 10) // 11 frames into 7 slots
    expect(buf.size).toBe(7)
    const out = buf.sample(0.65)
    expect(out[0]).toBeCloseTo(0.65)
    expect(out[2]).toBeCloseTo(1.3)
  })

  it('writes into a supplied array and can be cleared', () => {
    const buf = createReplayBuffer(IDS)
    fill(buf, 0.5)
    const out = new Float32Array(4)
    expect(buf.sample(0.1, out)).toBe(out)
    buf.clear()
    expect(buf.size).toBe(0)
    expect(buf.span).toBe(0)
  })

  it('starts a fresh record if time goes backwards', () => {
    const buf = createReplayBuffer(IDS)
    fill(buf, 1)
    buf.push(0.2, [0, 0, 0, 0])
    expect(buf.size).toBe(1)
  })
})

describe('replay playback', () => {
  const opts = { window: 2, slowTail: 1, leadSpeed: 1, slowSpeed: 0.5 }

  it('plays only the last `window` seconds: lead-up, then slow motion', () => {
    // Buffer covers 7 → 10; the replay shows 8 → 10
    expect(playbackTime(0, 7, 10, opts)).toBeCloseTo(8)
    expect(playbackTime(0.5, 7, 10, opts)).toBeCloseTo(8.5) // 1× lead-up
    expect(playbackTime(1, 7, 10, opts)).toBeCloseTo(9)
    expect(playbackTime(2, 7, 10, opts)).toBeCloseTo(9.5) // 0.5× finish
    expect(playbackTime(3, 7, 10, opts)).toBeCloseTo(10)
    expect(playbackTime(99, 7, 10, opts)).toBe(10) // holds the last frame
    expect(playbackDuration(3, opts)).toBeCloseTo(1 + 2)
  })

  it('replays a short record entirely in slow motion', () => {
    expect(playbackTime(0, 5, 5.5, opts)).toBeCloseTo(5)
    expect(playbackTime(0.4, 5, 5.5, opts)).toBeCloseTo(5.2)
    expect(playbackDuration(0.5, opts)).toBeCloseTo(1)
  })

  it('samples the buffer at the slow-motion speed', () => {
    const buf = createReplayBuffer(IDS)
    fill(buf, 3)
    const speed = { window: 1, slowTail: 1, leadSpeed: 1, slowSpeed: 0.4 }
    // One real second into the replay is 0.4 s of play after 2 s
    const t = playbackTime(1, buf.start, buf.end, speed)
    expect(t).toBeCloseTo(2.4)
    expect(buf.sample(t)[2]).toBeCloseTo(4.8) // ball at x = 2t
  })

  it('fits the banner and the longest replay inside the GOAL phase', () => {
    const total = REPLAY.bannerMs + playbackDuration(REPLAY.window) * 1000
    expect(total).toBeLessThanOrEqual(TIMING.goal)
    expect(TIMING.goal).toBeLessThanOrEqual(5000)
    // Mostly real slow motion
    expect(REPLAY.slowSpeed).toBeLessThanOrEqual(0.5)
  })
})

describe('skipping the goal replay', () => {
  const initial = useMatchStore.getState()
  afterEach(() => {
    clearMatchTimers()
    vi.useRealTimers()
    useMatchStore.setState(initial, true)
  })

  it('goes straight to the kick-off offline, and only once', () => {
    vi.useFakeTimers()
    const s = useMatchStore.getState()
    s.startGame()
    vi.advanceTimersByTime(TIMING.kickoff)
    useMatchStore.getState().scoreGoal('team1')
    useMatchStore.getState().skipGoal()
    expect(useMatchStore.getState().phase).toBe(PHASE.KICKOFF)
    expect(useMatchStore.getState().activeTeam).toBe('team2')
    vi.advanceTimersByTime(TIMING.kickoff)
    expect(useMatchStore.getState().phase).toBe(PHASE.SELECT)
    // The original goal timer was cancelled — it can't restart play later
    vi.advanceTimersByTime(TIMING.goal)
    expect(useMatchStore.getState().phase).toBe(PHASE.SELECT)
  })

  it('leaves the match flow to the host online', () => {
    vi.useFakeTimers()
    useMatchStore.getState().startGame()
    vi.advanceTimersByTime(TIMING.kickoff)
    useMatchStore.setState({ gameMode: 'online', onlineMyTeam: 'team1' })
    useMatchStore.getState().scoreGoal('team1')
    useMatchStore.getState().skipGoal()
    expect(useMatchStore.getState().phase).toBe(PHASE.GOAL)
    vi.advanceTimersByTime(TIMING.goal)
    expect(useMatchStore.getState().phase).toBe(PHASE.KICKOFF)
  })
})
