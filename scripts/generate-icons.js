/**
 * Renders the CAPBALL app icons (gold bottle cap on navy) to public/icons/.
 *
 *   node scripts/generate-icons.js
 *
 * Needs Playwright's Chromium: uses a local `playwright` install if there is one,
 * otherwise the module at $PLAYWRIGHT_MODULE (default: the global Node 22 install).
 * The output is committed, so this only needs re-running when the artwork changes.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url))
const NAVY = '#060913'

// shape: 'rounded' (transparent corners, for purpose "any"), 'square' (full bleed)
// capRatio: cap radius as a fraction of the icon size. Maskable icons keep the cap
// inside the 80% safe circle (radius 0.4) so launchers can crop to any shape.
const ICONS = [
  { file: 'icon-192.png', size: 192, shape: 'rounded', capRatio: 0.4 },
  { file: 'icon-512.png', size: 512, shape: 'rounded', capRatio: 0.4 },
  { file: 'icon-maskable-512.png', size: 512, shape: 'square', capRatio: 0.32 },
  { file: 'apple-touch-icon.png', size: 180, shape: 'square', capRatio: 0.37 },
]

const f = (n) => Number(n.toFixed(2))

/** Crown-cap skirt: a circle with rounded flutes around the edge. */
function crimpPath(cx, cy, R, flutes = 21, depth = 0.075) {
  const inner = R * (1 - depth)
  const step = (Math.PI * 2) / flutes
  const pt = (a, r) => `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`
  let d = `M ${pt(-Math.PI / 2, inner)}`
  for (let i = 0; i < flutes; i++) {
    const a0 = -Math.PI / 2 + i * step
    // bulge out to the full radius between two valleys
    d += ` Q ${pt(a0 + step * 0.25, R * 1.02)} ${pt(a0 + step * 0.5, R)}`
    d += ` Q ${pt(a0 + step * 0.75, R * 1.02)} ${pt(a0 + step, inner)}`
  }
  return d + ' Z'
}

export function iconSvg({ size, shape, capRatio }) {
  const c = size / 2
  const R = size * capRatio
  const bg = shape === 'rounded'
    ? `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="${NAVY}"/>`
    : `<rect width="${size}" height="${size}" fill="${NAVY}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="flood" cx="50%" cy="0%" r="85%">
      <stop offset="0" stop-color="#5a78ff" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#5a78ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="turf" cx="50%" cy="110%" r="70%">
      <stop offset="0" stop-color="#34d27b" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#34d27b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="skirt" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#fff0b8"/>
      <stop offset="0.35" stop-color="#ffc83d"/>
      <stop offset="1" stop-color="#b87800"/>
    </linearGradient>
    <radialGradient id="face" cx="40%" cy="32%" r="75%">
      <stop offset="0" stop-color="#ffe9a0"/>
      <stop offset="0.55" stop-color="#ffc83d"/>
      <stop offset="1" stop-color="#d99400"/>
    </radialGradient>
    <radialGradient id="well" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#121a33"/>
      <stop offset="1" stop-color="${NAVY}"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${f(size * 0.025)}"/>
    </filter>
  </defs>
  ${bg}
  ${shape === 'rounded'
    ? `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="url(#flood)"/><rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="url(#turf)"/>`
    : `<rect width="${size}" height="${size}" fill="url(#flood)"/><rect width="${size}" height="${size}" fill="url(#turf)"/>`}
  <circle cx="${c}" cy="${f(c + R * 0.1)}" r="${f(R)}" fill="#000" opacity="0.55" filter="url(#shadow)"/>
  <path d="${crimpPath(c, c, R)}" fill="url(#skirt)" stroke="#7a5200" stroke-width="${f(size * 0.006)}" stroke-linejoin="round"/>
  <circle cx="${c}" cy="${c}" r="${f(R * 0.8)}" fill="url(#face)" stroke="#a86f00" stroke-width="${f(size * 0.008)}"/>
  <circle cx="${c}" cy="${c}" r="${f(R * 0.57)}" fill="url(#well)" stroke="#7a5200" stroke-width="${f(size * 0.01)}"/>
  <circle cx="${c}" cy="${c}" r="${f(R * 0.29)}" fill="url(#face)"/>
  <path d="M ${f(c - R * 0.62)} ${f(c - R * 0.34)} A ${f(R * 0.71)} ${f(R * 0.71)} 0 0 1 ${f(c + R * 0.1)} ${f(c - R * 0.7)}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="${f(size * 0.018)}" stroke-linecap="round"/>
</svg>`
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    return import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs')
  }
}

async function main() {
  const { chromium } = await loadPlaywright()
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const icon of ICONS) {
      const svg = iconSvg(icon)
      const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 })
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`)
      await writeFile(OUT + icon.file, await page.screenshot({ omitBackground: true, type: 'png' }))
      await page.close()
      console.log('wrote public/icons/' + icon.file)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
