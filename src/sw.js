/* CAPBALL service worker (built by vite-plugin-pwa, injectManifest strategy).
 *
 * - Precaches the app shell plus every built JS/CSS/font chunk — including the lazily
 *   loaded three.js/Scene chunks — so a match works offline after a single visit.
 * - Menu photo + music are cached on first use (cache-first).
 * - Nothing else is intercepted: cross-origin traffic (PeerJS signalling, WebRTC/STUN)
 *   and unknown same-origin requests go straight to the network, uncached.
 * - New versions wait; the page shows an "Update available" toast and posts
 *   SKIP_WAITING when the player chooses to reload.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { createPartialResponse } from 'workbox-range-requests'
import { clientsClaim } from 'workbox-core'
import { MEDIA_CACHE, MEDIA_PATHS, FILE_NAVIGATION, isMediaRequest } from './pwa/swRoutes'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: in-app navigations (including invite links like /?room=ABC123) get the cached shell
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [FILE_NAVIGATION] }))

/**
 * Cache-first for the menu media. <audio> asks for byte ranges and a 206 can't be
 * stored, so fetch the whole file once (no Range header), cache it keyed by URL,
 * and slice ranges out of the cached copy.
 */
async function cachedMedia(url) {
  const cache = await caches.open(MEDIA_CACHE)
  const hit = await cache.match(url)
  if (hit) return hit
  const res = await fetch(url, { credentials: 'same-origin' })
  if (res.status === 200) await cache.put(url, res.clone())
  return res
}

async function mediaHandler({ request }) {
  const res = await cachedMedia(request.url)
  return res.status === 200 && request.headers.has('range') ? createPartialResponse(request, res) : res
}
registerRoute(({ url, request }) => isMediaRequest(url, self.location.origin, request.method), mediaHandler)

// First visit: the page fetched the media before this worker existed, so warm the
// cache now (usually straight from the HTTP cache) — best effort, never blocks.
function warmMedia() {
  for (const path of MEDIA_PATHS) cachedMedia(path).catch(() => {})
}

self.addEventListener('activate', (event) => {
  warmMedia()
  // Drop media caches left by older versions
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k.startsWith('capball-media-') && k !== MEDIA_CACHE).map((k) => caches.delete(k)),
  )))
})

// The very first install has no older version to protect, so take control right
// away (makes the lazy 3D chunks come from the cache even on the first visit).
// Updates never get here early: they wait for SKIP_WAITING or a fresh launch.
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
