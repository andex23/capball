import { useMatchStore } from '../state/MatchStore'

// Web Audio API synthesized sounds — no external files needed
let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function getVolume() {
  const { masterVolume, sfxVolume, muted } = useMatchStore.getState()
  return muted ? 0 : masterVolume * sfxVolume
}

// --- Sound generators ---

function playTone(freq, duration, type = 'square', vol = 0.3) {
  const ctx = getCtx()
  const v = getVolume() * vol
  if (v <= 0) return
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
  const ctx = getCtx()
  const v = getVolume() * vol
  if (v <= 0) return
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

// Crowd ambience — looping noise filtered to sound like a crowd
let crowdNode = null
export function startCrowdAmbience() {
  if (crowdNode) return
  const ctx = getCtx()
  const v = getVolume() * 0.08
  if (v <= 0) return

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
  gain.gain.value = v

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  crowdNode = { source, gain }
}

export function stopCrowdAmbience() {
  if (crowdNode) {
    crowdNode.source.stop()
    crowdNode = null
  }
}

export function setCrowdVolume(vol) {
  if (crowdNode) crowdNode.gain.gain.value = vol * 0.08
}
