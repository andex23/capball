/**
 * The commentator, Weekend League edition: a line at kick-off, after each goal
 * and in the last minute, all about the table. Shown in the match HUD's
 * notice strip; renders nothing itself.
 */
import { useEffect, useRef } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { useLeagueStore } from '../state/leagueStore'

const say = (text) => window.dispatchEvent(new CustomEvent('capball:notice', { detail: { text, ms: 4200 } }))
const nth = (n) => {
  const t = n % 100
  return `${n}${t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}

export default function LeagueCommentary() {
  const playing = useLeagueStore((s) => s.playing)
  const said = useRef({ late: false, goals: 0 })
  useEffect(() => {
    if (!playing) return
    said.current = { late: false, goals: 0 }
    const l = useLeagueStore.getState()
    const mine = useMatchStore.getState().teamConfig.team1.name
    const rank = l.rankFrom // before this match (kick-off already counts it as 3–0 on the server)
    const t = setTimeout(() => say(rank
      ? `Weekend League, match ${playing.index + 1} of 15. ${mine} are ${nth(rank)}. Three points on the line against ${playing.club.name}.`
      : `Weekend League, match ${playing.index + 1} of 15. ${mine} against ${playing.club.name}. Every point counts.`), 1200)
    const off = useMatchStore.subscribe((s, prev) => {
      const a = s.score.team1, b = s.score.team2
      if (a + b > prev.score.team1 + prev.score.team2) {
        if (a > prev.score.team1) say(a > b ? (a - b === 1 ? `GOAL! ${mine} lead. That’s three points, as it stands.` : `GOAL! ${mine} pull away. The table is watching.`) : a === b ? `GOAL! ${mine} are level. A point is better than none.` : `GOAL! ${mine} pull one back.`)
        else say(b > a ? `${playing.club.name} score. ${mine} need an answer.` : `${playing.club.name} level it. The points are slipping.`)
      }
      if (!said.current.late && s.half === 2 && s.timeRemaining <= 60 && prev.timeRemaining > 60) {
        said.current.late = true
        say(a > b ? 'One minute left. Hold on and the three points are yours.' : a === b ? 'One minute left. Champions are made in moments like this.' : 'One minute left. Time for something special.')
      }
    })
    return () => { clearTimeout(t); off() }
  }, [playing])
  return null
}
