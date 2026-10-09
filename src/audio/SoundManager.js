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

// Everything goes through one gentle compressor, so stacked sounds never
// clip or get harsh on phone speakers
let out = null
function output(ctx) {
  if (out && out.context === ctx) return out
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 12
  comp.ratio.value = 4
  comp.attack.value = 0.003
  comp.release.value = 0.15
  comp.connect(ctx.destination)
  out = comp
  return out
}

// One second of white noise, made once and reused
let noiseBuf = null
function noiseBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

/* ── Sound generators ──
   Soft shapes only: sines and triangles with a quick fade in and a smooth
   tail, and filtered noise for clicks and knocks. No raw square waves. */

function tone({ freq, freqTo = freq, dur, type = 'sine', vol = 0.2, attack = 0.004, delay = 0, lowpass = 0 }) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime + delay / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (freqTo !== freq) osc.frequency.exponentialRampToValueAtTime(freqTo, t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(v, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  let node = osc
  if (lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lowpass
    osc.connect(f)
    node = f
  }
  node.connect(gain)
  gain.connect(output(ctx))
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise({ dur, vol = 0.2, type = 'bandpass', freq = 1500, q = 1, delay = 0, attack = 0.002 }) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime + delay / 1000
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(v, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f)
  f.connect(gain)
  gain.connect(output(ctx))
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

// A referee's pea whistle: two close pitches beating against each other,
// with the pea's flutter
function whistle(dur, { vol = 0.14, delay = 0 } = {}) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime + delay / 1000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(v, t + 0.02)
  gain.gain.setValueAtTime(v, t + dur - 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const flutter = ctx.createOscillator()
  const depth = ctx.createGain()
  flutter.frequency.value = 38
  depth.gain.value = 70
  flutter.connect(depth)
  for (const f of [2700, 2760]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    depth.connect(o.frequency)
    o.connect(gain)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
  flutter.start(t)
  flutter.stop(t + dur + 0.02)
  gain.connect(output(ctx))
}

// A struck object: a few damped resonances (its "modes") plus a tiny click of
// noise for the moment of contact. This is what makes a knock sound like
// plastic or wood rather than a beep. Pitch wobbles a little every time.
function knock(modes, { vol = 0.3, click = null, pitch = 1, delay = 0 } = {}) {
  const v = getVolume() * vol
  if (v <= 0) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime + delay / 1000
  const wobble = pitch * (0.96 + Math.random() * 0.08)
  const bus = ctx.createGain()
  bus.gain.value = v
  bus.connect(output(ctx))
  for (const m of modes) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(m.f * wobble, t)
    if (m.drop) o.frequency.exponentialRampToValueAtTime(m.f * wobble * m.drop, t + m.d * 3)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(m.a, t + 0.0015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + m.d * 4)
    o.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + m.d * 4 + 0.02)
  }
  if (click) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const f = ctx.createBiquadFilter()
    f.type = click.type || 'bandpass'
    f.frequency.value = click.f * wobble
    f.Q.value = click.q ?? 0.9
    const g = ctx.createGain()
    g.gain.setValueAtTime(click.a, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + click.d)
    src.connect(f)
    f.connect(g)
    g.connect(bus)
    src.start(t, Math.random() * 0.5)
    src.stop(t + click.d + 0.02)
  }
}

// How hard something hit (0..1) → how loud the knock is
const hitVol = (base, intensity = 0.6) => base * (0.25 + 0.75 * Math.min(1, Math.max(0, intensity)))


/* ── Unlocking sound on phones ──
   iPhones mute Web Audio when the ring/silent switch is on silent, and
   suspend it after calls or app switches. Marking the page as media playback
   and resuming on every touch keeps the game's sounds on. */
let unlocked = false
export function initAudioUnlock() {
  if (unlocked || typeof window === 'undefined') return
  unlocked = true
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch { /* not supported */ }
  const wake = () => {
    const ctx = getCtx()
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
  }
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, { passive: true })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake() })
}

/* ── Rolling ──
   A soft continuous rumble while things slide across the board: the ball's
   roll (brighter) and the caps' slide (lower), following their speeds. */
let roll = null
function startRoll(ctx) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.loop = true
  const ballF = ctx.createBiquadFilter()
  ballF.type = 'bandpass'
  ballF.frequency.value = 900
  ballF.Q.value = 0.8
  const capF = ctx.createBiquadFilter()
  capF.type = 'lowpass'
  capF.frequency.value = 380
  const ballG = ctx.createGain()
  const capG = ctx.createGain()
  ballG.gain.value = 0
  capG.gain.value = 0
  src.connect(ballF); ballF.connect(ballG); ballG.connect(output(ctx))
  src.connect(capF); capF.connect(capG); capG.connect(output(ctx))
  src.start()
  roll = { src, ballG, capG, ballF }
}

/**
 * Set the rolling sound from how fast the ball and the fastest cap are going
 * (0..1 of a full-power flick). 0, 0 fades it out.
 */
export function setRolling(ball, cap) {
  const v = getVolume()
  const ctx = audioCtx
  if (!ctx || (!roll && ball < 0.01 && cap < 0.01)) return
  if (!roll) { if (v <= 0) return; startRoll(ctx) }
  const t = ctx.currentTime
  const b = Math.min(1, Math.max(0, ball))
  const c = Math.min(1, Math.max(0, cap))
  roll.ballG.gain.setTargetAtTime(v * 0.22 * Math.sqrt(b), t, 0.05)
  roll.capG.gain.setTargetAtTime(v * 0.3 * Math.sqrt(c), t, 0.05)
  roll.ballF.frequency.setTargetAtTime(600 + 900 * b, t, 0.08)
}

export function stopRolling() {
  if (!roll || !audioCtx) return
  const t = audioCtx.currentTime
  roll.ballG.gain.setTargetAtTime(0, t, 0.05)
  roll.capG.gain.setTargetAtTime(0, t, 0.05)
}

// --- Exported sound functions ---

/** Start screen: a soft two-note chime. */
export function playCoinInsert() {
  tone({ freq: 784, dur: 0.35, vol: 0.12 })
  tone({ freq: 1175, dur: 0.5, vol: 0.1, delay: 90 })
}

// UI taps: a quiet, short click
function uiClick(pitch = 1) {
  noise({ dur: 0.025, vol: 0.06, freq: 3200 * pitch, q: 2 })
  tone({ freq: 900 * pitch, freqTo: 700 * pitch, dur: 0.05, vol: 0.05 })
}

export function playMenuNavigate() { uiClick(1) }

/** Hovering makes no sound: ticking on every pointer move was too much. */
export function playHoverTick() {}

export function playButtonSelect() { uiClick(1.1) }

export function playConfirm() {
  uiClick(1.2)
  tone({ freq: 660, dur: 0.18, vol: 0.06, delay: 20 })
  tone({ freq: 990, dur: 0.24, vol: 0.05, delay: 80 })
}

export function playBack() { uiClick(0.8) }

export function playWhistle() {
  whistle(0.28)
  whistle(0.14, { delay: 360 })
}

/** A keeper throwing himself across the goal: a quick whoosh of air. */
export function playDive() {
  noise({ dur: 0.38, vol: 0.32, type: 'bandpass', freq: 700, q: 0.7, attack: 0.07 })
  noise({ dur: 0.26, vol: 0.16, type: 'bandpass', freq: 2100, q: 0.9, attack: 0.05, delay: 50 })
}

export function playFinalWhistle() {
  whistle(0.3)
  whistle(0.3, { delay: 420 })
  whistle(0.75, { delay: 840 })
}

/** A fingernail flicking the cap: a sharp snap with a little body behind it. */
export function playFlick(power = 0.7) {
  knock([
    { f: 2100, d: 0.012, a: 0.5 },
    { f: 3400, d: 0.008, a: 0.3 },
    { f: 210, d: 0.035, a: 0.7, drop: 0.7 },
  ], { vol: hitVol(0.85, power), click: { f: 4200, q: 0.7, d: 0.018, a: 1 } })
}

/** Cap on ball: a bright plastic clack, louder the harder the hit. */
export function playBallHit(intensity = 0.6) {
  knock([
    { f: 1750, d: 0.022, a: 0.7 },
    { f: 2950, d: 0.016, a: 0.45 },
    { f: 4600, d: 0.009, a: 0.25 },
    { f: 780, d: 0.03, a: 0.35 },
  ], { vol: hitVol(0.95, intensity), click: { f: 3800, q: 1, d: 0.01, a: 0.9 } })
}

/** Cap on cap: the same plastic, a bit lower and duller. */
export function playCapHit(intensity = 0.6) {
  knock([
    { f: 1250, d: 0.02, a: 0.7 },
    { f: 2150, d: 0.014, a: 0.4 },
    { f: 560, d: 0.03, a: 0.4 },
  ], { vol: hitVol(0.8, intensity), click: { f: 2600, q: 1, d: 0.01, a: 0.7 } })
}

/** Into the wooden board edge: a woody knock. */
export function playWallHit(intensity = 0.6) {
  knock([
    { f: 190, d: 0.07, a: 0.8, drop: 0.85 },
    { f: 420, d: 0.045, a: 0.5 },
    { f: 730, d: 0.03, a: 0.3 },
    { f: 1450, d: 0.015, a: 0.15 },
  ], { vol: hitVol(0.85, intensity), click: { f: 1100, type: 'lowpass', q: 0.7, d: 0.02, a: 0.8 } })
}

/** Goal: the whistle, then a warm rising chord (the crowd roars on top). */
export function playGoal() {
  whistle(0.22, { vol: 0.08 })
  ;[523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.9, vol: 0.06, attack: 0.03, delay: 250 + i * 70, lowpass: 2500, type: 'triangle' }))
}

/** Turn passes over: barely there. */
export function playTurnChange() {
  tone({ freq: 740, dur: 0.12, vol: 0.06 })
}

export function playFoulWhistle() {
  whistle(0.18)
  whistle(0.45, { delay: 240 })
}

export function playFreeKick() {
  tone({ freq: 587, dur: 0.18, vol: 0.06 })
  tone({ freq: 784, dur: 0.22, vol: 0.05, delay: 110 })
}

export function playPenalty() {
  whistle(0.5)
}

// Shot clock: a soft tick for each of the last seconds, a low tone when it runs out
export function playShotClockTick() {
  tone({ freq: 1000, dur: 0.04, vol: 0.05 })
}

export function playShotClockBuzzer() {
  tone({ freq: 220, freqTo: 180, dur: 0.4, type: 'triangle', vol: 0.12 })
}

/* ── Crowd ──
   A looping bed of filtered noise whose level the match drives (see
   scene/useCrowdReaction.js), plus one-shot reactions on top. Everything
   scales with the master/effects volume and mute, like every other sound. */

// Noise swell through a band-pass filter: `freq` can glide to `freqTo`
function playCrowdNoise({ duration, vol, freq, freqTo = freq, q = 0.8, attack = 0.1 }) {
  const v = getVolume() * vol * crowdScale()
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
const CROWD_GAIN = 0.09

// The bed's gain for a crowd level 0–1, with the current volume settings
function crowdGain(level) {
  return getVolume() * CROWD_GAIN * crowdScale() * (0.25 + level)
}

// A full stadium is loud; the table, the street and the village pitch only
// have a handful of people watching
function crowdScale() {
  return useMatchStore.getState().stadium === 'arena' ? 1 : 0.35
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
