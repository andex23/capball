/**
 * The wallet: money every finished match earns, spent in the shop on caps and
 * rubber bands. Prizes for winning things (cups, the league, weekly goals, the
 * daily reward) go to the career budget instead. Pure.
 */
import { RARE_PRICES, SHOP_DESIGNS } from '../data/shop.js'
import { BANDS } from '../data/bands.js'
import { COLLECTION_PRICES } from './collection.js'

export const WIN = 20000
export const DRAW = 8000
export const PLAYED = 3000 // for finishing, whatever the score
export const PER_GOAL = 2000
export const GOALS_PAID = 5 // goals that earn, a match
export const DAILY_CAP = 300000 // most a day's matches can earn
const LEVEL = { easy: 0.5, medium: 1, hard: 1.5 }

/**
 * What one finished match earns: { amount, parts } (before the daily cap).
 * mode: 'ai' | 'local' | 'online' | ...; level: the computer's, for 'ai'.
 * A match two people shared on one phone earns half (nobody's own match).
 */
export function matchEarnings({ gf = 0, won, drawn, mode = 'ai', level = 'medium' }) {
  const result = won ? WIN : drawn ? DRAW : PLAYED
  const goals = Math.min(Math.max(0, gf | 0), GOALS_PAID) * PER_GOAL
  const scale = mode === 'ai' ? (LEVEL[level] ?? 1) : mode === 'local' ? 0.5 : 1
  const amount = Math.round(((result + goals) * scale) / 500) * 500
  return { amount, parts: { result, goals, scale } }
}

/** Pay what's left of today's allowance: how much actually goes in. */
export const capped = (amount, earnedToday) => Math.max(0, Math.min(amount, DAILY_CAP - (earnedToday || 0)))

/** Shop prices in the wallet: priced to take real playing time. */
export const CAP_PRICES = {
  ...Object.fromEntries(Object.entries(RARE_PRICES).map(([k, p]) => [k, p * 10000])), // ₦1m–₦5m
  ...Object.fromEntries(SHOP_DESIGNS.map((d) => [d.key, d.price * 10000])), // ₦3m–₦5m
  ...COLLECTION_PRICES, // Street ₦1.5m, art editions ₦5m
}
export const BAND_PRICES = Object.fromEntries(BANDS.filter((b) => b.price).map((b) => [b.key, b.price * 4000])) // ₦400k–₦800k

export const walletNaira = (n) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`
/** "₦26k", "₦1.5m": short, for small places. */
export function shortNaira(n) {
  const v = Math.round(Number(n) || 0)
  if (v >= 1e6) return `₦${(Math.round(v / 1e5) / 10).toLocaleString('en-NG')}m`
  if (v >= 1e3) return `₦${Math.round(v / 1e3).toLocaleString('en-NG')}k`
  return `₦${v}`
}
