import { useSyncExternalStore } from 'react'

/*
 * "Install app" support.
 * Chromium fires `beforeinstallprompt` (often before the menu has mounted), so the
 * event is captured once at startup and exposed through a tiny store. iOS Safari has
 * no install API — it gets a dismissible "Add to Home Screen" hint instead.
 */

export const IOS_HINT_KEY = 'capball.iosInstallHint.dismissed'

let deferredPrompt = null
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

/** Call once at startup. */
export function initInstallPrompt(win = window) {
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the mini-infobar
    deferredPrompt = e
    emit()
  })
  win.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })
}

/** True while the browser is offering installation. */
export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false)
}

/** Shows the browser's install dialog. Resolves to 'accepted' | 'dismissed' | null. */
export async function promptInstall() {
  const e = deferredPrompt
  if (!e) return null
  deferredPrompt = null // a prompt event can only be used once
  emit()
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome
  } catch {
    return null
  }
}

/** iPhone/iPad, including iPadOS reporting itself as a Mac. */
export function isIos({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

/** Already running as an installed app? */
export function isStandalone(win = window) {
  if (win.navigator?.standalone === true) return true
  const mq = (q) => win.matchMedia?.(q).matches === true
  return mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)')
}

export function shouldShowIosHint({ nav, standalone, dismissed }) {
  return !standalone && !dismissed && isIos(nav)
}

export function readHintDismissed(storage) {
  try { return storage?.getItem(IOS_HINT_KEY) === '1' } catch { return false }
}

export function rememberHintDismissed(storage) {
  try { storage?.setItem(IOS_HINT_KEY, '1') } catch { /* private mode — just hide it for now */ }
}
