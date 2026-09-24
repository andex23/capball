import { useMatchStore } from '../state/MatchStore'

// Vibration patterns (ms on / off / on …) for phones that support it.
const PATTERNS = {
  flick: 18,
  cushion: 8,
  goal: [70, 50, 70, 50, 220],
  foul: [45, 70, 45],
}

/** Can this device vibrate? (Most Android browsers; not iOS Safari or desktops.) */
export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Buzz the phone for a game moment, if the player has vibration on. */
export function haptic(kind) {
  if (!canVibrate() || !useMatchStore.getState().vibration) return
  try {
    navigator.vibrate(PATTERNS[kind] ?? 10)
  } catch {
    // Some browsers throw when vibration isn't allowed yet (no user gesture)
  }
}
