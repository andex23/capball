/**
 * The Weekend League: who can enter. Pure.
 *
 * Fifteen wins (against the computer or friends) to enter. Before it opens,
 * players who qualify sign up with the club they'll play the whole weekend with.
 */
export const LEAGUE_ENTRY = 15

/** Can a player with this many wins enter? */
export const qualifies = (wins) => Number.isFinite(wins) && wins >= LEAGUE_ENTRY

/** How many more wins they need (0 once in). */
export const winsToGo = (wins) => Math.max(0, LEAGUE_ENTRY - (Number.isFinite(wins) ? Math.floor(wins) : 0))

/** When the first Weekend League opens: Friday 27 November, 4:30pm in Lagos (UTC+1). */
export const LEAGUE_OPENS = Date.parse('2026-11-27T15:30:00Z')

/** Time to go, split up for a countdown: { days, hours, mins, secs }, all 0 once it's open. */
export function untilOpen(now = Date.now(), opens = LEAGUE_OPENS) {
  const s = Math.max(0, Math.floor((opens - now) / 1000))
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60, open: s === 0 }
}

/** "1d 10h", "10h 32m", "32m" — short, for the menu. */
export function opensIn(now = Date.now(), opens = LEAGUE_OPENS) {
  const t = untilOpen(now, opens)
  if (t.open) return 'now'
  return t.days ? `${t.days}d ${t.hours}h` : t.hours ? `${t.hours}h ${t.mins}m` : `${Math.max(1, t.mins)}m`
}
