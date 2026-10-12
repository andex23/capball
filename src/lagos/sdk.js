/**
 * Loads the Lagos Life (Vatar Games) SDK. It always comes from Vatar's own
 * address, never a copy, so their security fixes reach the game.
 *
 * In local development only (`npm run dev`, page opened outside a frame with
 * ?mock), a stand-in SDK is used instead so the flow can be tried without keys.
 */
export const SDK_URL = 'https://lagoslife.app/sdk/vatar-games-v1.js'

const looksLikeSdk = (v) => !!v && typeof v.init === 'function' && typeof v.session === 'function'

let loading = null

export function loadSdk({ win = globalThis.window, doc = globalThis.document, timeoutMs = 15000 } = {}) {
  if (looksLikeSdk(win?.Vatar)) return Promise.resolve(win.Vatar)
  if (loading) return loading
  if (import.meta.env?.DEV && win?.self === win?.top && new URLSearchParams(win.location.search).has('mock')) {
    loading = import('./mockSdk.js').then((m) => (win.Vatar = m.createMockSdk()))
    return loading
  }
  loading = new Promise((resolve, reject) => {
    const script = doc.createElement('script')
    script.src = SDK_URL
    script.async = true
    const fail = () => { loading = null; reject(Object.assign(new Error('Could not load Lagos Life.'), { code: 'sdk_load' })) }
    const timer = setTimeout(fail, timeoutMs)
    script.onload = () => { clearTimeout(timer); if (looksLikeSdk(win.Vatar)) resolve(win.Vatar); else fail() }
    script.onerror = () => { clearTimeout(timer); fail() }
    doc.head.appendChild(script)
  })
  return loading
}

/** A plain sentence for an SDK error. */
export function sdkMessage(error) {
  switch (error?.code) {
    case 'not_framed': return 'Open Counterball from the Games app in Lagos Life.'
    case 'signed_out': return 'Go back to Lagos Life and sign in, then open the game again.'
    case 'timeout': return 'Lagos Life took too long to answer. Try again.'
    case 'rate_limited': return 'Too many tries. Wait a moment and try again.'
    case 'not_available': return 'Friend matches aren’t switched on for this game yet.'
    case 'not_multiplayer': return 'Friend matches aren’t switched on for this game yet.'
    case 'not_found': return 'No match with that code. Check it and try again.'
    case 'not_open': return 'That match has already started or closed.'
    case 'limit': return 'You’ve reached today’s match limit.'
    case 'busy': return 'Lagos Life is busy with something else. Try again.'
    case 'cancelled': return 'Cancelled.'
    case 'sdk_load': return 'Couldn’t reach Lagos Life. Check your connection and try again.'
    default: return 'Something went wrong with Lagos Life. Try again.'
  }
}
