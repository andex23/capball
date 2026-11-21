/**
 * Counts for our own server: one match started, finished or quit, by what was
 * being played. Extra time and penalties are part of the same match, the daily
 * challenge finishes when it's won or lost, and a match left from the pause
 * menu (or restarted) counts as quit, with roughly how long it lasted.
 */
import { SCREEN, PHASE } from '../state/MatchStore'

/** How long a quit match lasted: '0m' (under a minute), '1m', '3m' or '6m' (six or more). */
export const quitBucket = (ms) => (ms < 60e3 ? '0m' : ms < 180e3 ? '1m' : ms < 360e3 ? '3m' : '6m')

/**
 * @param store   the match store (getState/subscribe)
 * @param count   (event, detail) => void
 * @param kindOf  (state) => 'career' | 'daily' | 'local' | ... (what's being played)
 */
export function watchMatchCounts(store, count, kindOf, now = () => Date.now()) {
  let prev = store.getState()
  let live = null // { kind, at, ended }
  const quit = () => {
    if (live && !live.ended) count('match_quit', `${live.kind}_${quitBucket(now() - live.at)}`)
    live = null
  }
  return store.subscribe((s) => {
    const entered = s.screen === SCREEN.PLAYING && (prev.screen !== SCREEN.PLAYING || s.matchKey !== prev.matchKey)
    if (entered) {
      // Extra time and penalties carry on the match already counted
      // ...and so do the Training Ground's tries (one visit is one count)
      const goesOn = ((s.extraTime || s.penaltyShootout) && live) || (live?.kind === 'training' && kindOf(s) === 'training')
      if (!goesOn) {
        quit()
        live = { kind: kindOf(s), at: now(), ended: false }
        count('match_start', live.kind)
      }
    }
    // The daily challenge is over when it's won or lost
    if (live && !live.ended && s.challenge && s.phase === PHASE.CHALLENGE_DONE) {
      live.ended = true
      count('match_end', live.kind)
    }
    if (s.screen === SCREEN.MATCH_END && prev.screen !== SCREEN.MATCH_END && live && !live.ended) {
      live.ended = true
      count('match_end', live.kind)
    }
    // Left the pitch some other way: back to a menu
    if (prev.screen === SCREEN.PLAYING && s.screen !== SCREEN.PLAYING && s.screen !== SCREEN.MATCH_END) quit()
    // A finished match is done once you leave its result screen (unless extra time or penalties follow)
    if (prev.screen === SCREEN.MATCH_END && s.screen !== SCREEN.MATCH_END && s.screen !== SCREEN.PLAYING) live = null
    prev = s
  })
}
