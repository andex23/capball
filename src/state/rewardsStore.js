/**
 * Daily rewards and weekly goals for signed-in players, kept on the phone
 * and with their account. Money goes into the career budget; with no
 * career yet it waits in the bank and is paid in when one starts.
 */
import { create } from 'zustand'
import { claimDaily, dailyStatus, noteWeek, weekCap, nextMysteryCap, weekKey, WEEK_BONUS } from '../game/rewards'
import { money } from '../game/squad'
import { dayKey } from '../game/daily'
import { useCareerStore } from './careerStore'
import { isSignedIn, useAccountStore } from './accountStore'

export const REWARDS_KEY = 'capball:rewards:v1'
const storage = () => { try { return globalThis.localStorage } catch { return null } }
const EMPTY = { daily: null, week: null, caps: [], bank: 0, scouts: 0, news: [] }

function clean(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    daily: r.daily && typeof r.daily === 'object' ? { next: r.daily.next, last: r.daily.last } : null,
    week: r.week && typeof r.week.key === 'string' && r.week.progress && typeof r.week.progress === 'object' ? { key: r.week.key, progress: { ...r.week.progress } } : null,
    caps: Array.isArray(r.caps) ? r.caps.filter((x) => typeof x === 'string').slice(0, 200) : [],
    scouts: Number.isSafeInteger(r.scouts) ? Math.max(0, r.scouts) : 0,
    bank: Number.isFinite(r.bank) && r.bank > 0 ? Math.round(r.bank) : 0,
    // What the bell shows: { id, title, text, date }
    news: Array.isArray(r.news) ? r.news.filter((n) => n && typeof n.id === 'string').slice(0, 30) : [],
  }
}

function load() {
  try { return clean(JSON.parse(storage()?.getItem(REWARDS_KEY) || 'null')) } catch { return { ...EMPTY } }
}

/** Pay money in: to the career if there is one, otherwise to the bank. */
function pay(units, s) {
  if (units <= 0) return s
  if (useCareerStore.getState().career && useCareerStore.getState().addCoins(units)) return s
  return { ...s, bank: s.bank + units }
}

export const useRewardsStore = create((set, get) => ({
  ...load(),

  _save(next) {
    set(next)
    const { daily, week, caps, bank, scouts, news } = get()
    try { storage()?.setItem(REWARDS_KEY, JSON.stringify({ daily, week, caps, bank, scouts, news })) } catch { /* blocked */ }
  },

  /** Today's reward: { day, ready, reward }. */
  status(today = dayKey()) { return dailyStatus(get().daily, today) },

  /**
   * Take today's reward. Returns what you got: { day, coins, fitness, cap } or null
   * (already taken today, or not signed in).
   */
  claim(today = dayKey()) {
    if (!isSignedIn()) return null
    const r = claimDaily(get().daily, today)
    if (!r) return null
    let s = { ...get(), daily: r.daily }
    const got = { day: r.day }
    if (r.reward.fitness && useCareerStore.getState().career) {
      useCareerStore.getState().restSquad()
      got.fitness = true
    } else if (r.reward.cap) {
      const cap = nextMysteryCap(s.caps)
      if (cap) { s = { ...s, caps: [...s.caps, cap.key] }; got.cap = cap }
      got.coins = r.reward.coins
    } else got.coins = r.reward.coins
    if (r.reward.scout) {
      got.scout = true
      if (!useCareerStore.getState().addScoutCredits(1)) s.scouts = (s.scouts || 0) + 1
    }
    if (got.coins) s = pay(got.coins, s)
    get()._save(s)
    useAccountStore.getState().save()
    return got
  },

  /**
   * Count a finished match (or daily challenge) towards this week's goals.
   * m: { won, gf, ga, mode, level, saves, posts }
   */
  noteMatch(m, now = new Date()) {
    if (!isSignedIn()) return
    const key = weekKey(now)
    const { week, finished, allDone } = noteWeek(get().week, key, m)
    let s = { ...get(), week }
    const today = dayKey(now)
    for (const g of finished) {
      s = pay(g.coins, s)
      s.news = [{ id: `goal:${key}:${g.id}`, title: `Weekly goal done: ${g.title}`, text: `+${money(g.coins)} into your club budget.`, coins: g.coins, date: today }, ...s.news].slice(0, 30)
    }
    if (allDone) {
      const cap = weekCap(key)
      if (!s.caps.includes(cap.key)) s.caps = [...s.caps, cap.key]
      s = pay(WEEK_BONUS, s)
      s.news = [{ id: `week:${key}`, title: 'All three weekly goals done!', text: `You’ve won this week’s cap. Pick it in Edit team.`, cap: cap.key, coins: WEEK_BONUS, date: today }, ...s.news].slice(0, 30)
    }
    get()._save(s)
    useAccountStore.getState().save()
  },
}))

// Deliver rewards collected before the player founded a club.
useCareerStore.subscribe((c) => {
  const { bank, scouts, _save } = useRewardsStore.getState()
  if (!c.career || (!bank && !scouts)) return
  _save({ bank: 0, scouts: 0 })
  if (bank && !c.addCoins(bank)) _save({ bank })
  if (scouts && !c.addScoutCredits(scouts)) _save({ scouts })
})
