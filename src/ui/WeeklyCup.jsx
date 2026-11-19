/**
 * The Weekly Cup on screen: the poster on the Tournaments page (one tap to
 * enter), the draw when it starts, and the road to the final (how hard each
 * round is).
 */
import { useEffect, useState } from 'react'
import { useTournamentStore } from '../state/tournamentStore'
import { useMatchStore } from '../state/MatchStore'
import { useRewardsStore } from '../state/rewardsStore'
import { weeklyCup, cupTeams, CUP_LEVELS, CUP_PRIZE } from '../game/weeklyCup'
import { weekKey } from '../game/rewards'
import { money } from '../game/squad'
import { roundName, teamById } from '../game/tournament'
import { playConfirm, playButtonSelect, playHoverTick } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const daysLeft = () => 7 - ((new Date().getDay() + 6) % 7)

/** On the Tournaments page: this week's cup. `onReplace` asks first when another tournament is going. */
export function WeeklyCupPoster({ onReplace }) {
  const local = useTournamentStore((s) => s.local)
  const won = useRewardsStore((s) => s.cups)
  const myKit = useMatchStore((s) => s.teamConfig.team1)
  const key = weekKey()
  const cup = weeklyCup(key)
  const teams = cupTeams(cup, myKit)
  const mineGoing = local?.weekly?.key === key && !local.championId
  const otherGoing = local && !local.championId && local?.weekly?.key !== key
  const wonIt = won.some((c) => c.key === key)
  const enter = () => {
    if (otherGoing) { onReplace(); return }
    playConfirm()
    if (mineGoing) useTournamentStore.getState().openHub('local')
    else useTournamentStore.getState().startWeeklyCup()
  }
  const left = daysLeft()
  return (
    <section className="wc-poster" aria-label={`Weekly Cup: ${cup.name}`}>
      <div className="wc-tab">Weekly Cup</div>
      <div className="wc-head">
        <div>
          <small>{left === 1 ? 'Last day' : `${left} days left`} · new cup every Monday</small>
          <h2>{cup.name}</h2>
        </div>
        <CapPreview config={cup.cap} size={64} />
      </div>
      <ul className="wc-teams" aria-label="The eight clubs">
        {teams.map((t, i) => <li key={i} data-me={i === 0 ? 'true' : undefined}><CapPreview config={t} size={38} /></li>)}
      </ul>
      <ol className="wc-road" aria-label="How hard each round is">
        {['Quarter-final', 'Semi-final', 'Final'].map((r, i) => <li key={r} data-level={CUP_LEVELS[i]}><b>{r}</b><span>{LEVEL_LABEL[CUP_LEVELS[i]]}</span></li>)}
      </ol>
      <p className="wc-prize"><Icon name="trophy" size={16} /> {wonIt ? <>You won it this week! Play again for fun.</> : <>Win it: <b>{money(CUP_PRIZE)}</b> and the <b>{cup.name}</b> cap</>}</p>
      <button className="btn btn-gold btn-lg btn-block" onClick={enter} onMouseEnter={playHoverTick}>
        {mineGoing ? 'Carry on' : 'Enter the cup'} <Icon name="next" size={18} />
      </button>
    </section>
  )
}

/** The road to the final in the hub: each round and how hard the computer plays it. */
export function CupRoad({ t, round }) {
  const n = t.rounds?.length || 3
  return (
    <ol className="wc-road wc-road-hub" aria-label="How hard each round is">
      {t.rounds.map((_, i) => {
        const level = CUP_LEVELS[Math.max(0, i - (n - CUP_LEVELS.length))]
        return <li key={i} data-level={level} data-now={i === round ? 'true' : undefined} data-done={i < round ? 'true' : undefined}><b>{roundName(i, n)}</b><span>{LEVEL_LABEL[level]}</span></li>
      })}
    </ol>
  )
}

/** The draw, once, when the cup starts: the quarter-finals revealed one by one. */
export function CupDraw({ t, onDone }) {
  const ties = t.rounds?.[0] || []
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= ties.length) return
    const id = setTimeout(() => { setShown((n) => n + 1); playButtonSelect() }, shown === 0 ? 500 : 650)
    return () => clearTimeout(id)
  }, [shown, ties.length])
  const done = shown >= ties.length
  return (
    <div className="wc-draw" role="dialog" aria-label="The draw">
      <div className="wc-draw-box">
        <div className="wc-tab">The draw</div>
        <h2>{t.weekly?.name || 'The Cup'}</h2>
        <p className="wc-draw-k">Quarter-finals</p>
        <ul className="wc-draw-ties">
          {ties.map((tie, i) => {
            const home = teamById(t, tie.home)
            const away = teamById(t, tie.away)
            const mine = (home && !home.cpu) || (away && !away.cpu)
            return (
              <li key={tie.id} data-shown={i < shown ? 'true' : undefined} data-mine={mine ? 'true' : undefined}>
                {home && <span className="wc-draw-side"><CapPreview config={home} size={30} /><b>{home.name}</b></span>}
                <i>v</i>
                {away && <span className="wc-draw-side wc-draw-away"><b>{away.name}</b><CapPreview config={away} size={30} /></span>}
              </li>
            )
          })}
        </ul>
        <button className="btn btn-gold btn-lg btn-block" disabled={!done} onClick={() => { playConfirm(); onDone() }}>
          {done ? <>Let’s play <Icon name="play" size={18} /></> : 'Drawing…'}
        </button>
      </div>
    </div>
  )
}
