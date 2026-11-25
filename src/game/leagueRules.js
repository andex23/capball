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
