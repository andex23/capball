import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { metaFor, metaTags, injectMeta, DEFAULT_META, SEO_START, SEO_END } from '../seo/meta'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const block = (h) => h.slice(h.indexOf(SEO_START) + SEO_START.length, h.indexOf(SEO_END)).trim()

describe('link previews', () => {
  it('index.html carries the default tags exactly as the generator writes them', () => {
    expect(block(html)).toBe(metaTags(DEFAULT_META).trim())
  })

  it('the plain site has no special preview', () => {
    expect(metaFor(new URLSearchParams(''))).toBeNull()
    expect(metaFor(new URLSearchParams('room=ab'))).toBeNull() // too short to be a code
  })

  it('a match invite gets its own title, card and stays out of search', () => {
    const m = metaFor(new URLSearchParams('room=abc123'))
    expect(m.title).toContain('ABC123')
    expect(m.image).toBe('/og/counter-ball-invite.jpg')
    const out = injectMeta(html, m)
    expect(out).toContain('og:image" content="https://capball.vercel.app/og/counter-ball-invite.jpg"')
    expect(out).toContain('noindex')
    expect(out).toContain('<link rel="canonical" href="https://capball.vercel.app/" />')
    expect(out).not.toContain('og:image" content="https://capball.vercel.app/og/counter-ball-default.jpg"')
    expect(out).toContain('<div id="root">') // the rest of the page is untouched
  })

  it('a tournament link gets the tournament card', () => {
    const m = metaFor(new URLSearchParams('tournament=QWER78'))
    expect(m.image).toBe('/og/counter-ball-tournament.jpg')
    expect(m.path).toBe('/?tournament=QWER78')
  })

  it('codes cannot inject markup', () => {
    const m = metaFor(new URLSearchParams('room="><script>alert(1)</script>'))
    const out = injectMeta(html, m)
    expect(out).not.toMatch(/<script>alert/)
    expect(m.path).toMatch(/^\/\?room=[A-Z0-9]+$/)
  })
})
