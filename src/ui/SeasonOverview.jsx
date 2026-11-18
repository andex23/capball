import { useState } from 'react'
import { standings } from '../game/tournament'
import { ME } from '../game/career'
import { TRAINING, UPGRADE_COST } from '../game/club'
import { SCOUT_FEE } from '../game/clubLife'
import { money } from '../game/squad'
import { previousTable, leagueForm } from '../game/careerBrief'
import { useRewardsStore } from '../state/rewardsStore'
import { dayKey } from '../game/daily'
import { dailyStatus } from '../game/rewards'
import { DailyReward } from './Rewards'

export function FormLine({ league, opponent }) {
  return <div className="cs-form">{[ME, opponent].map((id) => {
    const form = leagueForm(league, id)
    if (!form.length) return null
    return <span key={id} aria-label={(league.teams.find((t) => t.id === id)?.name || '') + ' form: ' + form.join(', ')}>
      {form.map((f, i) => <i key={i} data-form={f}>{f}</i>)}</span>
  })}</div>
}

export default function SeasonOverview({ career, go }) {
  const rows = standings(career.league)
  const previous = previousTable(career)
  const played = rows.some((r) => r.p)
  const level = (career.biz?.training || 0) + 1
  const cost = UPGRADE_COST.training[level]
  const fee = career.scoutCredits ? 0 : SCOUT_FEE[career.level]
  const daily = useRewardsStore((s) => s.daily)
  const [rewards, setRewards] = useState(false)
  const ready = dailyStatus(daily, dayKey()).ready
  return <>
    {played && <section className="card card-pad cs-table">
      <div className="cs-heading"><h2 className="saved-h">League table</h2><button className="btn btn-ghost" onClick={() => go('league')}>Full table ›</button></div>
      <table><thead><tr><th scope="col">Pos</th><th scope="col">Club</th><th scope="col">P</th><th scope="col">GD</th><th scope="col">Pts</th></tr></thead>
        <tbody>{rows.map((r, i) => {
          if (i >= 4 && r.id !== ME) return null
          const move = previous.length ? previous.findIndex((v) => v.id === r.id) - i : 0
          return <tr key={r.id} data-mine={r.id === ME}><td>{i + 1}</td><th scope="row">{r.name}{!!move && <small aria-label={(move > 0 ? 'Up ' : 'Down ') + Math.abs(move)}>{move > 0 ? '▲' : '▼'}{Math.abs(move)}</small>}</th><td>{r.p}</td><td>{r.gd > 0 ? '+' : ''}{r.gd}</td><td><b>{r.pts}</b></td></tr>
        })}</tbody></table>
    </section>}
    {career.lastMatch?.season === career.season && <button className="cs-news" onClick={() => go('report')}>
      <span>Last match report</span><b>{career.lastMatch.best ? career.lastMatch.best.name + ' · ' + career.lastMatch.best.rating.toFixed(1) + '/10' : 'Full-time result'}</b><i aria-hidden>›</i>
    </button>}
    <section className="card card-pad cs-spend">
      <div className="cs-heading"><h2 className="saved-h">Club budget</h2><b>{money(career.coins)}</b></div>
      <button onClick={() => go('transfers')}><span>Scout a transfer target</span><b data-ready={fee === 0 || career.coins >= fee}>{fee ? money(fee) : 'Free report'}</b></button>
      {cost != null && <button onClick={() => go('club')}><span>{TRAINING[level].name}</span><b data-ready={career.coins >= cost}>{money(cost)}</b></button>}
      {ready && <button onClick={() => setRewards(true)}><span>Daily reward</span><b data-ready="true">Collect ›</b></button>}
    </section>
    {rewards && <><button className="corner-scrim" aria-label="Close daily reward" onClick={() => setRewards(false)} /><DailyReward onClose={() => setRewards(false)} /></>}
  </>
}
