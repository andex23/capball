// Pure request-routing rules for the service worker (kept separate so they can be unit tested).

/** Large media fetched at runtime and kept cache-first (too big to precache up front). */
export const MEDIA_PATHS = ['/assets/menu-bg.jpg', '/assets/menu-music.mp3']
export const MEDIA_CACHE = 'capball-media-v1'

/** Same-origin GET for one of the runtime-cached media files. Cross-origin is never touched. */
export function isMediaRequest(url, origin, method = 'GET') {
  return method === 'GET' && url.origin === origin && MEDIA_PATHS.includes(url.pathname)
}

/** Navigations to real files (e.g. /sw.js, /icons/x.png) must not get the SPA shell. */
export const FILE_NAVIGATION = /\/[^/?]+\.[^/?]+(\?.*)?$/
