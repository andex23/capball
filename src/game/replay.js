/* ── Goal replay ──
   A rolling record of where every body was drawn over the last few seconds,
   and the maths for playing a stretch of it back in slow motion. Pure — no
   three.js, no store — so it can be unit tested. */

// How the replay is played back. The lead-up runs a little under real speed,
// the final moments (the shot going in) at slow motion. Banner + replay
// (1.0 + 3.6 s) fit inside TIMING.goal with a little slack for the online
// guest, whose GOAL phase starts a network hop later.
export const REPLAY = {
  bannerMs: 1000, // "GOAL!" banner before the replay starts
  window: 2.0, // seconds of play shown
  slowTail: 0.9, // the last this-many seconds play at slowSpeed
  leadSpeed: 0.8,
  slowSpeed: 0.4,
  minSpan: 0.3, // don't bother replaying less than this
}

/**
 * Ring buffer of frames: a timestamp (seconds) plus x/z for each id, in the
 * order of `ids`. Frames older than `windowSec` behind the newest are dropped,
 * as are the oldest once `capacity` is reached.
 */
export function createReplayBuffer(ids, { capacity = 400, windowSec = 3 } = {}) {
  const stride = ids.length * 2
  const times = new Float64Array(capacity)
  const data = new Float32Array(capacity * stride)
  let head = 0 // slot of the oldest frame
  let count = 0

  const slot = (i) => (head + i) % capacity // i-th oldest frame

  const buffer = {
    ids,
    get size() { return count },
    get capacity() { return capacity },

    clear() { head = 0; count = 0 },

    /** Add a frame. `positions` is a flat [x0, z0, x1, z1, …] in ids order. */
    push(t, positions) {
      // Time must run forward; a clock jump backwards starts a fresh record.
      if (count && t < times[slot(count - 1)]) buffer.clear()
      let s
      if (count < capacity) { s = slot(count); count++ } else { s = head; head = (head + 1) % capacity }
      times[s] = t
      data.set(positions.length === stride ? positions : positions.slice(0, stride), s * stride)
      // Drop frames that have fallen out of the window
      while (count > 1 && t - times[head] > windowSec) { head = (head + 1) % capacity; count-- }
    },

    /** Time of the i-th oldest frame. */
    timeAt(i) { return times[slot(i)] },
    get start() { return count ? times[head] : 0 },
    get end() { return count ? times[slot(count - 1)] : 0 },
    get span() { return count ? buffer.end - buffer.start : 0 },

    /**
     * Positions at time t, linearly interpolated between the two nearest
     * frames (clamped to the ends). Writes into and returns `out`.
     */
    sample(t, out = new Float32Array(stride)) {
      if (!count) return out
      if (t <= buffer.start) return copyFrame(slot(0), out)
      if (t >= buffer.end) return copyFrame(slot(count - 1), out)
      // Binary search for the last frame at or before t
      let lo = 0
      let hi = count - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (times[slot(mid)] <= t) lo = mid
        else hi = mid
      }
      const a = slot(lo)
      const b = slot(hi)
      const dt = times[b] - times[a]
      const k = dt > 0 ? (t - times[a]) / dt : 0
      for (let j = 0; j < stride; j++) {
        const va = data[a * stride + j]
        out[j] = va + (data[b * stride + j] - va) * k
      }
      return out
    },
  }

  function copyFrame(s, out) {
    for (let j = 0; j < stride; j++) out[j] = data[s * stride + j]
    return out
  }

  return buffer
}

/**
 * How long (real seconds) a replay of `span` recorded seconds takes. Only the
 * last `window` seconds are shown.
 */
export function playbackDuration(span, opts = REPLAY) {
  const shown = Math.min(span, opts.window)
  const slow = Math.min(shown, opts.slowTail)
  return (shown - slow) / opts.leadSpeed + slow / opts.slowSpeed
}

/**
 * Recorded time to show `elapsed` real seconds into a replay of a buffer that
 * covers [start, end]. Runs at leadSpeed, then slowSpeed for the final
 * slowTail seconds; clamps at `end` once the replay is over.
 */
export function playbackTime(elapsed, start, end, opts = REPLAY) {
  const from = Math.max(start, end - opts.window)
  const shown = end - from
  const lead = Math.max(0, shown - opts.slowTail) // recorded seconds at lead speed
  const leadDur = lead / opts.leadSpeed
  const e = Math.max(0, elapsed)
  const t = e < leadDur
    ? from + e * opts.leadSpeed
    : from + lead + (e - leadDur) * opts.slowSpeed
  return Math.min(t, end)
}
