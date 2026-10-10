import CapPreview from './CapPreview'
import Icon from './Icon'
import './matchResultSplash.css'

/** Shared end-of-match reveal. Continue is local; it never advances the opponent. */
export default function MatchResultSplash({ teams, score, winner, penaltyScore, onContinue }) {
  const order = winner ? [winner, winner === 'team1' ? 'team2' : 'team1'] : ['team1', 'team2']
  return <div className="result-splash">
    <section className="result-splash-card" aria-label="Match result">
      <div className="eyebrow">{penaltyScore ? 'After penalties' : 'Full time'}</div>
      <Icon name={winner ? 'trophy' : 'ball'} size={44} />
      <h1>{winner ? 'VICTORY' : 'HONOURS EVEN'}</h1>
      <div className="result-splash-teams">
        {order.map((team, index) => <div className="result-splash-team" data-winner={!!winner && index === 0} key={team}>
          <span className="eyebrow">{winner ? index === 0 ? 'Winner' : 'Loser' : 'Draw'}</span>
          <CapPreview config={teams[team]} size={80} />
          <strong>{teams[team].name}</strong>
          <span className="result-splash-score">{score[team]}</span>
        </div>)}
      </div>
      {penaltyScore && <p className="result-splash-pens">Penalties · {teams[order[0]].name} {penaltyScore[order[0]]} – {penaltyScore[order[1]]} {teams[order[1]].name}</p>}
      <button autoFocus className="btn btn-primary btn-lg btn-block" onClick={onContinue}>Continue <Icon name="next" size={18} /></button>
    </section>
  </div>
}
