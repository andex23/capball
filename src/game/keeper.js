/* How sharp each keeper's save reflex is (0..1), and when it's switched on.
   The reflex itself lives in the physics (WorldCore.attachKeeperReflex). */

/** The computer's keeper by difficulty; everyone else's is "medium". */
export const REFLEX_LEVEL = { easy: 0.45, medium: 0.65, hard: 0.85 }
export const DEFAULT_REFLEX = REFLEX_LEVEL.medium

/** A rated keeper (career squads): 0.45 at 50, 0.65 at 70, 0.85 at 90. */
export function reflexForRating(rating) {
  if (!Number.isFinite(rating)) return DEFAULT_REFLEX
  return Math.max(0.35, Math.min(0.9, 0.45 + (rating - 50) * 0.01))
}

/** This team's keeper reflex in this match. */
export function keeperReflex(state, team) {
  const rating = state?.teamConfig?.[team]?.ratings?.gk
  if (Number.isFinite(rating)) return reflexForRating(rating)
  if (state?.gameMode === 'ai' && team === state.aiTeam) return REFLEX_LEVEL[state.aiDifficulty] ?? DEFAULT_REFLEX
  return DEFAULT_REFLEX
}

/** The reflex settings for the live match, or null when keepers shouldn't react on their own (penalties, the daily puzzle). */
export function reflexOptions(state) {
  if (!state || state.penaltyKick || state.penaltyShootout || state.challenge) return null
  return { team1Side: state.team1Side || 'left', reflex: { team1: keeperReflex(state, 'team1'), team2: keeperReflex(state, 'team2') } }
}
