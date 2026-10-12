import { useMatchStore } from '../state/MatchStore'

/**
 * Menu music. The player picks a track in Settings (or none); the choice is
 * saved as `musicTrack`, an index into MUSIC_TRACKS.
 */
export const MUSIC_TRACKS = [
  { key: 'off', label: 'Off', src: null },
  { key: 'chill', label: 'Chill', src: '/assets/music-chill.mp3', gain: 1 },
  { key: 'groove', label: 'Groove', src: '/assets/music-groove.mp3', gain: 1 },
  // The original track is mastered much louder than the others
  { key: 'classic', label: 'Arcade', src: '/assets/menu-music.mp3', gain: 0.5 },
]
export const DEFAULT_MUSIC_TRACK = 1

let menuMusic = null
let loadedSrc = null
let started = false
let fadeTimer = null

function currentTrack() {
  const i = useMatchStore.getState().musicTrack
  return MUSIC_TRACKS[Number.isInteger(i) && MUSIC_TRACKS[i] ? i : DEFAULT_MUSIC_TRACK]
}

function getVolume() {
  const { masterVolume, musicVolume, muted } = useMatchStore.getState()
  return muted ? 0 : Math.min(1, masterVolume * musicVolume * (currentTrack().gain ?? 1))
}

export function startMenuMusic() {
  const track = currentTrack()
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
  if (!track.src) { stopMenuMusic(); return }
  if (menuMusic && loadedSrc !== track.src) { menuMusic.pause(); menuMusic = null }
  if (started && menuMusic && !menuMusic.paused) { menuMusic.volume = getVolume(); return }
  if (!menuMusic) {
    menuMusic = new Audio(track.src)
    menuMusic.loop = true
    loadedSrc = track.src
  }
  menuMusic.volume = getVolume()
  menuMusic.play().catch(() => {})
  started = true
}

export function stopMenuMusic() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
  if (menuMusic) {
    menuMusic.pause()
    menuMusic.currentTime = 0
  }
  started = false
}

export function updateMenuMusicVolume() {
  if (menuMusic && !menuMusic.paused) {
    menuMusic.volume = getVolume()
  }
}

/** Switch track from Settings: plays the new one straight away (or stops for Off). */
export function changeMenuMusic() {
  stopMenuMusic()
  startMenuMusic()
}

// Fade out over duration ms
export function fadeOutMenuMusic(duration = 800) {
  if (!menuMusic || menuMusic.paused) return
  if (fadeTimer) clearInterval(fadeTimer)
  const startVol = menuMusic.volume
  const steps = 20
  const stepTime = duration / steps
  let step = 0
  fadeTimer = setInterval(() => {
    step++
    if (!menuMusic) { clearInterval(fadeTimer); fadeTimer = null; return }
    menuMusic.volume = Math.max(0, startVol * (1 - step / steps))
    if (step >= steps) {
      clearInterval(fadeTimer)
      fadeTimer = null
      menuMusic.pause()
      menuMusic.currentTime = 0
      menuMusic.volume = startVol
      started = false
    }
  }, stepTime)
}
