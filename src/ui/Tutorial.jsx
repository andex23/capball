import { useCallback, useEffect, useRef, useState } from 'react'
import { useMatchStore, PHASE } from '../state/MatchStore'
import { getBodies } from '../physics/PhysicsWorld'
import { projectToScreen } from '../scene/camera'
import { PITCH, CAP_RADIUS, GK_RADIUS } from '../data/TeamData'
import { playButtonSelect } from '../audio/SoundManager'
import {
  STEP, VISIBLE_STEPS, startTutorial, tutorialReducer, phaseEvent, shouldAutoStart, isActive,
  attackDir, goalPlacement, stepCopy, isTutorialDone, markTutorialDone, onTutorialRearm, shotClockHoldPatch,
} from '../game/tutorial'

// Coach marks only show while play is live — never over a kick-off/goal/foul banner
const SHOW_PHASES = [PHASE.SELECT, PHASE.AIM, PHASE.RESOLVE]
// Steps that point at something on the pitch; the rest sit docked at the bottom
const ANCHORED = [STEP.PRESS, STEP.GOAL]
const NUMBERED = [STEP.PRESS, STEP.AIM, STEP.FOUL, STEP.GOAL, STEP.READY]
const READY_MS = 4000
const CAP_TOP = 0.3 // roughly the height of a cap's face, in world units
const EDGE = 16 // keep the card this far from the screen edges

/** The cap to point at: the set-piece taker, else the team's cap nearest the ball. */
function pointerCap(team) {
  const s = useMatchStore.getState()
  if (s.freeKickCapId?.startsWith(`${team}_`)) return s.freeKickCapId
  const bodies = getBodies() || {}
  const ball = bodies.ball
  if (!ball) return null
  let best = null
  let bestD = Infinity
  for (const [id, body] of Object.entries(bodies)) {
    if (!id.startsWith(`${team}_`)) continue
    const d = Math.hypot(body.position.x - ball.position.x, body.position.y - ball.position.y)
    if (d < bestD) { best = id; bestD = d }
  }
  return best
}

/** Screen point + ring radius for the current step, or null if it can't be projected. */
function computeAnchor(step, team) {
  if (step === STEP.PRESS) {
    const id = pointerCap(team)
    const body = id && getBodies()?.[id]
    if (!body) return null
    const { x, y } = body.position // physics x,y = world x,z
    const c = projectToScreen(x, CAP_TOP, y)
    if (!c?.onScreen) return null
    const r = id.endsWith('_gk') ? GK_RADIUS : CAP_RADIUS
    const edge = projectToScreen(x + r, CAP_TOP, y)
    const px = edge ? Math.hypot(edge.x - c.x, edge.y - c.y) : 20
    return { x: c.x, y: c.y, r: Math.max(26, px + 12) }
  }
  if (step === STEP.GOAL) {
    const dir = attackDir(team, useMatchStore.getState().team1Side)
    const gx = dir * PITCH.halfW
    const c = projectToScreen(gx, 0, 0)
    const centre = projectToScreen(0, 0, 0)
    if (!c || !centre) return null
    const post = projectToScreen(gx, 0, PITCH.goalWidth / 2)
    const px = post ? Math.hypot(post.x - c.x, post.y - c.y) : 30
    return { x: c.x, y: c.y, r: Math.max(30, px + 8), delta: { dx: c.x - centre.x, dy: c.y - centre.y } }
  }
  return null
}

/** Put the card next to the anchor, inside the screen, without covering it. */
function placeCard(card, a) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = card.offsetWidth
  const h = card.offsetHeight
  const gap = a.r + 14
  const bottomReserve = 72 // bottom corner buttons / hint
  const below = a.y + gap + h <= vh - bottomReserve
  let top = below ? a.y + gap : a.y - gap - h
  let left = a.x - w / 2
  // Near a side edge (a goal in landscape): hug that edge rather than cover midfield,
  // where the player's caps usually are
  if (a.x > vw * 0.7) left = vw - w - EDGE
  else if (a.x < vw * 0.3) left = EDGE
  left = Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - w - EDGE))
  top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - h - bottomReserve))
  card.style.left = `${Math.round(left)}px`
  card.style.top = `${Math.round(top)}px`
}

/**
 * First-match coach marks. Runs once (per device) in a local or vs-CPU match;
 * the match clock and shot clock are held while a coach mark is on screen
 * (store.tutorialHold).
 */
export default function Tutorial() {
  const [tut, setTut] = useState(null)
  const tutRef = useRef(null)
  const phase = useMatchStore((s) => s.phase)
  const paused = useMatchStore((s) => s.paused)
  const activeTeam = useMatchStore((s) => s.activeTeam)
  const [where, setWhere] = useState(null)
  const [anchored, setAnchored] = useState(false)
  const cardRef = useRef(null)
  const ringRef = useRef(null)
  const primaryRef = useRef(null)

  const update = useCallback((next) => {
    if (next === tutRef.current) return
    tutRef.current = next
    setTut(next)
    if (next?.step === STEP.DONE) markTutorialDone()
  }, [])
  const dispatch = useCallback((event) => update(tutorialReducer(tutRef.current, event)), [update])

  // Start when the player's turn comes up; follow the match through store changes
  useEffect(() => {
    const tryStart = () => {
      if (isActive(tutRef.current)) return
      const s = useMatchStore.getState()
      if (shouldAutoStart(s, isTutorialDone())) update(startTutorial(s.activeTeam))
    }
    tryStart()
    const unsubStore = useMatchStore.subscribe((s, prev) => {
      if (s.matchKey !== prev.matchKey) {
        // Restarted match — begin again from the kick-off if it wasn't finished
        if (isActive(tutRef.current)) update(null)
        tryStart()
        return
      }
      if (s.phase === prev.phase && s.activeTeam === prev.activeTeam) return
      const cur = tutRef.current
      if (isActive(cur)) {
        const ev = phaseEvent(prev, s, cur.team)
        if (ev) dispatch(ev)
      } else {
        tryStart()
      }
    })
    const unsubRearm = onTutorialRearm(() => { update(null); tryStart() })
    return () => { unsubStore(); unsubRearm() }
  }, [update, dispatch])

  const active = isActive(tut)
  const step = tut?.step
  const playerTurnStep = step === STEP.PRESS || step === STEP.AIM
  const shown = active && VISIBLE_STEPS.includes(step) && !paused && SHOW_PHASES.includes(phase)
    && (!playerTurnStep || activeTeam === tut.team)
  const wantsAnchor = shown && ANCHORED.includes(step)

  // While a coach mark waits for the player, the match clock and shot clock stand still
  useEffect(() => {
    useMatchStore.getState().setTutorialHold(shown)
  }, [shown])
  useEffect(() => {
    const topUp = (s) => {
      const patch = shotClockHoldPatch(s)
      if (patch) useMatchStore.setState(patch)
    }
    topUp(useMatchStore.getState())
    const unsub = useMatchStore.subscribe(topUp)
    return () => { unsub(); useMatchStore.getState().setTutorialHold(false) }
  }, [])

  // "You're ready" clears itself
  useEffect(() => {
    if (!shown || step !== STEP.READY) return
    const id = setTimeout(() => dispatch({ type: 'timeout' }), READY_MS)
    return () => clearTimeout(id)
  }, [shown, step, dispatch])

  // Follow the real projected cap / goal every frame (camera moves, screen rotates)
  useEffect(() => {
    const undock = () => {
      // Docked cards are placed by CSS; drop any position left from anchoring
      if (cardRef.current) cardRef.current.style.left = cardRef.current.style.top = ''
    }
    if (!wantsAnchor) { setAnchored(false); undock(); return }
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const a = computeAnchor(step, tut.team)
      setAnchored(!!a)
      if (step === STEP.GOAL) {
        setWhere(goalPlacement(a?.delta, attackDir(tut.team, useMatchStore.getState().team1Side)))
      }
      if (!a) { undock(); return }
      const ring = ringRef.current
      if (ring) {
        ring.style.transform = `translate(${a.x - a.r}px, ${a.y - a.r}px)`
        ring.style.width = ring.style.height = `${a.r * 2}px`
      }
      if (cardRef.current) placeCard(cardRef.current, a)
    }
    tick()
    return () => { cancelAnimationFrame(raf); undock() }
  }, [wantsAnchor, step, tut?.team])

  // Keyboard users land on the coach mark's main button
  useEffect(() => {
    if (shown) primaryRef.current?.focus({ preventScroll: true })
  }, [shown, step])

  // The live region stays mounted so screen readers announce each new coach mark
  if (!shown) return <div className="tut" aria-live="polite" />

  const copy = stepCopy(step, { goalWhere: where || goalPlacement(null, attackDir(tut.team, useMatchStore.getState().team1Side)) })
  const last = step === STEP.READY
  const n = NUMBERED.indexOf(step) + 1
  const next = () => { playButtonSelect(); dispatch({ type: 'next' }) }
  const skip = () => { playButtonSelect(); dispatch({ type: 'skip' }) }
  const isAnchored = wantsAnchor && anchored

  return (
    <div className="tut" aria-live="polite">
      {isAnchored && <div className="tut-ring" ref={ringRef} aria-hidden />}
      <div
        className="card tut-card"
        ref={cardRef}
        data-anchored={isAnchored}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tut-title"
        aria-describedby="tut-body"
      >
        <div className="eyebrow tut-eyebrow">Tutorial · {n} of {NUMBERED.length}</div>
        <h2 id="tut-title" className="display tut-title">{copy.title}</h2>
        <p id="tut-body" className="tut-body">{copy.body}</p>
        <div className="tut-actions">
          {!last && <button className="btn btn-ghost tut-skip" onClick={skip}>Skip tutorial</button>}
          <button className="btn btn-primary tut-next" ref={primaryRef} onClick={next}>{last ? 'Let’s play' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
