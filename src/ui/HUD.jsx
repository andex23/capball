import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMatchStore, PHASE, SCREEN, INPUT_PHASES, isAuthority } from '../state/MatchStore'
import { useTournamentStore } from '../state/tournamentStore'
import { cycleCameraPreset } from '../scene/camera'
import { formatClock, otherTeam, SHOOTOUT_ROUNDS } from '../game/rules'
import { sendPause, disconnect } from '../multiplayer/MultiplayerManager'
import { onlineInterrupted } from '../multiplayer/reconnect'
import { stopAllBodies } from '../physics/PhysicsWorld'
import { playButtonSelect, playWhistle, playShotClockTick, playShotClockBuzzer, playCrowdGroan, playCrowdMurmur } from '../audio/SoundManager'
import Icon from './Icon'
import MatchScoreboard from './MatchScoreboard'
import CameraStick from './CameraStick'
import Modal from './Modal'
import SettingsPanel from './SettingsPanel'
import RulesPanel from './RulesPanel'
import { displayColor, inkOn } from './color'
import { canFullscreen, toggleFullscreen, typing } from './fullscreen'
import { goalLine, line } from '../game/commentary'
import { decisionText } from '../game/replay'
import { isCoached, markCoached, COACH_FLICKS } from '../game/tutorial'
import { STADIUMS } from '../data/StadiumData'
import CapPreview from './CapPreview'
import { cantSaveReason, saveCurrentMatch } from '../state/savedMatch'
import KeeperPick, { PenaltyTip } from './KeeperPick'
import ChallengeHud from './ChallengeHud'
import { playDaily } from '../state/dailyStore'

const NO_GOAL_TEXT = {
  kickoff_violation: 'You can’t score straight from kick-off',
  goal_kick_violation: 'You can’t score directly from a goal kick',
  bank_shot: 'The ball went in off the pitch edge — goal kick',
}

// The shot clock ran out on this turn (a timed-out shootout kick shows as MISSED)
const timedOut = (s) => s.shotClock > 0 && s.shotClockRemaining <= 0 && (s.phase === PHASE.TIMEOUT || s.phase === PHASE.MISSED)

function ScoreBug() {
  const score = useMatchStore((s) => s.score)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const timeRemaining = useMatchStore((s) => Math.ceil(s.timeRemaining))
  const half = useMatchStore((s) => s.half)
  const goalTarget = useMatchStore((s) => s.goalTarget)
  const shootout = useMatchStore((s) => s.penaltyShootout)
  const pens = useMatchStore((s) => s.penaltyScores)
  const kicks = useMatchStore((s) => s.penaltyKicks)
  const lastScorer = useMatchStore((s) => s.lastScorer)
  const phase = useMatchStore((s) => s.phase)
  const gameMode = useMatchStore((s) => s.gameMode)
  const onlineMyTeam = useMatchStore((s) => s.onlineMyTeam)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const round = Math.min(kicks.team1, kicks.team2) + 1
  const clock = shootout ? 'PENALTIES' : goalTarget ? `FIRST TO ${goalTarget}` : formatClock(timeRemaining)
  const detail = phase === PHASE.MATCH_OVER ? 'FULL TIME' : shootout
    ? round > SHOOTOUT_ROUNDS ? 'SUDDEN DEATH' : `ROUND ${round}/${SHOOTOUT_ROUNDS}`
    : goalTarget ? 'VS' : half === 1 ? '1ST HALF' : '2ND HALF'
  return <MatchScoreboard teams={teamConfig} score={shootout ? pens : score}
    active={phase === PHASE.MATCH_OVER ? null : activeTeam}
    myTeam={gameMode === 'online' ? onlineMyTeam : gameMode === 'ai' ? otherTeam(aiTeam) : null}
    label={clock} detail={detail} popping={phase === PHASE.GOAL ? lastScorer : null}
    rail={<span>{gameMode === 'online' ? 'LIVE ONLINE' : gameMode === 'ai' ? 'VS CPU' : 'LOCAL MATCH'}</span>} />

}

function useTurnText() {
  const s = useMatchStore(useShallow((st) => ({
    phase: st.phase, activeTeam: st.activeTeam, teamConfig: st.teamConfig, gameMode: st.gameMode,
    aiTeam: st.aiTeam, onlineMyTeam: st.onlineMyTeam, freeKickCapId: st.freeKickCapId,
    foulData: st.foulData, penaltyShootout: st.penaltyShootout, challenge: st.challenge,
  })))
  const name = s.teamConfig[s.activeTeam]?.name || 'Team'
  const isCpu = s.gameMode === 'ai' && s.activeTeam === s.aiTeam
  const isOpp = s.gameMode === 'online' && s.activeTeam !== s.onlineMyTeam
  const who = isCpu ? 'CPU' : isOpp ? name : s.gameMode === 'online' || s.gameMode === 'ai' ? 'Your' : `${name}’s`
  if (s.challenge && [PHASE.SELECT, PHASE.AIM, PHASE.RESOLVE].includes(s.phase)) {
    return s.phase === PHASE.RESOLVE ? 'Waiting for everything to stop…' : `${s.challenge.flicksLeft} flick${s.challenge.flicksLeft === 1 ? '' : 's'} left — score!`
  }
  switch (s.phase) {
    case PHASE.SELECT:
      if (isCpu) return 'CPU is thinking…'
      if (isOpp) return `${name} to play`
      if (s.freeKickCapId) return `${who === 'Your' ? 'Your' : who} kick — drag the highlighted cap`
      return isCoached() ? `${who} turn` : `${who} turn — ${s.swipeAim ? 'swipe' : 'drag back'} from a cap to flick`
    case PHASE.AIM:
      return isCpu ? 'CPU is lining up…' : isOpp ? `${name} is aiming…` : 'Release to flick'
    case PHASE.RESOLVE: return 'Waiting for everything to stop…'
    case PHASE.KEEPER_PICK: return 'Penalty — the keeper is picking a side…'
    default: return null
  }
}

/** Seconds left to flick, inside the turn pill. Ticks through the last three. */
function ShotClock() {
  const secs = useMatchStore((s) => Math.ceil(s.shotClockRemaining))
  const live = useMatchStore((s) => s.shotClock > 0 && !s.challenge && !s.paused && INPUT_PHASES.includes(s.phase))
  useEffect(() => {
    if (live && secs > 0 && secs <= 3) playShotClockTick()
  }, [secs, live])
  if (!live) return null
  return (
    // Hidden from screen readers: the pill is a live region and would announce every second
    <span className={`shot-clock${secs <= 5 ? ' urgent' : ''}`} aria-hidden>{secs}s</span>
  )
}

/** The scorer's moment: a big GOAL!, their cap, number and name, the new score and a line of commentary. */
function GoalMoment({ c }) {
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const score = useMatchStore((s) => s.score)
  const pens = useMatchStore((s) => s.penaltyScores)
  const shootout = useMatchStore((s) => s.penaltyShootout)
  const p = c.player
  const kit = p ? teamConfig[p.team] : teamConfig[c.team]
  const shown = shootout ? pens : score
  const color = displayColor(teamConfig[c.team]?.primary)
  return (
    <div className="goal-moment" role="status" style={{ '--team': color, '--team-ink': inkOn(teamConfig[c.team]?.primary) }}>
      <div className="goal-moment-burst" aria-hidden />
      <div className="goal-moment-word" data-own={c.own ? 'true' : undefined}>{c.own ? 'OWN GOAL!' : 'GOAL!'}</div>
      <div className="goal-moment-card">
        {kit && <CapPreview config={kit} size={72} number={p?.number ?? null} role={p?.role || 'atk1'} />}
        <div className="goal-moment-who">
          {p ? (
            <>
              <b className="goal-moment-name">{p.number != null && <span className="goal-moment-num">{p.number}</span>}{p.name}</b>
              <small>{kit?.name}{c.own ? ' · own goal' : shootout ? ' · penalty' : ''}</small>
            </>
          ) : <b className="goal-moment-name">{teamConfig[c.team]?.name}</b>}
        </div>
        <div className="goal-moment-score" aria-label={`${teamConfig.team1.name} ${shown.team1}, ${teamConfig.team2.name} ${shown.team2}`}>
          <span style={{ '--t': displayColor(teamConfig.team1.primary) }}>{shown.team1}</span>
          <i>–</i>
          <span style={{ '--t': displayColor(teamConfig.team2.primary) }}>{shown.team2}</span>
        </div>
      </div>
      <p className="goal-moment-line">{c.line}</p>
    </div>
  )
}

function Banner() {
  const s = useMatchStore()
  const { phase, activeTeam, teamConfig, lastGoalOwn, lastScorer, foulData, noGoalReason, restart, half, penaltyKicks: kicks, freeKickCapId, matchKey, goalLog = [], score, stadium } = s
  const shootout = s.penaltyShootout
  const timeUp = timedOut(s)
  const nameOf = (t) => teamConfig[t]?.name || ''
  const colorOf = (t) => (t ? displayColor(teamConfig[t].primary) : undefined)
  // One seed per moment, so a line stays put while it's on screen
  const seed = `${matchKey}:${phase}:${goalLog.length}:${kicks.team1 + kicks.team2}:${s.stats?.team1?.fouls || 0}:${s.stats?.team2?.fouls || 0}`
  const ctx = { teamConfig, team: activeTeam, seed, venue: STADIUMS[stadium]?.name?.toLowerCase(), score }
  let b
  switch (phase) {
    case PHASE.KICKOFF: {
      if (shootout) {
        b = { title: kicks.team1 + kicks.team2 === 0 ? 'Penalties' : 'Next kick', sub: line(kicks.team1 + kicks.team2 === 0 ? 'shootout' : 'nextKick', ctx), team: activeTeam }
        break
      }
      const halfStart = s.timeRemaining >= Math.floor(s.matchDuration / 2) - 0.01 && !s.goalTarget
      const kind = half === 2 && halfStart ? 'secondHalf' : score.team1 + score.team2 > 0 && s.lastConceded === activeTeam ? 'restartAfterGoal' : 'kickoff'
      b = { title: half === 2 && halfStart ? 'Second half' : 'Kick off', sub: line(kind, ctx), team: activeTeam }
      break
    }
    case PHASE.GOAL: {
      const own = lastGoalOwn && !shootout
      const late = !shootout && !s.goalTarget && half === 2 && s.timeRemaining <= 20
      const winner = !shootout && !!s.goalTarget && score[lastScorer] >= s.goalTarget
      const g = goalLine({ teamConfig, scorerTeam: lastScorer, cap: s.lastGoalCap, own, shootout, score, goalLog, late, winner, seed })
      return <GoalMoment c={{ ...g, own, team: lastScorer }} />
    }
    case PHASE.MISSED: b = timeUp
      ? { title: 'Time’s up', tone: 'bad', sub: line('penTimeUp', ctx) }
      : { title: 'Saved!', sub: line('saved', { ...ctx, cap: s.lastKicker }) }; break
    case PHASE.TIMEOUT: b = {
      title: 'Time’s up',
      tone: 'bad',
      sub: freeKickCapId ? `${nameOf(activeTeam)} lose the ${foulData?.inPenaltyBox ? 'penalty' : 'free kick'}` : line('timeout', ctx),
      team: otherTeam(activeTeam),
    }; break
    case PHASE.NO_GOAL: b = { title: 'No goal', tone: 'bad', sub: NO_GOAL_TEXT[noGoalReason] || 'Doesn’t count' }; break
    case PHASE.FOUL: b = { title: foulData?.inPenaltyBox ? 'Penalty!' : 'Foul!', tone: 'bad', sub: line(foulData?.inPenaltyBox ? 'foulBox' : 'foul', { ...ctx, team: foulData?.fouledTeam, cap: foulData?.byCap }), team: foulData?.fouledTeam }; break
    case PHASE.FREE_KICK_SETUP: b = { title: 'Free kick', sub: line('freeKick', ctx), team: activeTeam }; break
    case PHASE.CORNER_SETUP: b = { title: 'Corner', sub: line('corner', ctx), team: activeTeam }; break
    case PHASE.GOAL_KICK_SETUP: b = restart?.reason === 'bank'
      ? { title: 'No goal', tone: 'bad', sub: line('bank', ctx), team: activeTeam }
      : { title: 'Goal kick', sub: line('goalKick', ctx), team: activeTeam }; break
    case PHASE.PENALTY_SETUP: b = { title: 'Penalty', sub: line('penalty', ctx), team: activeTeam }; break
    case PHASE.MATCH_OVER: {
      const r = s.matchResult
      if (shootout) { b = { title: 'Shootout over', sub: r?.winner ? line('shootoutOver', { ...ctx, winner: r.winner }) : '' }; break }
      const w = score.team1 === score.team2 ? null : score.team1 > score.team2 ? 'team1' : 'team2'
      b = { title: 'Full time', sub: line(w ? 'fullTimeWin' : 'fullTimeDraw', { ...ctx, winner: w }), team: w || undefined }
      break
    }
    default: return null
  }
  return <BannerView b={b} phase={phase} colorOf={colorOf} />
}

function BannerView({ b, phase, colorOf }) {
  return (
    <div className="banner" key={phase} role="status" style={{ '--team': colorOf(b.team) }}>
      <div className="banner-stripe" />
      <div className={`display banner-title ${b.tone || ''}`}>{b.title}</div>
      {b.sub && <div className="banner-sub">{b.sub}</div>}
    </div>
  )
}

const SHOT_TITLES = { post: 'Off the post!', wide: 'Just wide!', save: 'Saved!', block: 'Blocked!' }

/** A quick call when a shot nearly goes in, with a line of commentary. */
function ShotCall() {
  const call = useMatchStore((s) => s.shotCall)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const matchKey = useMatchStore((s) => s.matchKey)
  const [shown, setShown] = useState(null)
  useEffect(() => {
    if (!call) return undefined
    setShown(call)
    if (call.type === 'post' || call.type === 'wide') playCrowdGroan()
    else playCrowdMurmur()
    const id = setTimeout(() => setShown(null), 2200)
    return () => clearTimeout(id)
  }, [call])
  useEffect(() => { setShown(null) }, [matchKey])
  const phase = useMatchStore((s) => s.phase)
  if (!shown || phase === PHASE.GOAL) return null
  const team = shown.cap?.split('_')[0]
  const keeperTeam = shown.by?.split('_')[0]
  const tone = shown.type === 'save' || shown.type === 'block' ? keeperTeam : team
  const text = line(shown.type, { teamConfig, team, cap: shown.cap, by: shown.by, seed: `${matchKey}:${shown.key}` })
  return (
    <div className="shot-call" key={shown.key} data-type={shown.type} role="status" style={{ '--team': displayColor(teamConfig[tone]?.primary || '#ffd23f') }}>
      <b className="shot-call-title">{SHOT_TITLES[shown.type]}</b>
      <span className="shot-call-line">{text}</span>
    </div>
  )
}

/** Broadcast-style letterbox + badge while a goal replay plays. */
function ReplayOverlay() {
  const replaying = useMatchStore((s) => s.replaying)
  const paused = useMatchStore((s) => s.paused)
  const decision = useMatchStore((s) => s.replayDecision)
  if (!replaying || paused) return null
  const explanation = decisionText(decision)
  return (
    <div className="replay" aria-live="polite">
      <div className="replay-bar top" />
      <div className="replay-decision" data-outcome={decision?.outcome || 'goal'}>
        <strong>{explanation.title}</strong>
        <p>{explanation.detail}</p>
      </div>
      <div className="replay-bar bottom">
        <div className="replay-badge"><i aria-hidden /> Replay <span>Tap or Space to skip</span></div>
      </div>
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
    if (s.challenge) playDaily()
    else if (shootout) s.startPenaltyShootout()
    else s.startGame()
  }

  const quit = () => {
    playButtonSelect()
    stopAllBodies()
    // A tournament fixture abandoned mid-match: back to the hub, nothing recorded
    if (useTournamentStore.getState().playing) { useTournamentStore.getState().backToHub(); return }
    if (gameMode === 'online') disconnect()
    useMatchStore.getState().quitMatch(SCREEN.MENU)
  }

  // Save the match to carry on later (one save slot), then leave
  const saveBlock = gameMode === 'online' ? 'online' : cantSaveReason()
  const saveAndQuit = () => {
    if (!saveCurrentMatch()) return
    playButtonSelect()
    stopAllBodies()
    if (useTournamentStore.getState().playing) { useTournamentStore.getState().backToHub(); return }
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
        <button className="btn btn-orange btn-block" onClick={restart}><Icon name="restart" size={18} /> Restart {shootout ? 'shootout' : 'match'}</button>
      )}
      {saveBlock !== 'online' && (
        <>
          <button className="btn btn-gold btn-block" onClick={saveAndQuit} disabled={!!saveBlock}><Icon name="check" size={18} /> Save &amp; quit</button>
          <p className="muted" style={{ margin: '-4px 0 0', fontSize: 12.5, textAlign: 'center' }}>
            {saveBlock || 'Carry on later from the menu, or on another phone when you’re signed in.'}
          </p>
        </>
      )}
      <button className="btn btn-danger btn-block" onClick={quit}><Icon name="exit" size={18} /> {gameMode === 'online' ? 'Leave match' : 'Quit to menu'}</button>
    </Modal>
  )
}

export default function HUD() {
  const phase = useMatchStore((s) => s.phase)
  const aimHint = useMatchStore((s) => (s.swipeAim ? 'Swipe' : 'Drag back'))
  // The how-to-flick hints go once the player has the hang of it
  const [coached, setCoached] = useState(isCoached)
  useEffect(() => {
    if (coached) return undefined
    let flicks = 0
    return useMatchStore.subscribe((st, prev) => {
      const human = st.gameMode !== 'ai' || prev.activeTeam !== st.aiTeam
      if (prev.phase === PHASE.AIM && st.phase === PHASE.RESOLVE && human) flicks += 1
      if (flicks >= COACH_FLICKS || st.phase === PHASE.MATCH_OVER) { markCoached(); setCoached(true) }
    })
  }, [coached])
  const paused = useMatchStore((s) => s.paused)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const authority = useMatchStore((s) => isAuthority(s))
  // Dropped / reconnecting online: the connection overlay replaces the pause menu
  const connectionLost = useMatchStore(onlineInterrupted)
  const turnText = useTurnText()
  const timeUp = useMatchStore(timedOut)
  const [camLabel, setCamLabel] = useState(null)
  const camTimer = useRef(null)
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)

  // Short explanations from the input layer ("your keeper can't play from there")
  useEffect(() => {
    const onNotice = (e) => {
      setNotice(e.detail)
      clearTimeout(noticeTimer.current)
      noticeTimer.current = setTimeout(() => setNotice(null), 2200)
    }
    window.addEventListener('capball:notice', onNotice)
    return () => { window.removeEventListener('capball:notice', onNotice); clearTimeout(noticeTimer.current) }
  }, [])

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
      if (s.phase === PHASE.MATCH_OVER || onlineInterrupted(s)) return
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
  const cycleCameraRef = useRef(cycleCamera)
  cycleCameraRef.current = cycleCamera
  useEffect(() => () => clearTimeout(camTimer.current), [])

  // C changes the camera (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e)) cycleCameraRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [isFull, setIsFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  useEffect(() => { if (timeUp) playShotClockBuzzer() }, [timeUp])

  return (
    <div className="hud">
      <ReplayOverlay />
      <div className="hud-top">
        <ScoreBug />
        {turnText && !paused && (
          <div className="turn-pill" style={{ '--team': displayColor(teamConfig[activeTeam].primary) }} aria-live="polite">
            <i className="team-dot" /> {turnText}
            <ShotClock />
          </div>
        )}
      </div>

      <div className="hud-corner tr">
        <button className="icon-btn" onClick={() => setPaused(true)} aria-label="Pause" disabled={phase === PHASE.MATCH_OVER}>
          <Icon name="menu" size={18} />
        </button>
      </div>

      <div className="hud-corner br">
        {camLabel && <span className="chip" style={{ cursor: 'default', background: 'var(--surface)' }}>{camLabel}</span>}
        <CameraStick />
        {canFullscreen() && (
          <button className="icon-btn desktop-only" onClick={() => { playButtonSelect(); toggleFullscreen() }} aria-label={isFull ? 'Leave full screen' : 'Full screen'} title={isFull ? 'Leave full screen (F)' : 'Full screen (F)'}>
            <Icon name="fullscreen" size={20} />
          </button>
        )}
        <button className="icon-btn" onClick={cycleCamera} aria-label="Change camera view" title="Change camera (C)"><Icon name="camera" size={20} /></button>
      </div>

      {notice && !paused && <div className="hud-notice" role="status">{notice}</div>}

      <PowerMeter />
      {!paused && <Banner />}
      {!paused && <ShotCall />}
      <KeeperPick />
      <ChallengeHud />
      {!paused && <PenaltyTip />}

      {!coached && <div className="hint">
        <span className="hint-mouse">{aimHint} from a cap to aim · Drag the pitch to turn · Scroll to zoom · C camera · F full screen · P pause</span>
        <span className="hint-touch">{aimHint} from a cap to aim · Drag the pitch or the stick to turn the view · Pinch to zoom</span>
      </div>}

      {paused && !connectionLost && <PauseMenu onClose={() => setPaused(false)} />}
    </div>
  )
}
