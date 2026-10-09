/**
 * Leaderboard: post the signed-in player's numbers (this week and all time)
 * and read the top of the board. See supabase/leaderboard.sql.
 */
import { create } from 'zustand'
import { rpc } from '../online/supabase'
import { useAccountStore } from './accountStore'
import { useSavedStore, weekKey } from './savedMatch'

export const useBoardStore = create((set, get) => ({
  rows: {},        // period → rows
  loading: false,
  error: null,

  /** Post my numbers (if signed in), then load the board for `period` ('week' or 'all'). */
  async load(which = 'week') {
    const period = which === 'all' ? 'all' : weekKey()
    set({ loading: true, error: null })
    try {
      await postMine().catch(() => {})
      const rows = await rpc('cb_board_top', { p_period: period, p_limit: 20 })
      set({ rows: { ...get().rows, [period]: Array.isArray(rows) ? rows : [] } })
    } catch (e) {
      set({ error: e.message || 'Couldn’t load the leaderboard.' })
    } finally {
      set({ loading: false })
    }
  },
}))

/** Send this player's week and all-time numbers. Does nothing when signed out. */
export async function postMine() {
  const { token } = useAccountStore.getState()
  if (!token) return
  const c = useSavedStore.getState().career || {}
  const counted = Math.max(0, (c.played || 0) - (c.local || 0))
  const posts = [rpc('cb_board_post', { p_token: token, p_period: 'all', p_played: counted, p_won: c.won || 0, p_goals: c.goalsFor || 0 })]
  if (c.week?.key === weekKey() && c.week.played > 0) {
    posts.push(rpc('cb_board_post', { p_token: token, p_period: c.week.key, p_played: c.week.played, p_won: c.week.won, p_goals: c.week.goals }))
  }
  await Promise.all(posts)
}
