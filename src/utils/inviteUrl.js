import { SITE } from '../seo/meta'

// Existing production addresses share rooms; local and preview builds keep their origin.
const PRODUCTION_HOSTS = new Set(['counterball.vercel.app', 'capball.vercel.app', 'capball-drus-projects-68c924fa.vercel.app'])

export function inviteUrl(kind, code, location = window.location) {
  const base = PRODUCTION_HOSTS.has(location.hostname) ? SITE + '/' : location.origin + location.pathname
  const url = new URL(base)
  url.searchParams.set(kind, code)
  return url.href
}
