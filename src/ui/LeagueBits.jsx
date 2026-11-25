/**
 * The Weekend League's pieces (Lagos Life): the cup icon, your fixtures, the
 * table, the prizes, the full-time card, Monday's result and the trophy
 * cabinet. Presentational: everything comes in as props.
 */
import { useState } from 'react'
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
export function LeagueFixtures({ fixtures, day, today, opensIn, onPlay, onDay, busy }) {
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
            <button key={d} role="tab" aria-selected={i === day} data-state={state} disabled={i > today} onClick={() => onDay?.(i)}>
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
      {next >= 0 ? (
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => onPlay?.(next)}>
          <Icon name="play" size={18} /> {busy ? 'Starting…' : `Play match ${next + 1}`}
        </button>
      ) : played < fixtures.length && <p className="muted wk-done">{today < 2 ? `That’s today’s matches. The next five open in ${opensIn}.` : 'That’s everything open for now.'}</p>}
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
/** The Champion cap, kept under wraps until the first champion is crowned. */
export function MysteryCap({ size = 92 }) {
  return (
    <span className="lg-mystery" style={{ width: size, height: size }} aria-label="The Champion cap: revealed soon">
      <CapPreview config={{ primary: '#14181f', edge: '#d4af37', pattern: 'none', badge: 'none', finish: 'chrome', capNames: 'none' }} size={size} />
      <b style={{ fontSize: size * 0.42 }}>?</b>
    </span>
  )
}

export function LeaguePrizes({ champCap }) {
  return (
    <section className="wk-card lg-prizes" aria-label="Prizes">
      <div className="wk-card-h"><h2 className="display">Prizes</h2><span>Given out Monday</span></div>
      <div className="lg-champ">
        {champCap ? <CapPreview config={champCap} size={92} /> : <MysteryCap />}
        <div>
          <small>1st place</small>
          <b>The Champion cap</b>
          <p>{champCap ? 'One a weekend, dated.' : 'A one-of-a-kind custom cap, revealed soon.'} The gold cup in your cabinet and next to your name all week. ₦1m club money.</p>
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
export function LeagueResultCard({ gf, ga, club, rankFrom, rankTo, pts, left, mine = 'You' }) {
  const res = gf > ga ? 'won' : gf === ga ? 'drew' : 'lost'
  const up = rankTo < rankFrom
  return (
    <div className="lg-result" data-r={res}>
      <div className="lg-result-tag">Weekend League · full time</div>
      <div className="lg-result-score">
        <span>{mine}</span><b>{gf}–{ga}</b><span>{club.name}</span>
      </div>
      <div className="lg-result-pts">{res === 'won' ? '+3 points' : res === 'drew' ? '+1 point' : 'No points'}</div>
      <div className="lg-result-move">
        {rankFrom && rankTo && rankFrom !== rankTo && <>
          <span className="lg-result-rank">#{rankFrom}</span>
          <span className="lg-arrow" data-up={up ? 'true' : undefined}>{up ? '▲' : '▼'}</span>
        </>}
        {rankTo && <span className="lg-result-rank is-now">#{rankTo}</span>}
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Your Weekend League finishes as cabinet pieces: cups for the top three, a medal for the top ten. */
export function cabinetFrom(leagues = []) {
  const items = leagues.filter((l) => l.rank <= 10).map((l) => {
    const [, m, d] = l.key.split('-').map(Number)
    return { rank: l.rank, tier: ['', 'gold', 'silver', 'bronze'][l.rank] || null, date: `${d} ${MONTHS[m - 1]}` }
  })
  return { items, best: leagues.length ? Math.min(...leagues.map((l) => l.rank)) : null, weekends: leagues.length }
}

/** The trophy cabinet: every weekend you placed, dated. */
export function TrophyCabinet({ items, best, weekends }) {
  return (
    <section className="lg-cabinet" aria-label="Trophy cabinet">
      <div className="lg-cab-stats">
        <div><b>{items.filter((t) => t.tier === 'gold').length}</b><small>Titles</small></div>
        <div><b>{items.length}</b><small>Trophies</small></div>
        <div><b>{best ? `#${best}` : '–'}</b><small>Best finish</small></div>
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

/** A box on the league screen that folds away to its header and a one-line summary. */
export function Fold({ title, summary, open: start = true, children }) {
  const [open, setOpen] = useState(start)
  return (
    <section className="wk-card lg-fold" data-open={open ? 'true' : undefined}>
      <button className="lg-fold-h" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <h2 className="display">{title}</h2>
        {!open && summary && <span className="lg-fold-sum">{summary}</span>}
        <span className="lg-chev" aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="lg-fold-body">{children}</div>}
    </section>
  )
}

/** Friday, first visit: pick the club you'll play all fifteen with. */
export function LeagueTeamPick({ options, chosen, when = 'when you kick off match 1' }) {
  return (
    <div className="lg-pick">
      <p className="lg-pick-lead">Pick the club you’ll play the weekend with. <b>All 15 matches, one club.</b> It locks {when}.</p>
      <ul className="lg-pick-grid">
        {options.map((o) => (
          <li key={o.name} data-on={o.name === chosen ? 'true' : undefined}>
            <CapPreview config={o.kit} size={64} />
            <b>{o.name}</b>
            <small>{o.from}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Full time in a league match: the score, the line of the match, points, and the table around you. */
export function LeagueFullTime({ no, gf, ga, mine, club, line: story, rankFrom, rankTo, around, next }) {
  const res = gf > ga ? 'won' : gf === ga ? 'drew' : 'lost'
  return (
    <div className="lg-ft">
      <div className="lg-result-tag">Weekend League · match {no} of 15 · full time</div>
      <div className="lg-ft-score">
        <div><CapPreview config={mine} size={54} /><span>{mine.name}</span></div>
        <b>{gf}–{ga}</b>
        <div><CapPreview config={club} size={54} /><span>{club.name}</span></div>
      </div>
      <p className="lg-ft-line">“{story}”</p>
      <div className="lg-ft-pts" data-r={res}>{res === 'won' ? '+3 points' : res === 'drew' ? '+1 point' : 'No points'}</div>
      <div className="lg-result-move">
        <span className="lg-result-rank">#{rankFrom}</span>
        <span className="lg-arrow" data-up={rankTo < rankFrom ? 'true' : undefined}>{rankTo < rankFrom ? '▲' : rankTo > rankFrom ? '▼' : '='}</span>
        <span className="lg-result-rank is-now">#{rankTo}</span>
        {rankTo <= 10 && rankFrom > 10 && <small className="lg-ft-into">Into the top ten</small>}
      </div>
      <table className="lg-table lg-ft-table">
        <tbody>
          {around.map((r) => [
            <tr key={r.rank} data-me={r.me ? 'true' : undefined}>
              <td className="lg-rank">{r.rank}</td><td className="lg-name">{r.me ? mine.name : r.name}</td><td>{r.p}</td><td className="lg-pts">{r.pts}</td>
            </tr>,
            r.rank === 10 ? <tr key="cut" className="lg-cut"><td colSpan={4}><span>Top 10</span></td></tr> : null,
          ])}
        </tbody>
      </table>
      <button className="btn btn-gold btn-lg btn-block"><Icon name="play" size={18} /> Next: {next.name}</button>
      <button className="btn btn-ghost btn-block">League table</button>
    </div>
  )
}

export const LEAGUE_TABS = [['fixtures', 'Fixtures', 'ball'], ['table', 'Table', 'menu'], ['prizes', 'Prizes', 'trophy'], ['how', 'How it works', 'help']]

/** The league screen's bottom bar: one section at a time instead of one long page. */
export function LeagueNav({ tab, onTab }) {
  return (
    <nav className="lg-nav" aria-label="Weekend League">
      {LEAGUE_TABS.map(([k, label, icon]) => (
        <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => onTab?.(k)}>
          <Icon name={icon} size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
