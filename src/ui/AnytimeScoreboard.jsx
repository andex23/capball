import CapPreview from './CapPreview'
import Icon from './Icon'
import './anytime.css'

function Team({ config, side, active, mine, used, total }) {
  return <div className={`at-team at-team-${side}`} data-active={active} style={{ '--kit': config.primary }}>
    <div className="at-team-identity">
      <CapPreview config={config} size={32} />
      <div className="at-team-copy"><span className="at-team-name">{config.name}</span><span className="at-team-side">{mine ? 'YOU' : side === 'home' ? 'HOME' : 'AWAY'}</span></div>
    </div>
    <div className="at-turn-count"><strong>{used}</strong><span>/ {total} turns</span></div>
    <div className="at-turn-track" aria-hidden="true" style={{ '--turns': total }}>
      {Array.from({ length: total }, (_, i) => <i key={i} data-used={i < used} />)}
    </div>
  </div>
}

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
      <div className="at-scoreboard" aria-label={`${c.teams.team1.name} ${s.score.team1}, ${c.teams.team2.name} ${s.score.team2}`}>
        <div className="at-score-rail"><span>CAPBALL <i /> PLAY ANYTIME</span><span className="at-save-state"><Icon name={pending ? 'wifi' : 'check'} size={11} /> {busy ? 'SAVING' : pending ? 'PENDING' : 'SAVED'}</span></div>
        <div className="at-score-main">
          <Team config={c.teams.team1} side="home" active={active === 'team1'} mine={myTeam === 'team1'} used={s.turns.team1} total={c.turnsPerPlayer} />
          <div className="at-score-numbers"><div><strong>{s.score.team1}</strong><span>:</span><strong>{s.score.team2}</strong></div><small>{s.shootout ? `PEN ${s.penaltyScores.team1} : ${s.penaltyScores.team2}` : s.complete ? 'FULL TIME' : 'VS'}</small></div>
          <Team config={c.teams.team2} side="away" active={active === 'team2'} mine={myTeam === 'team2'} used={s.turns.team2} total={c.turnsPerPlayer} />
        </div>
      </div>
      <div className="at-possession" data-yours={yours && !busy && !watching} role="status"><span className="at-status-light" /><span>{status}</span>{yours && !watching && !busy && !pending && <Icon name="next" size={12} />}</div>
    </div>
  </header>
}
