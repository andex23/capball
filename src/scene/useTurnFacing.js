import { useEffect } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { teamHomeDir, otherTeam } from '../game/rules'
import { setFacing } from './camera'

/**
 * Which team's end the view should be drawn from, or null to leave the camera
 * as the preset draws it.
 * - Two players on one device: whoever's turn it is (when "turn view" is on)
 * - Against the CPU: the human, the whole match
 * - Online: this device's own team
 */
export function facingTeam(s) {
  if (s.gameMode === 'online' || s.gameMode === 'anytime') return s.onlineMyTeam || null
  if (s.gameMode === 'ai') return otherTeam(s.aiTeam || 'team2')
  if (s.gameMode === 'local') return s.turnView ? s.activeTeam || null : null
  return null
}

/** Keeps the camera turned toward the right player's end through the match. */
export function useTurnFacing() {
  useEffect(() => {
    const homeFor = (s) => {
      const team = facingTeam(s)
      return team ? teamHomeDir(team, s.team1Side || 'left') : null
    }
    // First frame: no swing, just start from the right end
    setFacing(homeFor(useMatchStore.getState()), { animate: false })
    return useMatchStore.subscribe((s, prev) => {
      // A goal replay moves the camera itself and puts it back afterwards
      if (s.replaying) return
      const home = homeFor(s)
      if (home !== homeFor(prev) || prev.replaying) setFacing(home)
    })
  }, [])
}
