import { bestPerformer, PRESS } from '../game/careerBrief'
import { useCareerStore } from '../state/careerStore'

const stats = { shots: 'Shots', onTarget: 'On target', saves: 'Keeper saves', fouls: 'Fouls' }

export function MatchFigures({ match, mine, opponent }) {
  const pressure = match.momentum
  return <section className="card card-pad cs-figures">
    <h2 className="saved-h">Match stats</h2>
    {match.stats && <table><thead><tr><th>{mine}</th><td></td><th>{opponent}</th></tr></thead>
      <tbody>{Object.entries(stats).map(([key, label]) => <tr key={key}>
        <td>{match.stats.mine[key]}</td><th scope="row">{label}</th><td>{match.stats.theirs[key]}</td>
      </tr>)}</tbody></table>}
    {pressure && <figure><figcaption>Pressure by ten-minute spell</figcaption>
      <small>Above the line · {mine}</small>
      <div className="cs-bars">{pressure.map((v, i) => {
        const period = (i * 10 + 1) + '–' + (i + 1) * 10 + '′'
        const label = period + ' · ' + (v === 0 ? 'Even' : v > 0 ? mine : opponent)
        return <span key={i} role="img" aria-label={label} title={label}><i data-away={v < 0} style={{ height: Math.abs(v) * 4 }} /></span>
      })}</div>
      <small>Below the line · {opponent}</small>
      <div className="cs-axis"><span>Kick-off</span><span>{pressure.length * 10}′</span></div>
    </figure>}
  </section>
}

export function PressRoom({ career }) {
  const m = career.lastMatch
  const best = bestPerformer(career)
  const named = best && '“' + best.name + (best.sub === 'on' ? ' changed the game off the bench.”' : ' earned that rating today.”')
  const quotes = { squad: '“The whole squad deserves the credit.”', bench: '“I want the bench involved next match.”', player: named }
  const choice = m.press?.choice
  return <section className="card card-pad cs-press">
    <h2 className="saved-h">Post-match interview</h2>
    {best && <p><b>{best.name}</b> {best.sub === 'on' ? 'came off the bench and earned' : 'finished with'} your highest rating, {best.rating.toFixed(1)}/10.</p>}
    {choice ? <p role="status"><b>{quotes[choice] || PRESS[choice].quote}</b><br />{PRESS[choice].detail} for the next match.</p> :
      <><p>Who gets your backing for the next fixture?</p><div>{Object.entries(PRESS).filter(([id]) => quotes[id] && (id !== 'bench' || career.bench.length)).map(([id, p]) =>
        <button key={id} className="btn btn-secondary" onClick={() => useCareerStore.getState().answerPress(id)}><span>{quotes[id]}</span><small>{p.detail}</small></button>
      )}</div></>}
  </section>
}
