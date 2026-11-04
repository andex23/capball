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

// Lagos Life's SDK turns any reply code it doesn't know into a plain "error"
// (not_available, for one). Note the code the host page actually sent, so the
// game can say the real reason. Read-only: it never answers or acts on it.
let lastReply = null
let watching = false
function watchReplies(win) {
  if (watching || !win?.addEventListener) return
  watching = true
  win.addEventListener('message', (e) => {
    const d = e.data
    if (e.source !== win.parent || !d || d.ll !== 1 || d.t !== 'reply' || d.ok) return
    if (typeof d.error === 'string' && /^[a-z_]{1,40}$/.test(d.error)) lastReply = { code: d.error, at: Date.now() }
  })
}

/** The code Lagos Life really sent for a failure just now, when its SDK reported only "error". */
export function realErrorCode(error, now = Date.now()) {
  if (error?.code !== 'error' || !lastReply || now - lastReply.at > 5000) return error?.code || null
  return lastReply.code
}

export function loadSdk({ win = globalThis.window, doc = globalThis.document, timeoutMs = 15000 } = {}) {
  watchReplies(win)
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
    case 'limit': return 'That’s over a betting limit (₦100,000 a match, ₦500,000 a day, 10 bets a day with the same friend). Try a smaller bet or play free.'
    case 'friendly_only': return 'Betting isn’t switched on for Counterball yet. Play free for now.'
    case 'insufficient_funds': return 'You don’t have enough money in Lagos Life for that bet.'
    case 'busy': return 'Lagos Life is busy with something else. Try again.'
    case 'cancelled': return 'Cancelled.'
    case 'sdk_load': return 'Couldn’t reach Lagos Life. Check your connection and try again.'
    case 'off': return 'Counterball is switched off in Lagos Life right now. Try again later.'
    case 'too_soon': return 'Wait a few seconds and try again.'
    case 'bad_request': return 'Lagos Life didn’t understand that request. Update the game (close and reopen it) and try again.'
    case 'payment_failed': return 'The payment didn’t go through. Nothing was taken.'
    case 'not_for_sale': return 'That isn’t on sale yet.'
    case 'owned': return 'You already own that.'
    default: return 'Something went wrong with Lagos Life. Try again.'
  }
}

/**
 * For a match that couldn't start. Lagos Life's SDK turns codes it doesn't
 * know (such as matches not being switched on for this game's reviewed
 * version) into a plain "error", so say what that usually means.
 */
export function matchMessage(error) {
  if (!error?.code || error.code === 'error') {
    return 'Lagos Life couldn’t start a match. Try again in a moment. If it keeps happening, matches aren’t switched on for this version of Counterball yet (Lagos Life turns them on after review).'
  }
  return sdkMessage(error)
}
