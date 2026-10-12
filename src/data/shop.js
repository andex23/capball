/**
 * Caps for sale inside Lagos Life. Lagos Life sells them (₦100–₦50,000 per
 * item; the game keeps 70%), so prices here are only for showing; the real
 * price comes from the products set up in the Lagos Life dashboard, and the
 * product IDs below must match those exactly.
 *
 * Caps are looks only: no cap ever plays differently.
 */
import { RARE_DESIGNS } from './TeamOptions'

/** Rare caps: still earned for free, or bought to skip the wait. */
export const RARE_PRICES = { silver: 100, wall: 100, lucky: 200, boot: 200, cup: 300, gold: 300, royal: 500 }

/** Lagos Life exclusives: only bought, never earned. */
export const SHOP_DESIGNS = [
  { key: 'danfo', name: 'Danfo', primary: '#FFC400', edge: '#111111', pattern: 'stripe', badge: 'bolt', finish: 'gloss', capText: 'DANFO', price: 300 },
  { key: 'jollof', name: 'Jollof', primary: '#D84315', edge: '#FFD54F', pattern: 'ring', badge: 'flame', finish: 'satin', capText: 'JOLLOF', price: 300 },
  { key: 'ankara', name: 'Ankara', primary: '#E65100', edge: '#00897B', pattern: 'dots', badge: 'diamond', finish: 'gloss', capText: 'ANKARA', price: 400 },
  { key: 'eko', name: 'Eko Nights', primary: '#1A0B3B', edge: '#FF2E88', pattern: 'rays', badge: 'star', finish: 'chrome', capText: 'EKO', price: 400 },
  { key: 'naija', name: 'Naija Green', primary: '#008751', edge: '#FFFFFF', pattern: 'split', badge: 'crown', finish: 'chrome', capText: 'NAIJA', price: 500 },
]

export const productIdFor = (designKey) => `cap_${designKey}`

/** Everything for sale: { productId, design, price, earnable }. */
export const SHOP_ITEMS = [
  ...RARE_DESIGNS.filter((d) => RARE_PRICES[d.key]).map((d) => ({ productId: productIdFor(d.key), design: d, price: RARE_PRICES[d.key], earnable: true })),
  ...SHOP_DESIGNS.map((d) => ({ productId: productIdFor(d.key), design: d, price: d.price, earnable: false })),
]

export const PRODUCT_IDS = new Set(SHOP_ITEMS.map((i) => i.productId))
export const isProduct = (id) => typeof id === 'string' && PRODUCT_IDS.has(id)
export const itemFor = (designKey) => SHOP_ITEMS.find((i) => i.design.key === designKey) || null

export const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`
