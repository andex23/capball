import { useMatchStore } from '../state/MatchStore'

let menuMusic = null
let started = false

function getVolume() {
  const { masterVolume, musicVolume, muted } = useMatchStore.getState()
  return muted ? 0 : masterVolume * musicVolume
}

export function startMenuMusic() {
  if (started && menuMusic && !menuMusic.paused) return
  if (!menuMusic) {
    menuMusic = new Audio('/assets/menu-music.mp3')
    menuMusic.loop = true
  }
  menuMusic.volume = getVolume()
  menuMusic.play().catch(() => {})
  started = true
}

export function stopMenuMusic() {
  if (menuMusic) {
    menuMusic.pause()
    menuMusic.currentTime = 0
    started = false
  }
}

export function updateMenuMusicVolume() {
  if (menuMusic && !menuMusic.paused) {
    menuMusic.volume = getVolume()
  }
}

// Fade out over duration ms
export function fadeOutMenuMusic(duration = 800) {
  if (!menuMusic || menuMusic.paused) return
  const startVol = menuMusic.volume
  const steps = 20
  const stepTime = duration / steps
  let step = 0
  const interval = setInterval(() => {
    step++
    menuMusic.volume = Math.max(0, startVol * (1 - step / steps))
    if (step >= steps) {
      clearInterval(interval)
      menuMusic.pause()
      menuMusic.currentTime = 0
      menuMusic.volume = startVol
      started = false
    }
  }, stepTime)
}
