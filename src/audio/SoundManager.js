import { useMatchStore } from '../state/MatchStore'

// Web Audio API synthesized sounds — no external files needed
let audioCtx = null

// Returns null where Web Audio isn't available (tests, old browsers) so every
// sound quietly becomes a no-op instead of throwing mid-match.
function getCtx() {
  if (!audioCtx) {
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (!Ctx) return null
    try { audioCtx = new Ctx() } catch { return null }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function getVolume() {
  const { masterVolume, sfxVolume, muted } = useMatchStore.getState()
  return muted ? 0 : masterVolume * sfxVolume
}

// --- Sound generators ---

function playTone(freq, duration, type = 'square', vol = 0.3) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(v, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

function playNoise(duration, vol = 0.2) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = v
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

// --- Exported sound functions ---

export function playCoinInsert() {
  // Classic arcade coin-drop sound
  playTone(1200, 0.06, 'square', 0.25)
  setTimeout(() => playTone(1600, 0.06, 'square', 0.2), 60)
  setTimeout(() => playTone(2000, 0.04, 'square', 0.15), 120)
  setTimeout(() => playTone(1400, 0.08, 'square', 0.2), 180)
  setTimeout(() => playTone(1800, 0.12, 'square', 0.25), 240)
}

export function playMenuNavigate() {
  playTone(660, 0.05, 'square', 0.15)
}

export function playHoverTick() {
  playTone(800, 0.04, 'square', 0.1)
}

export function playButtonSelect() {
  playTone(600, 0.08, 'square', 0.2)
  setTimeout(() => playTone(900, 0.06, 'square', 0.15), 40)
}

export function playConfirm() {
  playTone(523, 0.1, 'square', 0.25)
  setTimeout(() => playTone(659, 0.1, 'square', 0.25), 80)
  setTimeout(() => playTone(784, 0.15, 'square', 0.3), 160)
}

export function playBack() {
  playTone(500, 0.08, 'square', 0.15)
  setTimeout(() => playTone(350, 0.1, 'square', 0.12), 50)
}

export function playWhistle() {
  playTone(880, 0.3, 'sine', 0.4)
  setTimeout(() => playTone(880, 0.15, 'sine', 0.3), 350)
}

export function playFinalWhistle() {
  playTone(880, 0.25, 'sine', 0.4)
  setTimeout(() => playTone(880, 0.25, 'sine', 0.35), 300)
  setTimeout(() => playTone(880, 0.5, 'sine', 0.45), 600)
}

export function playFlick() {
  playNoise(0.08, 0.3)
  playTone(200, 0.06, 'triangle', 0.2)
}

export function playBallHit() {
  playTone(300, 0.05, 'triangle', 0.25)
  playNoise(0.04, 0.15)
}

export function playWallHit() {
  playTone(150, 0.08, 'triangle', 0.2)
  playNoise(0.06, 0.12)
}

export function playGoal() {
  // Crowd burst + rising tones
  playNoise(0.8, 0.35)
  playTone(440, 0.15, 'square', 0.3)
  setTimeout(() => playTone(554, 0.15, 'square', 0.3), 100)
  setTimeout(() => playTone(659, 0.15, 'square', 0.3), 200)
  setTimeout(() => playTone(880, 0.4, 'square', 0.4), 300)
  setTimeout(() => playNoise(0.5, 0.25), 400)
}

export function playTurnChange() {
  playTone(440, 0.06, 'sine', 0.15)
  setTimeout(() => playTone(550, 0.06, 'sine', 0.12), 60)
}

export function playFoulWhistle() {
  playTone(740, 0.2, 'sine', 0.4)
  setTimeout(() => playTone(740, 0.4, 'sine', 0.35), 250)
}

export function playFreeKick() {
  playTone(660, 0.1, 'sine', 0.2)
  setTimeout(() => playTone(550, 0.15, 'sine', 0.2), 120)
}

export function playPenalty() {
  playTone(440, 0.15, 'sine', 0.25)
  setTimeout(() => playTone(440, 0.15, 'sine', 0.25), 200)
  setTimeout(() => playTone(660, 0.25, 'sine', 0.3), 400)
}

/* ── Crowd ──
   A looping bed of filtered noise whose level the match drives (see
   scene/useCrowdReaction.js), plus one-shot reactions on top. Everything
   scales with the master/effects volume and mute, like every other sound. */

// Noise swell through a band-pass filter: `freq` can glide to `freqTo`
function playCrowdNoise({ duration, vol, freq, freqTo = freq, q = 0.8, attack = 0.1 }) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, t)
  filter.frequency.exponentialRampToValueAtTime(freqTo, t + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(v, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start(t)
  source.stop(t + duration)
}

// A sliding whistle from somewhere in the stands
function playCrowdWhistle(from, to, duration, vol) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(v, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + duration)
}

/** The stadium erupts. */
export function playCrowdRoar() {
  playCrowdNoise({ duration: 2.6, vol: 0.5, freq: 500, freqTo: 900, q: 0.6, attack: 0.18 })
  playCrowdNoise({ duration: 2.2, vol: 0.3, freq: 1400, freqTo: 1100, q: 1.2, attack: 0.25 })
  setTimeout(() => playCrowdNoise({ duration: 1.8, vol: 0.25, freq: 700, freqTo: 450, q: 0.7, attack: 0.3 }), 900)
}

/** "Ohhh…" — a shot just wide of the post. */
export function playCrowdGroan() {
  playCrowdNoise({ duration: 1.3, vol: 0.4, freq: 650, freqTo: 260, q: 1.4, attack: 0.12 })
  playCrowdNoise({ duration: 1.1, vol: 0.2, freq: 1200, freqTo: 500, q: 2, attack: 0.08 })
}

/** Disgruntled murmur and a few whistles from the stands after a foul. */
export function playCrowdMurmur() {
  playCrowdNoise({ duration: 1.4, vol: 0.28, freq: 320, freqTo: 420, q: 1.2, attack: 0.2 })
  setTimeout(() => playCrowdWhistle(1900, 2500, 0.35, 0.08), 150)
  setTimeout(() => playCrowdWhistle(2300, 1700, 0.45, 0.07), 420)
  setTimeout(() => playCrowdWhistle(2100, 2700, 0.3, 0.06), 700)
}

let crowdNode = null
let crowdLevel = 0.3
const CROWD_GAIN = 0.12

// The bed's gain for a crowd level 0–1, with the current volume settings
function crowdGain(level) {
  return getVolume() * CROWD_GAIN * (0.25 + level)
}

/** Start the crowd bed (silent if sound is off — it follows setCrowdVolume). */
export function startCrowdAmbience() {
  if (crowdNode) return
  const ctx = getCtx()
  if (!ctx) return

  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 400
  filter.Q.value = 0.5

  const gain = ctx.createGain()
  gain.gain.value = crowdGain(crowdLevel)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  crowdNode = { source, filter, gain }
}

export function stopCrowdAmbience() {
  if (crowdNode) {
    try { crowdNode.source.stop() } catch { /* already stopped */ }
    crowdNode.gain.disconnect()
    crowdNode = null
  }
}

/**
 * Set how excited the crowd is, 0 (hushed) – 1 (on its feet). A busier crowd
 * is louder and brighter. Re-reads the volume settings every call, so mute
 * and the sliders apply straight away.
 */
export function setCrowdVolume(level) {
  crowdLevel = Math.min(1, Math.max(0, level))
  if (!crowdNode || !audioCtx) return
  const t = audioCtx.currentTime
  crowdNode.gain.gain.setTargetAtTime(crowdGain(crowdLevel), t, 0.08)
  crowdNode.filter.frequency.setTargetAtTime(380 + 420 * crowdLevel, t, 0.15)
}
