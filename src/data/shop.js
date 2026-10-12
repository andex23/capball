/**
 * Caps for sale inside Lagos Life. Lagos Life sells them (₦100–₦50,000 per
 * item; the game keeps 70%), so prices here are only for showing; the real
 * price comes from the products set up in the Lagos Life dashboard, and the
 * product IDs below must match those exactly.
 *
 * Caps are looks only: no cap ever plays differently.
 */
import { RARE_DESIGNS } from './TeamOptions'
import { BANDS } from './bands'

/** Rare caps: still earned for free, or bought to skip the wait. */
export const RARE_PRICES = { silver: 100, wall: 100, lucky: 200, boot: 200, cup: 300, gold: 300, royal: 500 }

/** Lagos Life exclusives: only bought, never earned. */
export const SHOP_DESIGNS = [
  { key: 'danfo', name: 'Yellow Fever', primary: '#FFC400', edge: '#111111', pattern: 'stripe', badge: 'bolt', finish: 'gloss', capText: 'DANFO', price: 300 },
  { key: 'jollof', name: 'Party Jollof', primary: '#D84315', edge: '#FFD54F', pattern: 'ring', badge: 'flame', finish: 'satin', capText: 'PARTY JOLLOF', price: 300 },
  { key: 'ankara', name: 'Owambe', primary: '#E65100', edge: '#00897B', pattern: 'dots', badge: 'diamond', finish: 'gloss', capText: 'OWAMBE', price: 400 },
  { key: 'eko', name: 'Third Mainland', primary: '#1A0B3B', edge: '#FF2E88', pattern: 'rays', badge: 'star', finish: 'chrome', capText: '3RD MAINLAND', price: 400 },
  { key: 'naija', name: 'Oga at the Top', primary: '#008751', edge: '#FFFFFF', pattern: 'split', badge: 'crown', finish: 'chrome', capText: 'OGA', price: 500 },
]

export const productIdFor = (designKey) => `cap_${designKey}`

/** Everything for sale: { productId, design, price, earnable }. */
export const SHOP_ITEMS = [
  ...RARE_DESIGNS.filter((d) => RARE_PRICES[d.key]).map((d) => ({ productId: productIdFor(d.key), design: d, price: RARE_PRICES[d.key], earnable: true })),
  ...SHOP_DESIGNS.map((d) => ({ productId: productIdFor(d.key), design: d, price: d.price, earnable: false })),
]

/** Rubber bands for single players: every band that isn't free. */
export const bandProductId = (bandKey) => `band_${bandKey}`
export const BAND_ITEMS = BANDS.filter((b) => b.price).map((b) => ({ productId: bandProductId(b.key), band: b, price: b.price, earnable: !b.shopOnly }))

export const PRODUCT_IDS = new Set([...SHOP_ITEMS, ...BAND_ITEMS].map((i) => i.productId))
export const isProduct = (id) => typeof id === 'string' && PRODUCT_IDS.has(id)
export const itemFor = (designKey) => SHOP_ITEMS.find((i) => i.design.key === designKey) || null

export const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`
