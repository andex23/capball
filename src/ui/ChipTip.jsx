/**
 * A one-time tip about chip shots: most players never find the double-tap.
 * Shown (at most twice, ever) on your turn when one of your caps is close
 * enough to the ball to chip it, in the half you attack. Gone for good once
 * you've chipped. Never blocks play.
 */
import { useEffect, useState } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { getBodies } from '../physics/PhysicsWorld'
import { chipError } from '../game/chip'
import { teamHomeDir } from '../game/rules'
import { isTutorialDone } from '../game/tutorial'
import { getSaveStorage as storage } from '../utils/playerSave'

export const CHIP_TIP_KEY = 'capball.chipTip'
const MAX_SHOWS = 2
const SHOW_MS = 6000

const read = () => { try { return JSON.parse(storage()?.getItem(CHIP_TIP_KEY) || 'null') || { shown: 0, chipped: false } } catch { return { shown: 0, chipped: false } } }
const write = (v) => { try { storage()?.setItem(CHIP_TIP_KEY, JSON.stringify(v)) } catch { /* blocked */ } }

/** Could a human cap chip right now? (Your turn, a cap near the ball, in the half you attack.) */
export function chipChance(s, bodies) {
  if (s.phase !== PHASE.SELECT || s.paused || s.training) return false
  if (s.gameMode === 'ai' && s.activeTeam === s.aiTeam) return false
  if (s.gameMode === 'online' && s.activeTeam !== s.onlineMyTeam) return false
  const ball = bodies?.ball?.position
  if (!ball) return false
  // Well into the half you attack (not a kick-off), where lifting it over someone helps
  if (ball.x * teamHomeDir(s.activeTeam, s.team1Side || 'left') > -4) return false
  return Object.entries(bodies).some(([id, b]) => id.startsWith(`${s.activeTeam}_`) && !chipError(s, id, ball, b.position))
}

export default function ChipTip() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let seen = read()
    // Not on top of the first-match tutorial
    if (seen.chipped || seen.shown >= MAX_SHOWS || !isTutorialDone()) return undefined
    let timer = null
    let shownThisMatch = false
    const unsub = useMatchStore.subscribe((s, prev) => {
      // A chip by a human: the tip has done its job
      const humanChip = s.chipsLeft?.team1 < prev.chipsLeft?.team1 && !(s.gameMode === 'ai' && s.aiTeam === 'team1')
      if (humanChip || (s.chipsLeft?.team2 < prev.chipsLeft?.team2 && s.gameMode !== 'ai')) {
        seen = { ...seen, chipped: true }; write(seen); setShow(false); return
      }
      if (shownThisMatch || seen.chipped || seen.shown >= MAX_SHOWS) return
      if (s.phase === PHASE.SELECT && prev.phase !== PHASE.SELECT && chipChance(s, getBodies())) {
        shownThisMatch = true
        seen = { ...seen, shown: seen.shown + 1 }; write(seen)
        setShow(true)
        clearTimeout(timer)
        timer = setTimeout(() => setShow(false), SHOW_MS)
      }
      if (s.phase !== PHASE.SELECT && s.phase !== PHASE.AIM) setShow(false)
    })
    return () => { unsub(); clearTimeout(timer) }
  }, [])
  if (!show) return null
  return <div className="chip-tip" role="status"><b>Tip:</b> double-tap a cap next to the ball to <b>chip</b> it over defenders.</div>
}
