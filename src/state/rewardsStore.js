/**
 * Daily rewards and weekly goals for signed-in players, kept on the phone
 * and with their account. Money goes into the career budget; with no
 * career yet it waits in the bank and is paid in when one starts.
 */
import { getSaveStorage as storage } from '../utils/playerSave'
import { create } from 'zustand'
import { platformHooks } from '../platformHooks'
import { claimDaily, dailyStatus, noteWeek, weekCap, nextMysteryCap, weekKey, WEEK_BONUS, CUP_CAPS, weekendCap } from '../game/rewards'
import { CUP_PRIZE } from '../game/weeklyCup'
import { TOP_PRIZE, RUN_PRIZE, PRIZE_PLACES } from '../game/weekendRules'
import { money } from '../game/squad'
import { dayKey, SPECIAL_BONUS } from '../game/daily'
import { useCareerStore } from './careerStore'
import { isSignedIn, useAccountStore } from './accountStore'

export const REWARDS_KEY = 'capball:rewards:v1'
const EMPTY = { daily: null, week: null, caps: [], bank: 0, scouts: 0, news: [], cups: [], kingmakerUntil: 0 }

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
    // Weekly Cups won: { key (week), name, date }
    // Weekend League champion: holds the Kingmaker until then (ms)
    kingmakerUntil: Number.isFinite(r.kingmakerUntil) ? r.kingmakerUntil : 0,
    cups: Array.isArray(r.cups) ? r.cups.filter((c) => c && typeof c.key === 'string' && typeof c.name === 'string').slice(0, 200).map((c) => ({ key: c.key.slice(0, 10), name: c.name.slice(0, 24), id: typeof c.id === 'string' ? c.id.slice(0, 40) : null, date: String(c.date || '').slice(0, 10) })) : [],
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
    const { daily, week, caps, bank, scouts, news, cups, kingmakerUntil } = get()
    try { storage()?.setItem(REWARDS_KEY, JSON.stringify({ daily, week, caps, bank, scouts, news, cups, kingmakerUntil })) } catch { /* blocked */ }
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
    platformHooks.onDailyClaim?.(today)
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

  /** You won this week's cup: the prize money and the cup's cap, once a week. */
  winCup(weekly, now = new Date()) {
    if (!isSignedIn() || !weekly?.key || get().cups.some((c) => c.key === weekly.key)) return false
    const cap = CUP_CAPS.find((c) => c.name === weekly.name)
    const today = dayKey(now)
    let s = { ...get(), cups: [{ key: weekly.key, name: weekly.name, id: weekly.id || null, date: today }, ...get().cups].slice(0, 200) }
    if (cap && !s.caps.includes(cap.key)) s.caps = [...s.caps, cap.key]
    s = pay(CUP_PRIZE, s)
    s.news = [{ id: `cup:${weekly.key}`, title: `You won the ${weekly.name}!`, text: `+${money(CUP_PRIZE)} and the ${weekly.name} cap. Pick it in Edit team.`, cap: cap?.key, coins: CUP_PRIZE, date: today }, ...s.news].slice(0, 30)
    get()._save(s)
    return true
  },

  /** Weekend Cup: through all five in a run, ₦100k (the store pays once a run). */
  weekendRun(key, now = new Date()) {
    const today = dayKey(now)
    let s = pay(RUN_PRIZE, { ...get() })
    s.news = [{ id: `wkd-run:${key}:${Date.now()}`, title: 'Weekend Cup: all five played!', text: `+${money(RUN_PRIZE)} into your club budget. Your best run counts on the table.`, coins: RUN_PRIZE, date: today }, ...s.news].slice(0, 30)
    get()._save(s)
    useAccountStore.getState().save()
  },

  /** Weekend Cup, Monday: where you finished (and, top three, that weekend's cap and ₦1m). Once a weekend. */
  weekendResult({ key, rank, players, points }, now = new Date()) {
    const id = `wkd:${key}`
    if (get().news.some((n) => n.id === id)) return false
    const today = dayKey(now)
    let s = { ...get() }
    const top = rank <= PRIZE_PLACES
    const cap = weekendCap(key)
    if (top) {
      if (!s.caps.includes(cap.key)) s.caps = [...s.caps, cap.key]
      s = pay(TOP_PRIZE, s)
    }
    const place = `#${rank} of ${players} with ${points} ${points === 1 ? 'point' : 'points'}`
    s.news = [{
      id,
      title: top ? `Weekend Cup: you finished ${place.split(' with')[0]}!` : 'Weekend Cup: your result',
      text: top ? `+${money(TOP_PRIZE)} and the ${cap.name} cap. Pick it in Edit team.` : `You finished ${place}. The next Weekend Cup starts Friday.`,
      ...(top ? { cap: cap.key, coins: TOP_PRIZE } : {}),
      date: today,
    }, ...s.news].slice(0, 30)
    get()._save(s)
    useAccountStore.getState().save()
    return true
  },

  /**
   * Weekend League, Monday: where you finished, once a weekend. Places stack:
   * the champion also gets the caps for 2nd, 3rd and the top ten. The champion
   * holds the Kingmaker for a week. Prize money goes to the career budget.
   */
  leagueResult({ key, rank, players, pts, caps, money: prize = 0 }, now = new Date()) {
    const id = `league:${key}`
    if (get().news.some((n) => n.id === id)) return false
    let s = { ...get() }
    const fresh = (caps || []).filter((c) => c !== 'kingmaker' && !s.caps.includes(c))
    if (fresh.length) s.caps = [...s.caps, ...fresh]
    if (rank === 1) s.kingmakerUntil = now.getTime() + 7 * 86400000
    if (prize) s = pay(prize, s)
    s.news = [{
      id,
      title: rank === 1 ? 'You won the Weekend League!' : `Weekend League: you finished #${rank}`,
      text: `#${rank} of ${players} with ${pts} points.${rank === 1 ? ' The Kingmaker is yours this week.' : ''}${fresh.length ? ` New caps: ${fresh.length}. Pick them in Edit team.` : ''}${prize ? ` +${money(prize)} into your club budget.` : ''}`,
      ...(fresh[0] ? { cap: fresh[0] } : {}),
      ...(prize ? { coins: prize } : {}),
      date: dayKey(now),
    }, ...s.news].slice(0, 30)
    get()._save(s)
    useAccountStore.getState().save()
    return true
  },

  /** Beat the Sunday Special: its bonus, once that day. */
  sundayBonus(today = dayKey()) {
    const id = `sunday:${today}`
    if (!isSignedIn() || get().news.some((n) => n.id === id)) return false
    let s = pay(SPECIAL_BONUS, { ...get() })
    s.news = [{ id, title: 'Sunday Special beaten!', text: `+${money(SPECIAL_BONUS)} into your club budget.`, coins: SPECIAL_BONUS, date: today }, ...s.news].slice(0, 30)
    get()._save(s)
    return true
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
