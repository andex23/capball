/**
 * Your wallet: what finished matches have earned, and what you've bought with
 * it. Kept with the player's save (and so in their cloud save). Rules and
 * prices in game/wallet.js.
 */
import { create } from 'zustand'
import { getSaveStorage as storage } from '../utils/playerSave'
import { matchEarnings, capped, CAP_PRICES, BAND_PRICES } from '../game/wallet'

export const WALLET_KEY = 'capball:wallet:v1'
const today = (now = new Date()) => now.toISOString().slice(0, 10)

function load() {
  try {
    const r = JSON.parse(storage()?.getItem(WALLET_KEY) || 'null') || {}
    const str = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 200) : [])
    return {
      balance: Math.max(0, Math.round(Number(r.balance) || 0)),
      lifetime: Math.max(0, Math.round(Number(r.lifetime) || 0)),
      caps: str(r.caps),
      bands: str(r.bands),
      day: typeof r.day?.key === 'string' ? { key: r.day.key, earned: Math.max(0, Number(r.day.earned) || 0) } : { key: today(), earned: 0 },
    }
  } catch { return { balance: 0, lifetime: 0, caps: [], bands: [], day: { key: today(), earned: 0 } } }
}

export const useWalletStore = create((set, get) => ({
  ...load(),
  last: null, // the last match's pay: { amount, full, parts }

  _save() {
    const { balance, lifetime, caps, bands, day } = get()
    try { storage()?.setItem(WALLET_KEY, JSON.stringify({ balance, lifetime, caps, bands, day })) } catch { /* blocked */ }
  },

  /** A match finished: pay into the wallet (up to the day's allowance). */
  earn(match, now = new Date()) {
    const { amount, parts } = matchEarnings(match)
    const day = get().day.key === today(now) ? get().day : { key: today(now), earned: 0 }
    const paid = capped(amount, day.earned)
    set({
      balance: get().balance + paid,
      lifetime: get().lifetime + paid,
      day: { key: day.key, earned: day.earned + paid },
      last: { amount: paid, full: amount, parts, at: now.getTime() },
    })
    get()._save()
    if (paid) globalThis.__counterballCount?.('feature', 'wallet_earn')
    return paid
  },

  ownsCap: (key) => get().caps.includes(key),
  ownsBand: (key) => get().bands.includes(key),

  /** Buy a cap or a band: true if it went through. */
  buy(kind, key) {
    const price = (kind === 'cap' ? CAP_PRICES : BAND_PRICES)[key]
    const list = kind === 'cap' ? 'caps' : 'bands'
    if (!price || get()[list].includes(key) || get().balance < price) return false
    set({ balance: get().balance - price, [list]: [...get()[list], key] })
    get()._save()
    globalThis.__counterballCount?.('shop', `wallet_${key}`.slice(0, 40))
    return true
  },
}))
