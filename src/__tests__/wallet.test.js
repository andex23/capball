import { describe, it, expect, beforeEach } from 'vitest'
import { matchEarnings, capped, DAILY_CAP, CAP_PRICES, BAND_PRICES, shortNaira } from '../game/wallet'
import { useWalletStore } from '../state/walletStore'

describe('wallet earnings', () => {
  it('pays for finishing, more for a draw or a win, plus goals', () => {
    expect(matchEarnings({ gf: 0, won: false, drawn: false }).amount).toBe(3000)
    expect(matchEarnings({ gf: 1, drawn: true }).amount).toBe(10000)
    expect(matchEarnings({ gf: 3, won: true }).amount).toBe(26000)
    expect(matchEarnings({ gf: 9, won: true }).amount).toBe(30000) // five goals counted
  })
  it('pays more against a harder computer and half for two on one phone', () => {
    expect(matchEarnings({ gf: 2, won: true, level: 'easy' }).amount).toBe(12000)
    expect(matchEarnings({ gf: 2, won: true, level: 'hard' }).amount).toBe(36000)
    expect(matchEarnings({ gf: 2, won: true, mode: 'local' }).amount).toBe(12000)
    expect(matchEarnings({ gf: 2, won: true, mode: 'online' }).amount).toBe(24000)
  })
  it('stops at the daily limit', () => {
    expect(capped(20000, 0)).toBe(20000)
    expect(capped(20000, DAILY_CAP - 5000)).toBe(5000)
    expect(capped(20000, DAILY_CAP)).toBe(0)
  })
  it('prices caps to take real time', () => {
    expect(CAP_PRICES.silver).toBe(1000000)
    expect(CAP_PRICES.royal).toBe(5000000)
    expect(BAND_PRICES.chrome).toBe(500000)
    expect(BAND_PRICES.solid).toBeUndefined()
    expect(shortNaira(1500000)).toBe('₦1.5m')
    expect(shortNaira(26000)).toBe('₦26k')
  })
})

describe('wallet store', () => {
  beforeEach(() => useWalletStore.setState({ balance: 0, lifetime: 0, caps: [], bands: [], day: { key: '2026-11-25', earned: 0 }, last: null }))
  it('adds each match, counts the day, and starts a new day fresh', () => {
    const d1 = new Date('2026-11-25T10:00:00Z')
    expect(useWalletStore.getState().earn({ gf: 3, won: true }, d1)).toBe(26000)
    useWalletStore.setState({ day: { key: '2026-11-25', earned: DAILY_CAP - 1000 } })
    expect(useWalletStore.getState().earn({ gf: 3, won: true }, d1)).toBe(1000)
    expect(useWalletStore.getState().earn({ gf: 3, won: true }, new Date('2026-11-26T10:00:00Z'))).toBe(26000)
    expect(useWalletStore.getState().balance).toBe(53000)
  })
  it('buys only what you can afford, once', () => {
    useWalletStore.setState({ balance: 1200000 })
    expect(useWalletStore.getState().buy('cap', 'royal')).toBe(false)
    expect(useWalletStore.getState().buy('cap', 'silver')).toBe(true)
    expect(useWalletStore.getState().buy('cap', 'silver')).toBe(false)
    expect(useWalletStore.getState().balance).toBe(200000)
    expect(useWalletStore.getState().caps).toEqual(['silver'])
    expect(useWalletStore.getState().buy('cap', 'nope')).toBe(false)
  })
})
