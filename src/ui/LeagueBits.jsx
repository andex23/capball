/**
 * The Weekend League's pieces (Lagos Life): the cup icon, your fixtures, the
 * table, the prizes, the full-time card, Monday's result and the trophy
 * cabinet. Presentational: everything comes in as props.
 */
import CapPreview from './CapPreview'
import Icon from './Icon'
import './league.css'

const TIER = {
  gold: { fill: '#ffd23f', shade: '#e6b51f', line: '#7a5200' },
  silver: { fill: '#e3e8ef', shade: '#b8c2cf', line: '#4b5563' },
  bronze: { fill: '#e0a06a', shade: '#b8743f', line: '#5c3410' },
}

/** A small cup: the league champion's mark (the crown stays the rankings' #1). */
export function LeagueCup({ tier = 'gold', size = 24, label }) {
  const t = TIER[tier] || TIER.gold
  return (
    <svg className="lg-cup" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={label || `${tier} cup`}>
      <path d="M8 4h16v6a8 8 0 0 1-16 0z" fill={t.fill} stroke={t.line} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 7H4v2a5 5 0 0 0 5 5M24 7h4v2a5 5 0 0 1-5 5" fill="none" stroke={t.line} strokeWidth="2.2" />
      <rect x="14" y="17.5" width="4" height="4.5" fill={t.shade} stroke={t.line} strokeWidth="1.4" />
      <rect x="9" y="22" width="14" height="6" rx="1" fill={t.shade} stroke={t.line} strokeWidth="1.8" />
      <path d="M12 7.5h3" stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const DAYS = ['Fri', 'Sat', 'Sun']

/** Your fixtures: three day tabs, the five matches of the day picked, and the play button. */
export function LeagueFixtures({ fixtures, day, today, opensIn, onPlay }) {
  const shown = fixtures.slice(day * 5, day * 5 + 5)
  const next = fixtures.findIndex((f, i) => !f.result && Math.floor(i / 5) <= today)
  const played = fixtures.filter((f) => f.result).length
  return (
    <section className="wk-card lg-fixtures" aria-label="Your fixtures">
      <div className="wk-card-h"><h2 className="display">Your fixtures</h2><span>{played} of {fixtures.length} played</span></div>
      <div className="lg-days" role="tablist">
        {DAYS.map((d, i) => {
          const done = fixtures.slice(i * 5, i * 5 + 5).filter((f) => f.result).length
          const state = i > today ? 'locked' : i === day ? 'on' : 'open'
          return (
            <button key={d} role="tab" aria-selected={i === day} data-state={state}>
              <span>{d}</span>
              <b>{i > today ? (i === today + 1 ? `opens in ${opensIn}` : 'locked') : `${done}/5`}</b>
            </button>
          )
        })}
      </div>
      <ol className="wk-rounds lg-list">
        {shown.map((f, k) => {
          const i = day * 5 + k
          const r = f.result
          const state = r ? (r.gf > r.ga ? 'won' : r.gf === r.ga ? 'drew' : 'lost') : i === next ? 'next' : 'todo'
          return (
            <li key={i} data-state={state}>
              <span className="lg-no">{i + 1}</span>
              <CapPreview config={f.club} size={30} />
              <span className="wk-club"><b>{f.club.name}</b><small>Hard</small></span>
              <span className="wk-score">
                {r ? <>{r.gf}–{r.ga}<em data-r={state}>{state === 'won' ? '+3' : state === 'drew' ? '+1' : '0'}</em></> : i === next ? 'Next ►' : '–'}
              </span>
            </li>
          )
        })}
      </ol>
      {next >= 0 && (
        <button className="btn btn-gold btn-lg btn-block" onClick={onPlay}>
          <Icon name="play" size={18} /> Play match {next + 1}
        </button>
      )}
      <p className="muted wk-note">One go at each match, no replays. Leave early and it’s a 3–0 loss. Miss a day? Catch up any time before Sunday midnight.</p>
    </section>
  )
}

/** The table: P W D L GD Pts, a cup for first, a line under the top ten, and you. */
export function LeagueTable({ rows, me, players }) {
  const line = (r) => (
    <tr key={r.rank} data-me={r.me ? 'true' : undefined} data-top={r.rank <= 3 ? 'true' : undefined}>
      <td className="lg-rank">{r.rank === 1 ? <LeagueCup size={22} label="1st" /> : r.rank}</td>
      <td className="lg-name">{r.me ? 'You' : r.name}</td>
      <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
      <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
      <td className="lg-pts">{r.pts}</td>
    </tr>
  )
  return (
    <section className="wk-card" aria-label="The table">
      <div className="wk-card-h"><h2 className="display">The table</h2><span>{players} playing · live</span></div>
      <table className="lg-table">
        <thead><tr><th>#</th><th className="lg-name">Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>
          {rows.map((r) => [line(r), r.rank === 10 ? <tr key="cut" className="lg-cut"><td colSpan={8}><span>Top 10</span></td></tr> : null])}
          {me && !rows.some((r) => r.me) && <><tr className="lg-gap"><td colSpan={8}>···</td></tr>{line({ ...me, me: true })}</>}
        </tbody>
      </table>
      <p className="muted wk-note">Win 3, draw 1. Level on points: goal difference, then goals scored, then who got there first.</p>
    </section>
  )
}

/** What's up for grabs, with the champion's cap front and centre. */
export function LeaguePrizes({ champCap }) {
  return (
    <section className="wk-card lg-prizes" aria-label="Prizes">
      <div className="wk-card-h"><h2 className="display">Prizes</h2><span>Given out Monday</span></div>
      <div className="lg-champ">
        <CapPreview config={champCap} size={92} />
        <div>
          <small>1st place</small>
          <b>The Champion cap</b>
          <p>One a weekend, dated. The gold cup in your cabinet and next to your name all week. ₦1m club money.</p>
        </div>
      </div>
      <ul className="lg-tiers">
        <li><LeagueCup tier="silver" size={26} /><span><b>2nd</b> Silver cup for your cabinet · ₦500k</span></li>
        <li><LeagueCup tier="bronze" size={26} /><span><b>3rd</b> Bronze cup for your cabinet · ₦250k</span></li>
        <li><span className="lg-medal" aria-hidden>10</span><span><b>Top 10</b> A top-ten medal for your cabinet</span></li>
        <li><Icon name="check" size={22} /><span><b>All 15 played</b> ₦100k</span></li>
      </ul>
    </section>
  )
}

/** Full time in a league match: the points, and where that leaves you. */
export function LeagueResultCard({ gf, ga, club, rankFrom, rankTo, pts, left }) {
  const res = gf > ga ? 'won' : gf === ga ? 'drew' : 'lost'
  const up = rankTo < rankFrom
  return (
    <div className="lg-result" data-r={res}>
      <div className="lg-result-tag">Weekend League · full time</div>
      <div className="lg-result-score">
        <span>You</span><b>{gf}–{ga}</b><span>{club.name}</span>
      </div>
      <div className="lg-result-pts">{res === 'won' ? '+3 points' : res === 'drew' ? '+1 point' : 'No points'}</div>
      <div className="lg-result-move">
        <span className="lg-result-rank">#{rankFrom}</span>
        <span className="lg-arrow" data-up={up ? 'true' : undefined}>{up ? '▲' : rankTo > rankFrom ? '▼' : '='}</span>
        <span className="lg-result-rank is-now">#{rankTo}</span>
        <small>{pts} points · {left}</small>
      </div>
    </div>
  )
}

/** Monday: how your weekend ended, once. */
export function LeagueMonday({ rank, players, tier, cap, champion, pts, money: prize }) {
  return (
    <div className="lg-monday">
      <div className="lg-result-tag">Weekend League · final table</div>
      {tier ? <LeagueCup tier={tier} size={72} /> : <span className="lg-medal is-big">{rank}</span>}
      <h3 className="display">{rank === 1 ? 'Champion of Lagos' : `You finished #${rank}`}</h3>
      <p>of {players} players · {pts} points</p>
      {cap && <div className="lg-monday-cap"><CapPreview config={cap} size={84} /><span>The Champion cap is yours</span></div>}
      <ul>
        {tier && <li><Icon name="trophy" size={16} /> {tier[0].toUpperCase() + tier.slice(1)} cup added to your cabinet</li>}
        {prize && <li><Icon name="check" size={16} /> {prize} club money</li>}
      </ul>
      {champion && rank !== 1 && <p className="muted">Champion: <b>{champion}</b></p>}
    </div>
  )
}

/** The trophy cabinet: every weekend you placed, dated. */
export function TrophyCabinet({ items, best, weekends }) {
  return (
    <section className="lg-cabinet" aria-label="Trophy cabinet">
      <div className="lg-cab-stats">
        <div><b>{items.filter((t) => t.tier === 'gold').length}</b><small>Titles</small></div>
        <div><b>{items.length}</b><small>Trophies</small></div>
        <div><b>#{best}</b><small>Best finish</small></div>
        <div><b>{weekends}</b><small>Weekends</small></div>
      </div>
      <div className="lg-shelves">
        {items.map((t, i) => (
          <figure key={i} className="lg-trophy" data-tier={t.tier || 'medal'}>
            {t.cap ? <CapPreview config={t.cap} size={58} /> : t.tier ? <LeagueCup tier={t.tier} size={54} /> : <span className="lg-medal">{t.rank}</span>}
            <figcaption><b>{t.tier ? ['', '1st', '2nd', '3rd'][t.rank] : `#${t.rank}`}</b><small>{t.date}</small></figcaption>
          </figure>
        ))}
        {Array.from({ length: Math.max(0, 8 - items.length) }, (_, i) => <figure key={`e${i}`} className="lg-trophy is-empty" aria-hidden><span /></figure>)}
      </div>
    </section>
  )
}
