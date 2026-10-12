import MatchScoreboard from './MatchScoreboard'
import Icon from './Icon'
import './anytime.css'

export default function AnytimeScoreboard({ match, busy, pending, watching, onMenu }) {
  const { state: s, config: c, myTeam } = match
  const active = !s.complete && match.status === 'active' ? s.activeTeam : null
  const yours = active === myTeam
  const status = busy ? 'SAVING TURN' : pending ? 'RECONNECT TO CONFIRM' : watching ? 'LAST TURN' : s.complete
    ? s.winner ? `${c.teams[s.winner].name} wins` : 'MATCH DRAWN'
    : match.status === 'waiting' ? 'WAITING FOR FRIEND' : yours ? 'YOUR TURN' : 'OPPONENT’S TURN'
  return <header className="at-match-header">
    <button className="at-menu-toggle" onClick={onMenu} aria-label="Open match menu" title="Match menu"><Icon name="menu" size={22} /></button>
    <div className="at-score-wrap">
      <MatchScoreboard teams={c.teams} score={s.score} active={active} myTeam={myTeam} turns={s.turns} total={c.turnsPerPlayer}
        label="PLAY ANYTIME" detail={s.shootout ? `PEN ${s.penaltyScores.team1} : ${s.penaltyScores.team2}` : s.complete ? 'FULL TIME' : 'VS'}
        rail={<span className="at-save-state"><Icon name={pending ? 'wifi' : 'check'} size={11} /> {busy ? 'SAVING' : pending ? 'PENDING' : 'SAVED'}</span>} />
      <div className="at-possession" data-yours={yours && !busy && !watching} role="status"><span className="at-status-light" /><span>{status}</span>{yours && !watching && !busy && !pending && <Icon name="next" size={12} />}</div>
    </div>
  </header>
}
