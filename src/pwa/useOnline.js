import { useSyncExternalStore } from 'react'

function subscribe(cb) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** Live `navigator.onLine` (false means definitely offline; true can still mean a bad network). */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true)
}
