/**
 * Link previews and search tags. Chat apps and search engines read the HTML
 * without running the game, so these tags live in index.html; invite links
 * (?room=CODE, ?tournament=CODE) get their own title and card from the edge
 * middleware (middleware.js), which swaps the block between the seo markers.
 */
export const SITE = 'https://capball.vercel.app'
export const SEO_START = '<!-- seo:start -->'
export const SEO_END = '<!-- seo:end -->'

export const DEFAULT_META = {
  title: 'CapBall — Tabletop Bottle-Cap Football | Free on Phone & PC',
  description: 'Flick bottle caps to score on a 3D table. Play the computer, a friend on one phone, or online. Career mode, tournaments, a daily challenge and custom kits. Free in your browser.',
  image: '/og/og-default.jpg',
  imageAlt: 'CapBall: red and purple bottle caps on a green tabletop pitch, a shot flying into the goal',
  path: '/',
}

const clean = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)

/** Preview for a shared link's query string, or null for the plain site. */
export function metaFor(params) {
  const room = clean(params.get('room'))
  if (room.length >= 4) {
    return {
      title: `You're invited to a CapBall match (code ${room})`,
      description: 'A friend wants to play bottle-cap football online. Tap to join their table — free, no download, on phone or PC.',
      image: '/og/og-invite.jpg',
      imageAlt: "CapBall: You're invited to a match",
      path: `/?room=${room}`,
      noindex: true,
    }
  }
  const tour = clean(params.get('tournament'))
  if (tour.length >= 4) {
    return {
      title: `Join my CapBall tournament (code ${tour})`,
      description: 'A bottle-cap football league or cup with friends. Pick your team and play every game from your own phone — free, no download.',
      image: '/og/og-tournament.jpg',
      imageAlt: 'CapBall: Join my tournament',
      path: `/?tournament=${tour}`,
      noindex: true,
    }
  }
  return null
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The tags between the seo markers. */
export function metaTags(meta = DEFAULT_META) {
  const url = SITE + meta.path
  const image = SITE + meta.image
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${esc(meta.noindex ? SITE + '/' : url)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="CapBall" />',
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:secure_url" content="${esc(image)}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(meta.imageAlt)}" />`,
    '<meta property="og:locale" content="en_US" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(meta.imageAlt)}" />`,
  ].map((l) => '    ' + l).join('\n')
}

/** Swap the seo block in index.html for this link's tags. */
export function injectMeta(html, meta) {
  const a = html.indexOf(SEO_START)
  const b = html.indexOf(SEO_END)
  if (a < 0 || b < a) return html
  return html.slice(0, a + SEO_START.length) + '\n' + metaTags(meta) + '\n    ' + html.slice(b)
}
