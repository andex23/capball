import { describe, it, expect } from 'vitest'
import { isMediaRequest, FILE_NAVIGATION, MEDIA_PATHS } from '../pwa/swRoutes'
import {
  isIos, isStandalone, shouldShowIosHint, readHintDismissed, rememberHintDismissed,
  initInstallPrompt, promptInstall, IOS_HINT_KEY,
} from '../pwa/install'

const ORIGIN = 'https://capball.vercel.app'
const u = (s) => new URL(s, ORIGIN)

describe('service worker routes', () => {
  it('runtime-caches only the same-origin menu media', () => {
    for (const p of MEDIA_PATHS) expect(isMediaRequest(u(p), ORIGIN)).toBe(true)
    expect(isMediaRequest(u('/assets/menu-music.mp3?x=1'), ORIGIN)).toBe(true)
    expect(isMediaRequest(u('/assets/index-abc.js'), ORIGIN)).toBe(false)
    expect(isMediaRequest(u('/assets/menu-bg.jpg'), ORIGIN, 'POST')).toBe(false)
  })

  it('never touches cross-origin requests (PeerJS signalling etc.)', () => {
    expect(isMediaRequest(new URL('https://0.peerjs.com/assets/menu-bg.jpg'), ORIGIN)).toBe(false)
    expect(isMediaRequest(new URL('https://evil.example/assets/menu-music.mp3'), ORIGIN)).toBe(false)
  })

  it('serves the app shell for app routes but not for files', () => {
    const isFile = (s) => FILE_NAVIGATION.test(u(s).pathname + u(s).search)
    expect(isFile('/')).toBe(false)
    expect(isFile('/?room=ABC123')).toBe(false)
    expect(isFile('/sw.js')).toBe(true)
    expect(isFile('/icons/icon-512.png')).toBe(true)
    expect(isFile('/manifest.webmanifest')).toBe(true)
  })
})

describe('install prompt', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

  it('detects iOS, including iPadOS posing as a Mac', () => {
    expect(isIos({ userAgent: IPHONE })).toBe(true)
    expect(isIos({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
    expect(isIos({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
    expect(isIos({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false)
  })

  it('shows the iOS hint only in the browser and until dismissed', () => {
    const nav = { userAgent: IPHONE }
    expect(shouldShowIosHint({ nav, standalone: false, dismissed: false })).toBe(true)
    expect(shouldShowIosHint({ nav, standalone: true, dismissed: false })).toBe(false)
    expect(shouldShowIosHint({ nav, standalone: false, dismissed: true })).toBe(false)
    expect(shouldShowIosHint({ nav: { userAgent: ANDROID }, standalone: false, dismissed: false })).toBe(false)
  })

  it('detects running as an installed app', () => {
    const win = (standalone, mode) => ({ navigator: { standalone }, matchMedia: (q) => ({ matches: q === `(display-mode: ${mode})` }) })
    expect(isStandalone(win(true, 'browser'))).toBe(true)
    expect(isStandalone(win(undefined, 'fullscreen'))).toBe(true)
    expect(isStandalone(win(undefined, 'standalone'))).toBe(true)
    expect(isStandalone(win(undefined, 'browser'))).toBe(false)
  })

  it('remembers the dismissal and survives blocked storage', () => {
    const map = new Map()
    const store = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }
    expect(readHintDismissed(store)).toBe(false)
    rememberHintDismissed(store)
    expect(map.get(IOS_HINT_KEY)).toBe('1')
    expect(readHintDismissed(store)).toBe(true)

    const blocked = { getItem: () => { throw new Error('SecurityError') }, setItem: () => { throw new Error('QuotaExceeded') } }
    expect(readHintDismissed(blocked)).toBe(false)
    expect(() => rememberHintDismissed(blocked)).not.toThrow()
    expect(readHintDismissed(null)).toBe(false)
  })

  it('captures beforeinstallprompt once and uses it a single time', async () => {
    const win = new EventTarget()
    initInstallPrompt(win)
    expect(await promptInstall()).toBe(null)

    let prompted = 0
    const evt = new Event('beforeinstallprompt', { cancelable: true })
    evt.prompt = async () => { prompted++ }
    evt.userChoice = Promise.resolve({ outcome: 'accepted' })
    win.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)

    expect(await promptInstall()).toBe('accepted')
    expect(prompted).toBe(1)
    expect(await promptInstall()).toBe(null)
  })
})
