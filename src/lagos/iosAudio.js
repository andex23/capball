/**
 * iPhones mute Web Audio when the ring/silent switch is on, unless the page is
 * also playing a normal audio element. The website fixes this with
 * navigator.audioSession, which Safari ignores inside another site's frame
 * (as in Lagos Life). So inside Lagos Life a silent, looping audio element
 * plays alongside the game; then its sounds play like any game or video.
 */
const SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

let el = null
let wanted = false

function start() {
  if (!wanted) return
  try {
    if (!el) {
      el = new Audio(SILENCE)
      el.loop = true
      el.setAttribute('playsinline', '')
      el.preload = 'auto'
    }
    if (el.paused) el.play().catch(() => {})
  } catch { /* no audio element support: nothing to do */ }
}

/** Start on the first tap (browsers only allow sound after one). */
export function initIosAudio() {
  if (typeof window === 'undefined') return
  wanted = true
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, start, { passive: true })
}

/** Background (pause) / foreground (resume) from Lagos Life. */
export function holdIosAudio(on) {
  wanted = !on
  if (on) el?.pause()
  else start()
}
