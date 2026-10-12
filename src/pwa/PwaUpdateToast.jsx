import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import Icon from '../ui/Icon'

const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Registers the service worker (production builds only — a no-op under `npm run dev`)
 * and tells the player when a new version is waiting. The new version only takes
 * over when they press Reload, or on the next launch; it never interrupts a match.
 */
export default function PwaUpdateToast() {
  const screen = useMatchStore((s) => s.screen)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Installed apps can stay open for days — look for new versions now and then
      if (registration) setInterval(() => { if (navigator.onLine) registration.update().catch(() => {}) }, UPDATE_CHECK_MS)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (screen === SCREEN.PLAYING) return null

  if (needRefresh) {
    return (
      <div className="pwa-toast" role="status">
        <span>Update available</span>
        <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>Reload</button>
        <button className="btn btn-ghost" onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    )
  }
  if (offlineReady) {
    return (
      <div className="pwa-toast" role="status">
        <Icon name="check" size={18} /> <span>Ready to play offline</span>
      </div>
    )
  }
  return null
}
