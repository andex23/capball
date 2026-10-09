import { useEffect, useState } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { otherTeam, teamHomeDir } from '../game/rules'
import { PITCH } from '../data/TeamData'
import { projectToScreen } from '../scene/camera'
import { sendKeeperDive } from '../multiplayer/MultiplayerManager'
import { playButtonSelect } from '../audio/SoundManager'
import { displayColor } from './color'

/** Which pitch-y direction is "right" on screen for the goal at goalX: 1 or -1. */
function screenRight(goalX) {
  const a = projectToScreen(goalX, 0, -PITCH.goalWidth / 2)
  const b = projectToScreen(goalX, 0, PITCH.goalWidth / 2)
  if (!a || !b) return 1
  return b.x >= a.x ? 1 : -1
}

/**
 * Before a penalty: the keeper's side secretly picks a dive. The keeper goes
 * that way the instant the kick is taken. On a shared phone the kicker looks
 * away while the keeper picks; online only the keeper's phone shows this.
 */
export default function KeeperPick() {
  const phase = useMatchStore((s) => s.phase)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const gameMode = useMatchStore((s) => s.gameMode)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const team1Side = useMatchStore((s) => s.team1Side)
  const paused = useMatchStore((s) => s.paused)
  const [right, setRight] = useState(1)
  const [sent, setSent] = useState(false)

  const keeperTeam = otherTeam(activeTeam)
  const active = phase === PHASE.KEEPER_PICK && !paused
  const goalX = teamHomeDir(keeperTeam, team1Side || 'left') * PITCH.halfW

  // Work out screen left/right for this goal once the camera has settled
  useEffect(() => {
    if (!active) { setSent(false); return }
    const t = setTimeout(() => setRight(screenRight(goalX)), 250)
    return () => clearTimeout(t)
  }, [active, goalX])

  if (!active) return null
  const keeperName = teamConfig[keeperTeam]?.name || 'Keeper'
  const kickerName = teamConfig[activeTeam]?.name || 'Kicker'
  const mine = gameMode === 'online' ? myTeam === keeperTeam : true

  if (!mine) {
    return (
      <div className="keeper-pick waiting" role="status">
        <b>{keeperName}’s keeper is getting ready…</b>
      </div>
    )
  }

  const pick = (dive) => {
    playButtonSelect()
    if (gameMode === 'online') { sendKeeperDive(dive); setSent(true) } else useMatchStore.getState().pickKeeperDive(dive)
  }

  return (
    <div className="keeper-pick" role="dialog" aria-label="Keeper: pick your dive" style={{ '--team': displayColor(teamConfig[keeperTeam]?.primary) }}>
      <div className="keeper-pick-tab">Keeper</div>
      <p className="keeper-pick-title">{gameMode === 'local' ? `${keeperName}: pick your dive` : 'Pick your dive'}</p>
      {gameMode === 'local' && <p className="keeper-pick-note">{kickerName}, look away!</p>}
      {sent ? (
        <p className="keeper-pick-note">Locked in. Waiting for the kick…</p>
      ) : (
        <div className="keeper-pick-row">
          <button className="btn btn-blue" onClick={() => pick(-right)}>◄ Dive</button>
          <button className="btn btn-secondary" onClick={() => pick(0)}>Stay</button>
          <button className="btn btn-blue" onClick={() => pick(right)}>Dive ►</button>
        </div>
      )}
      <p className="keeper-pick-note">The kicker won’t see your choice. You dive as the ball is struck.</p>
    </div>
  )
}

const TIP_KEY = 'capball.tip.penalty'
const tipSeen = () => { try { return localStorage.getItem(TIP_KEY) === '1' } catch { return true } }

/** First penalty only: how the guessing game works, for the kicker. */
export function PenaltyTip() {
  const phase = useMatchStore((s) => s.phase)
  const penaltyKick = useMatchStore((s) => s.penaltyKick)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const gameMode = useMatchStore((s) => s.gameMode)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const [hidden, setHidden] = useState(tipSeen)
  const myKick = gameMode === 'online' ? myTeam === activeTeam : gameMode === 'ai' ? aiTeam !== activeTeam : true
  if (hidden || !penaltyKick || phase !== PHASE.SELECT || !myKick) return null
  const close = () => {
    try { localStorage.setItem(TIP_KEY, '1') } catch { /* fine */ }
    setHidden(true)
  }
  return (
    <div className="penalty-tip" role="note">
      <b>Penalty!</b>
      <p>The keeper has already picked a side in secret. Aim for a corner to beat a keeper who stays; go down the middle if you think he’ll dive.</p>
      <button className="btn btn-gold" onClick={close}>Got it</button>
    </div>
  )
}
