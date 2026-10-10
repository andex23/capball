import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { metaFor, metaTags, injectMeta, DEFAULT_META, SEO_START, SEO_END } from '../seo/meta'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const block = (h) => h.slice(h.indexOf(SEO_START) + SEO_START.length, h.indexOf(SEO_END)).trim()

describe('link previews', () => {
  it('index.html carries the default tags exactly as the generator writes them', () => {
    expect(block(html)).toBe(metaTags(DEFAULT_META).trim())
  })

  it('publishes Counterball branding and the new address in structured data and search discovery', () => {
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
    expect(data.name).toBe('Counterball')
    expect(data.url).toBe('https://counterball.vercel.app/')
    expect(data.image).toBe('https://counterball.vercel.app/og/counterball-default.jpg')
    for (const path of ['robots.txt', 'sitemap.xml']) {
      const content = readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8')
      expect(content).toContain('https://counterball.vercel.app/')
      expect(content).not.toContain('https://capball.vercel.app/')
    }
  })

  it('the plain site has no special preview', () => {
    expect(metaFor(new URLSearchParams(''))).toBeNull()
    expect(metaFor(new URLSearchParams('room=ab'))).toBeNull() // too short to be a code
  })

  it('a match invite gets its own title, card and stays out of search', () => {
    const m = metaFor(new URLSearchParams('room=abc123'))
    expect(m.title).toContain('ABC123')
    expect(m.image).toBe('/og/counterball-invite.jpg')
    const out = injectMeta(html, m)
    expect(out).toContain('og:image" content="https://counterball.vercel.app/og/counterball-invite.jpg"')
    expect(out).toContain('noindex')
    expect(out).toContain('<link rel="canonical" href="https://counterball.vercel.app/" />')
    expect(out).not.toContain('og:image" content="https://counterball.vercel.app/og/counterball-default.jpg"')
    expect(out).toContain('<div id="root">') // the rest of the page is untouched
  })

  it('a tournament link gets the tournament card', () => {
    const m = metaFor(new URLSearchParams('tournament=QWER78'))
    expect(m.image).toBe('/og/counterball-tournament.jpg')
    expect(m.path).toBe('/?tournament=QWER78')
  })

  it('codes cannot inject markup', () => {
    const m = metaFor(new URLSearchParams('room="><script>alert(1)</script>'))
    const out = injectMeta(html, m)
    expect(out).not.toMatch(/<script>alert/)
    expect(m.path).toMatch(/^\/\?room=[A-Z0-9]+$/)
  })
})
