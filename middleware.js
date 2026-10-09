// Vercel Routing Middleware: shared invite links (?room=CODE, ?tournament=CODE)
// get their own link preview. Everything else is served untouched.
import { metaFor, injectMeta } from './src/seo/meta.js'

export const config = { matcher: '/' }

export default async function middleware(request) {
  const url = new URL(request.url)
  const meta = metaFor(url.searchParams)
  if (!meta) return undefined
  try {
    const res = await fetch(new URL('/index.html', url), { headers: { cookie: request.headers.get('cookie') || '' } })
    if (!res.ok) return undefined
    const html = injectMeta(await res.text(), meta)
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
    })
  } catch {
    return undefined
  }
}
