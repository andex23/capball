import { useEffect, useRef, useState } from 'react'
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
 * that way the instant the kick is taken. On a shared phone the phone is
 * handed to the keeper, the dive picked behind a cover, then handed back to
 * the kicker; online only the keeper's phone shows this.
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
  // Two players on one phone: hand over to the keeper, pick, hand back to the kicker
  const [step, setStep] = useState('handTo') // 'handTo' | 'pick' | 'handBack'
  const chosen = useRef(0)

  const keeperTeam = otherTeam(activeTeam)
  const active = phase === PHASE.KEEPER_PICK && !paused
  const goalX = teamHomeDir(keeperTeam, team1Side || 'left') * PITCH.halfW

  // Work out screen left/right for this goal once the camera has settled
  useEffect(() => {
    if (!active) { setSent(false); setStep('handTo'); return }
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

  const shared = gameMode === 'local'
  const pick = (dive) => {
    playButtonSelect()
    if (gameMode === 'online') { sendKeeperDive(dive); setSent(true) }
    else if (shared) { chosen.current = dive; setStep('handBack') }
    else useMatchStore.getState().pickKeeperDive(dive)
  }

  if (shared && step !== 'pick') {
    const toKeeper = step === 'handTo'
    const who = toKeeper ? keeperTeam : activeTeam
    return (
      <div className="pass-phone" role="dialog" aria-label={toKeeper ? `Pass the phone to ${keeperName}` : `Pass the phone back to ${kickerName}`}
        style={{ '--team': displayColor(teamConfig[who]?.primary) }}>
        <div className="pass-phone-card">
          <div className="pass-phone-icon" aria-hidden="true">{toKeeper ? '🧤' : '🔒'}</div>
          <p className="pass-phone-eyebrow">{toKeeper ? 'Penalty' : 'Dive locked in'}</p>
          <h2 className="pass-phone-title">{toKeeper ? `Pass the phone to ${keeperName}` : `Pass the phone back to ${kickerName}`}</h2>
          <p className="pass-phone-note">{toKeeper ? `${kickerName}, no peeking — the keeper picks a side in secret.` : 'The keeper’s choice stays hidden until the ball is struck.'}</p>
          <button className="btn btn-gold btn-lg btn-block" onClick={() => {
            playButtonSelect()
            if (toKeeper) setStep('pick')
            else useMatchStore.getState().pickKeeperDive(chosen.current)
          }}>{toKeeper ? 'I’m the keeper' : 'Ready to shoot'}</button>
        </div>
      </div>
    )
  }

  return (
    <>
    {/* Shared phone: hide the pitch while the keeper picks */}
    {shared && <div className="pass-phone pass-phone-shade" aria-hidden="true" />}
    <div className="keeper-pick" role="dialog" aria-label="Keeper: pick your dive" style={{ '--team': displayColor(teamConfig[keeperTeam]?.primary) }}>
      <div className="keeper-pick-tab">Keeper</div>
      <p className="keeper-pick-title">{gameMode === 'local' ? `${keeperName}: pick your dive` : 'Pick your dive'}</p>
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
    </>
  )
}
