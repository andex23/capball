/**
 * Daily rewards and weekly goals.
 *
 * Daily: seven rewards in a row, one a day. Missing a day pauses the run
 * (you pick up where you left off); it never resets. After day 7 it starts again.
 *
 * Weekly: three goals each week (Monday to Sunday), the same three for
 * everyone that week. Each pays club money when it's done; all three earn
 * that week's cap.
 *
 * Money is in club units (see squad.js: money()). Pure: the store passes in
 * today's day key and this week's key.
 */

/** ISO week key for a date, e.g. '2026-W47' (weeks start on Monday). */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** The seven daily rewards. */
export const DAILY_REWARDS = [
  { coins: 10 },
  { coins: 15 },
  { coins: 20, scout: true },
  { coins: 25 },
  { coins: 30 },
  { fitness: true, coins: 30 }, // the coins only if there's no career to rest
  { cap: true, coins: 50 },
]

/** Where the daily run stands today: { day (0-6), ready, reward }. */
export function dailyStatus(daily, today) {
  const d = cleanDaily(daily)
  return { day: d.next, ready: d.last !== today, reward: DAILY_REWARDS[d.next] }
}

/** Take today's reward. Returns { daily, reward, day } or null if it's already been taken. */
export function claimDaily(daily, today) {
  const d = cleanDaily(daily)
  if (d.last === today) return null
  const day = d.next
  return { daily: { next: (day + 1) % DAILY_REWARDS.length, last: today }, reward: DAILY_REWARDS[day], day }
}

function cleanDaily(daily) {
  const next = Number.isInteger(daily?.next) && daily.next >= 0 && daily.next < DAILY_REWARDS.length ? daily.next : 0
  return { next, last: typeof daily?.last === 'string' ? daily.last : null }
}

/* ── Weekly goals ── */

// m: { won, gf, ga, mode ('career' | 'tournament' | 'quick' | 'online'), level, saves, posts }
const POOL = {
  easy: [
    { id: 'play5', title: 'Play 5 matches', sub: 'Any mode', need: 5, coins: 25, count: () => 1 },
    { id: 'win3', title: 'Win 3 matches', sub: 'Any mode', need: 3, coins: 30, count: (m) => (m.won ? 1 : 0) },
    { id: 'goals8', title: 'Score 8 goals', sub: 'Any mode', need: 8, coins: 30, count: (m) => m.gf },
  ],
  medium: [
    { id: 'clean2', title: 'Keep 2 clean sheets', sub: 'Don’t concede', need: 2, coins: 40, count: (m) => (m.ga === 0 ? 1 : 0) },
    { id: 'career2', title: 'Win 2 career matches', sub: 'Career mode', need: 2, coins: 40, count: (m) => (m.mode === 'career' && m.won ? 1 : 0) },
    { id: 'saves4', title: 'Make 4 saves', sub: 'With your keeper', need: 4, coins: 40, count: (m) => m.saves || 0 },
    { id: 'daily2', title: 'Beat the daily challenge twice', sub: 'Daily challenge', need: 2, coins: 40, daily: true, count: (m) => (m.won ? 1 : 0) },
  ],
  hard: [
    { id: 'hard1', title: 'Beat the computer on Hard', sub: 'Quick match or career', need: 1, coins: 60, count: (m) => (m.level === 'hard' && m.won ? 1 : 0) },
    { id: 'big1', title: 'Win by 3 goals or more', sub: 'Any mode', need: 1, coins: 50, count: (m) => (m.gf - m.ga >= 3 ? 1 : 0) },
    { id: 'post2', title: 'Hit the post twice', sub: 'Any mode', need: 2, coins: 40, count: (m) => m.posts || 0 },
  ],
}
export const WEEK_BONUS = 50

/** Week number from a key like '2026-W47'. */
const weekNum = (key) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key))
  return m ? Number(m[1]) * 53 + Number(m[2]) : 0
}

/** This week's three goals: one easy, one medium, one hard, picked by the week. */
export function weekGoals(key) {
  const n = weekNum(key)
  return [POOL.easy[n % POOL.easy.length], POOL.medium[(n * 3 + 1) % POOL.medium.length], POOL.hard[(n * 5 + 2) % POOL.hard.length]]
}

/** The week's goals with your progress: [{ ...goal, have, done }]. */
export function weekProgress(week, key) {
  const w = week?.key === key ? week : { key, progress: {} }
  return weekGoals(key).map((g) => {
    const have = Math.min(g.need, Math.max(0, Math.floor(w.progress?.[g.id] || 0)))
    return { ...g, have, done: have >= g.need }
  })
}

/**
 * Count one match (or daily challenge) towards this week's goals.
 * Returns { week, finished: goals just completed, allDone: true the moment the third one finishes }.
 */
export function noteWeek(week, key, m) {
  const before = weekProgress(week, key)
  const progress = { ...(week?.key === key ? week.progress : {}) }
  for (const g of weekGoals(key)) {
    // The daily challenge counts only for its own goal; matches never count for it
    if (!!g.daily !== (m.mode === 'daily')) continue
    progress[g.id] = Math.min(g.need, (progress[g.id] || 0) + Math.max(0, g.count(m) || 0))
  }
  const next = { key, progress }
  const after = weekProgress(next, key)
  const finished = after.filter((g, i) => g.done && !before[i].done)
  const allDone = finished.length > 0 && after.every((g) => g.done)
  return { week: next, finished, allDone }
}

/* ── The caps you can win ── */

/** Day-7 mystery caps, handed out in this order. */
export const MYSTERY_CAPS = [
  { key: 'mystery-sunset', name: 'Sunset', primary: '#E65100', edge: '#FFE0B2', pattern: 'rays', badge: 'star', finish: 'gloss', capText: 'SUNSET' },
  { key: 'mystery-midnight', name: 'Midnight', primary: '#0D1B4C', edge: '#9FB4FF', pattern: 'dots', badge: 'crown', finish: 'chrome', capText: 'MIDNIGHT' },
  { key: 'mystery-jungle', name: 'Jungle', primary: '#1B5E20', edge: '#C6FF00', pattern: 'wave', badge: 'bolt', finish: 'satin', capText: 'JUNGLE' },
  { key: 'mystery-ruby', name: 'Ruby', primary: '#9B0F2E', edge: '#FFD6DE', pattern: 'ring', badge: 'diamond', finish: 'chrome', capText: 'RUBY' },
  { key: 'mystery-ocean', name: 'Ocean', primary: '#006064', edge: '#E0F7FA', pattern: 'wave', badge: 'star', finish: 'gloss', capText: 'OCEAN' },
  { key: 'mystery-volcano', name: 'Volcano', primary: '#3E2723', edge: '#FF6D00', pattern: 'rays', badge: 'flame', finish: 'satin', capText: 'VOLCANO' },
]

/** Weekly caps: one a week, round the year. */
export const WEEK_CAPS = [
  { primary: '#3F1A4E', edge: '#E8B84A', pattern: 'wave', badge: 'bolt' },
  { primary: '#0B3D91', edge: '#FFD23F', pattern: 'stripe', badge: 'star' },
  { primary: '#B71C1C', edge: '#FFFFFF', pattern: 'cross', badge: 'shield' },
  { primary: '#004D40', edge: '#A7FFEB', pattern: 'dots', badge: 'diamond' },
  { primary: '#F9A825', edge: '#3E2723', pattern: 'split', badge: 'crown' },
  { primary: '#263238', edge: '#FF4081', pattern: 'rays', badge: 'skull' },
  { primary: '#1A237E', edge: '#82B1FF', pattern: 'ring', badge: 'star' },
  { primary: '#33691E', edge: '#FFEB3B', pattern: 'wave', badge: 'bolt' },
  { primary: '#4A148C', edge: '#EA80FC', pattern: 'dots', badge: 'crown' },
  { primary: '#BF360C', edge: '#FFCCBC', pattern: 'stripe', badge: 'flame' },
  { primary: '#01579B', edge: '#FFFFFF', pattern: 'split', badge: 'shield' },
  { primary: '#212121', edge: '#FFD700', pattern: 'cross', badge: 'star' },
].map((c, i) => ({ ...c, key: `week-${i + 1}`, name: `Week cap ${i + 1}`, finish: 'chrome', capText: `WEEK ${i + 1}` }))

/** The cap on offer for a week. */
export const weekCap = (key) => WEEK_CAPS[weekNum(key) % WEEK_CAPS.length]

/** The next mystery cap you don't have yet (or null when you have them all). */
export const nextMysteryCap = (owned = []) => MYSTERY_CAPS.find((c) => !owned.includes(c.key)) || null

/* ── The Weekly Cup's names and winners' caps (see weeklyCup.js) ── */
export const WEEKLY_CUPS = [
  { name: 'Area Cup', cap: { primary: '#C9771E', edge: '#FFE0A3', pattern: 'rays', badge: 'crown' } },
  { name: 'Street Cup', cap: { primary: '#0B3D91', edge: '#FFD23F', pattern: 'ring', badge: 'star' } },
  { name: 'Junction Cup', cap: { primary: '#006064', edge: '#B2EBF2', pattern: 'wave', badge: 'crown' } },
  { name: 'Estate Cup', cap: { primary: '#F9A825', edge: '#111111', pattern: 'stripe', badge: 'bolt' } },
  { name: 'Compound Cup', cap: { primary: '#C62828', edge: '#FFB300', pattern: 'dots', badge: 'flame' } },
  { name: 'Bus Stop Cup', cap: { primary: '#4E2A12', edge: '#FF8F00', pattern: 'cross', badge: 'shield' } },
  { name: 'Corner Cup', cap: { primary: '#F5F0E1', edge: '#8D6E63', pattern: 'split', badge: 'crown' } },
  { name: 'Backyard Cup', cap: { primary: '#2E7D32', edge: '#FFFFFF', pattern: 'rays', badge: 'star' } },
]
/** A winner's cap for each cup (hidden in the picker until won). */
export const CUP_CAPS = WEEKLY_CUPS.map((c, i) => ({ ...c.cap, key: `cup-${i + 1}`, name: c.name, finish: 'chrome', capText: c.name.replace(/ Cup$/, '').toUpperCase() }))

