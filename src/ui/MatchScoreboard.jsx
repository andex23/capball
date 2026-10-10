import CapPreview from './CapPreview'
import './anytime.css'

function Team({ config, side, active, mine, used, total }) {
  return <div className={`at-team at-team-${side}`} data-active={active} style={{ '--kit': config.primary }}>
    <div className="at-team-identity">
      <CapPreview config={config} size={32} />
      <div className="at-team-copy"><span className="at-team-name">{config.name}</span><span className="at-team-side">{mine ? 'YOU' : side === 'home' ? 'HOME' : 'AWAY'}</span></div>
    </div>
    {total != null && <><div className="at-turn-count"><strong>{used}</strong><span>/ {total} turns</span></div>
    <div className="at-turn-track" aria-hidden="true" style={{ '--turns': total }}>
      {Array.from({ length: total }, (_, i) => <i key={i} data-used={i < used} />)}
    </div></>}
  </div>
}

export default function MatchScoreboard({ teams, score, active, myTeam, turns, total, label, detail, rail, popping, clock }) {
  return <div className="at-scoreboard" role="group" aria-label={`${teams.team1.name} ${score.team1}, ${teams.team2.name} ${score.team2}`}>
    <div className="at-score-rail"><span>CAPBALL <i /> {label}</span>{rail}</div>
    <div className="at-score-main">
      <Team config={teams.team1} side="home" active={active === 'team1'} mine={myTeam === 'team1'} used={turns?.team1} total={total} />
      <div className="at-score-numbers"><div><strong className={popping === 'team1' ? 'pop' : undefined}>{score.team1}</strong><span>:</span><strong className={popping === 'team2' ? 'pop' : undefined}>{score.team2}</strong></div>{clock && <b className="at-match-clock" aria-label={`Time remaining ${clock}`}>{clock}</b>}<small>{detail}</small></div>
      <Team config={teams.team2} side="away" active={active === 'team2'} mine={myTeam === 'team2'} used={turns?.team2} total={total} />
    </div>
  </div>
}
