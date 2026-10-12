import { useEffect } from 'react'
import CapPreview from './CapPreview'
import Icon from './Icon'
import { playCrowdRoar, playCrowdGroan } from '../audio/SoundManager'
import './matchResultSplash.css'

/**
 * How the result reads from the side of the person holding the phone.
 * `myTeam` is their team, or null when two people share the phone (then the
 * winner is simply named).
 */
export function resultWords({ teams, score, winner, penaltyScore, myTeam }) {
  if (!winner) return { tone: 'draw', title: 'Honours even', line: score.team1 === 0 ? 'Nobody could find a way through.' : 'Nothing to separate you.' }
  if (!myTeam) return { tone: 'win', title: `${teams[winner].name} win`, line: penaltyScore ? 'Settled from the spot.' : null }
  const other = myTeam === 'team1' ? 'team2' : 'team1'
  const margin = Math.abs(score[myTeam] - score[other])
  if (winner === myTeam) {
    return {
      tone: 'win',
      title: 'You win',
      line: penaltyScore ? 'Nerves of steel from the spot.' : margin >= 3 ? 'That was a hiding.' : margin === 1 ? 'Got there in the end.' : 'Job done.',
    }
  }
  return {
    tone: 'loss',
    title: 'You lost',
    line: penaltyScore ? 'Beaten on penalties. Cruel.' : margin === 1 ? 'So close. One goal in it.' : margin >= 3 ? 'Tough day. Shake it off.' : 'Not your day.',
  }
}

/** Shared end-of-match reveal. Continue is local; it never advances the opponent. */
export default function MatchResultSplash({ teams, score, winner, penaltyScore, onContinue, myTeam = null }) {
  const words = resultWords({ teams, score, winner, penaltyScore, myTeam })
  useEffect(() => {
    if (words.tone === 'win') playCrowdRoar()
    else if (words.tone === 'loss') playCrowdGroan()
  }, [words.tone])
  // Your team first; otherwise the winner first
  const first = myTeam || winner || 'team1'
  const order = [first, first === 'team1' ? 'team2' : 'team1']
  const label = (team) => {
    if (myTeam) return team === myTeam ? 'You' : 'Opponent'
    return !winner ? 'Draw' : team === winner ? 'Winner' : 'Runner-up'
  }
  return <div className="result-splash" data-tone={words.tone}>
    <section className="result-splash-card" aria-label="Match result">
      <div className="eyebrow">{penaltyScore ? 'After penalties' : 'Full time'}</div>
      <Icon name={words.tone === 'win' ? 'trophy' : 'ball'} size={44} />
      <h1>{words.title}</h1>
      {words.line && <p className="result-splash-line">{words.line}</p>}
      <div className="result-splash-teams">
        {order.map((team) => <div className="result-splash-team" data-winner={winner === team} data-mine={myTeam === team || undefined} key={team}>
          <span className="eyebrow">{label(team)}</span>
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
