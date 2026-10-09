// Full screen for desktop browsers (phones use the installed app instead).
export const canFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenEnabled

export function toggleFullscreen() {
  if (!canFullscreen()) return
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
}

/** True when a key press is going into a text field (so game shortcuts should ignore it). */
export const typing = (e) => {
  const t = e.target
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}
