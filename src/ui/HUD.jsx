import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMatchStore, PHASE, SCREEN, isAuthority } from '../state/MatchStore'
import { cycleCameraPreset } from '../scene/camera'
import { formatClock, SHOOTOUT_ROUNDS } from '../game/rules'
import { sendPause, disconnect } from '../multiplayer/MultiplayerManager'
import { stopAllBodies } from '../physics/PhysicsWorld'
import { playButtonSelect, playWhistle } from '../audio/SoundManager'
import Icon from './Icon'
import Modal from './Modal'
import SettingsPanel from './SettingsPanel'
import RulesPanel from './RulesPanel'
import { displayColor } from './color'

const NO_GOAL_TEXT = {
  kickoff_violation: 'You can’t score straight from kick-off',
  gk_violation: 'Goalkeepers can’t score',
}

function ScoreBug() {
  const score = useMatchStore((s) => s.score)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const timeRemaining = useMatchStore((s) => Math.ceil(s.timeRemaining))
  const half = useMatchStore((s) => s.half)
  const shootout = useMatchStore((s) => s.penaltyShootout)
  const pens = useMatchStore((s) => s.penaltyScores)
  const kicks = useMatchStore((s) => s.penaltyKicks)
  const lastScorer = useMatchStore((s) => s.lastScorer)
  const phase = useMatchStore((s) => s.phase)
  const popping = phase === PHASE.GOAL

  const round = Math.min(kicks.team1, kicks.team2) + 1
  const team = (key) => ({ '--team': displayColor(teamConfig[key].primary) })

  return (
    <div className="scorebug" role="group" aria-label="Scoreboard">
      <div className="scorebug-team home" style={team('team1')} data-active={activeTeam === 'team1'}>
        <span>{teamConfig.team1.name}</span><i className="team-dot" />
      </div>
      <div className={`scorebug-score${popping && lastScorer === 'team1' ? ' pop' : ''}`} style={team('team1')} aria-label={`${teamConfig.team1.name} ${score.team1}`}>
        {shootout ? pens.team1 : score.team1}
      </div>
      <div className="scorebug-clock" aria-live="off">
        <b>{shootout ? 'PENS' : formatClock(timeRemaining)}</b>
        <small>{shootout ? (round > SHOOTOUT_ROUNDS ? 'Sudden death' : `Round ${Math.min(round, SHOOTOUT_ROUNDS)}/${SHOOTOUT_ROUNDS}`) : half === 1 ? '1st half' : '2nd half'}</small>
      </div>
      <div className={`scorebug-score${popping && lastScorer === 'team2' ? ' pop' : ''}`} style={team('team2')} aria-label={`${teamConfig.team2.name} ${score.team2}`}>
        {shootout ? pens.team2 : score.team2}
      </div>
      <div className="scorebug-team" style={team('team2')} data-active={activeTeam === 'team2'}>
        <i className="team-dot" /><span>{teamConfig.team2.name}</span>
      </div>
    </div>
  )
}

function useTurnText() {
  const s = useMatchStore(useShallow((st) => ({
    phase: st.phase, activeTeam: st.activeTeam, teamConfig: st.teamConfig, gameMode: st.gameMode,
    aiTeam: st.aiTeam, onlineMyTeam: st.onlineMyTeam, freeKickCapId: st.freeKickCapId,
    foulData: st.foulData, penaltyShootout: st.penaltyShootout,
  })))
  const name = s.teamConfig[s.activeTeam]?.name || 'Team'
  const isCpu = s.gameMode === 'ai' && s.activeTeam === s.aiTeam
  const isOpp = s.gameMode === 'online' && s.activeTeam !== s.onlineMyTeam
  const who = isCpu ? 'CPU' : isOpp ? name : s.gameMode === 'online' || s.gameMode === 'ai' ? 'Your' : `${name}’s`
  switch (s.phase) {
    case PHASE.SELECT:
      if (isCpu) return 'CPU is thinking…'
      if (isOpp) return `${name} to play`
      if (s.freeKickCapId) return `${who === 'Your' ? 'Your' : who} kick — drag the highlighted cap`
      return `${who} turn — drag back from a cap to flick`
    case PHASE.AIM:
      return isCpu ? 'CPU is lining up…' : isOpp ? `${name} is aiming…` : 'Release to flick'
    case PHASE.RESOLVE: return 'Waiting for everything to stop…'
    default: return null
  }
}

function Banner() {
  const phase = useMatchStore((s) => s.phase)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const lastScorer = useMatchStore((s) => s.lastScorer)
  const foulData = useMatchStore((s) => s.foulData)
  const noGoalReason = useMatchStore((s) => s.noGoalReason)
  const half = useMatchStore((s) => s.half)
  const shootout = useMatchStore((s) => s.penaltyShootout)
  const kicks = useMatchStore((s) => s.penaltyKicks)

  const nameOf = (t) => teamConfig[t]?.name || ''
  const colorOf = (t) => (t ? displayColor(teamConfig[t].primary) : undefined)
  let b
  switch (phase) {
    case PHASE.KICKOFF:
      b = shootout
        ? { title: kicks.team1 + kicks.team2 === 0 ? 'Penalties' : 'Next kick', sub: `${nameOf(activeTeam)} to shoot`, team: activeTeam }
        : { title: 'Kick off', sub: `${half === 2 ? 'Second half · ' : ''}${nameOf(activeTeam)} to start`, team: activeTeam }
      break
    case PHASE.GOAL: b = { title: 'Goal!', tone: 'gold', sub: `${nameOf(lastScorer)} score${shootout ? ' the penalty' : ''}`, team: lastScorer }; break
    case PHASE.MISSED: b = { title: 'Saved!', sub: `${nameOf(activeTeam)} miss the penalty` }; break
    case PHASE.NO_GOAL: b = { title: 'No goal', tone: 'bad', sub: NO_GOAL_TEXT[noGoalReason] || 'Doesn’t count' }; break
    case PHASE.FOUL: b = { title: 'Foul!', tone: 'bad', sub: foulData?.inPenaltyBox ? 'Penalty kick' : 'Free kick', team: foulData?.fouledTeam }; break
    case PHASE.FREE_KICK_SETUP: b = { title: 'Free kick', sub: `${nameOf(activeTeam)} · the wall is set`, team: activeTeam }; break
    case PHASE.PENALTY_SETUP: b = { title: 'Penalty', sub: `${nameOf(activeTeam)} step up`, team: activeTeam }; break
    case PHASE.MATCH_OVER: b = { title: shootout ? 'Shootout over' : 'Full time' }; break
    default: return null
  }
  return (
    <div className="banner" key={phase} role="status" style={{ '--team': colorOf(b.team) }}>
      <div className="banner-stripe" />
      <div className={`display banner-title ${b.tone || ''}`}>{b.title}</div>
      {b.sub && <div className="banner-sub">{b.sub}</div>}
    </div>
  )
}

function PowerMeter() {
  const power = useMatchStore((s) => s.dragPower)
  if (power <= 0) return null
  return (
    <div className="power" aria-hidden>
      <div className="power-track"><div className="power-fill" style={{ height: `${power * 100}%` }} /></div>
      <b>{Math.round(power * 100)}</b>
    </div>
  )
}

function PauseMenu({ onClose }) {
  const [view, setView] = useState('main')
  const gameMode = useMatchStore((s) => s.gameMode)
  const authority = useMatchStore((s) => isAuthority(s))
  const shootout = useMatchStore((s) => s.penaltyShootout)

  const restart = () => {
    playButtonSelect()
    playWhistle()
    stopAllBodies()
    const s = useMatchStore.getState()
    if (shootout) s.startPenaltyShootout()
    else s.startGame()
  }

  const quit = () => {
    playButtonSelect()
    stopAllBodies()
    if (gameMode === 'online') disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
  }

  if (view === 'settings') return <Modal title="Sound" onClose={() => setView('main')}><SettingsPanel /></Modal>
  if (view === 'rules') return <Modal title="How to play" onClose={() => setView('main')}><RulesPanel /></Modal>

  return (
    <Modal title="Paused" onClose={onClose}>
      <button className="btn btn-primary btn-lg btn-block" onClick={onClose}><Icon name="play" size={18} /> Resume</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => { playButtonSelect(); setView('settings') }}><Icon name="volume" size={18} /> Sound</button>
        <button className="btn btn-secondary" onClick={() => { playButtonSelect(); setView('rules') }}><Icon name="help" size={18} /> Rules</button>
      </div>
      {authority && gameMode !== 'online' && (
        <button className="btn btn-secondary btn-block" onClick={restart}><Icon name="restart" size={18} /> Restart {shootout ? 'shootout' : 'match'}</button>
      )}
      <button className="btn btn-danger btn-block" onClick={quit}><Icon name="exit" size={18} /> {gameMode === 'online' ? 'Leave match' : 'Quit to menu'}</button>
    </Modal>
  )
}

export default function HUD() {
  const phase = useMatchStore((s) => s.phase)
  const paused = useMatchStore((s) => s.paused)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const authority = useMatchStore((s) => isAuthority(s))
  const connectionLost = useMatchStore((s) => s.gameMode === 'online' && s.onlineStatus.status === 'disconnected')
  const turnText = useTurnText()
  const [camLabel, setCamLabel] = useState(null)
  const camTimer = useRef(null)

  const setPaused = (value) => {
    playButtonSelect()
    if (authority) useMatchStore.getState().setPaused(value)
    else sendPause(value) // the host decides; its state comes back via sync
  }

  // Esc / P toggles pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'p' && e.key !== 'P' && e.key !== 'Escape') return
      if (e.key === 'Escape' && useMatchStore.getState().paused) return // the modal handles Esc
      const s = useMatchStore.getState()
      if (s.phase === PHASE.MATCH_OVER) return
      if (isAuthority(s)) s.setPaused(!s.paused)
      else sendPause(!s.paused)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Switching tabs/apps pauses the match instead of leaving it running unseen
  useEffect(() => {
    const onHide = () => {
      const s = useMatchStore.getState()
      if (document.hidden && isAuthority(s) && s.phase !== PHASE.MATCH_OVER) s.setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  const cycleCamera = () => {
    playButtonSelect()
    setCamLabel(cycleCameraPreset())
    clearTimeout(camTimer.current)
    camTimer.current = setTimeout(() => setCamLabel(null), 1200)
  }
  useEffect(() => () => clearTimeout(camTimer.current), [])

  return (
    <div className="hud">
      <div className="hud-top">
        <ScoreBug />
        {turnText && !paused && (
          <div className="turn-pill" style={{ '--team': displayColor(teamConfig[activeTeam].primary) }} aria-live="polite">
            <i className="team-dot" /> {turnText}
          </div>
        )}
      </div>

      <div className="hud-corner tl">
        <button className="icon-btn" onClick={() => setPaused(true)} aria-label="Pause" disabled={phase === PHASE.MATCH_OVER}>
          <Icon name="pause" size={18} />
        </button>
      </div>

      <div className="hud-corner br">
        {camLabel && <span className="chip" style={{ cursor: 'default', background: 'var(--surface)' }}>{camLabel}</span>}
        <button className="icon-btn" onClick={cycleCamera} aria-label="Change camera view"><Icon name="camera" size={20} /></button>
      </div>

      <PowerMeter />
      {!paused && <Banner />}

      <div className="hint">Drag back from a cap to aim · Right-drag to rotate · Scroll to zoom · P to pause</div>

      {paused && !connectionLost && <PauseMenu onClose={() => setPaused(false)} />}
    </div>
  )
}
