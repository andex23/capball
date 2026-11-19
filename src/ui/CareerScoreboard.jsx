import { useEffect } from 'react'
import { DIVISIONS, ME, CUP_NAME, myPosition, leagueDate, cupDate, formatGameDate } from '../game/career'
import { teamById, roundName } from '../game/tournament'
import { headline } from '../game/matchReport'
import { bestPerformer } from '../game/careerBrief'
import { money } from '../game/squad'
import CapPreview from './CapPreview'
import './careerSeason.css'

function ScoreSide({ team, scorers }) {
  return <div className="cs-side">
    <CapPreview config={team} size={58} />
    <strong>{team.name}</strong>
    {scorers?.length > 0 && <ul>{scorers.map((s, i) =>
      <li key={i}>{s.name}{s.own ? ' (OG)' : s.sub ? ' (sub)' : ''}{s.min != null && ' ' + s.min + '′'}</li>
    )}</ul>}
  </div>
}

export function CareerScoreboard({ career }) {
  const m = career.lastMatch
  const cup = m.competition === 'cup'
  const t = cup ? career.cup?.tournament : career.league
  if (!t) return null
  const home = teamById(t, m.home)
  const away = teamById(t, m.away)
  if (!home || !away) return null
  const mineHome = m.home === ME
  const mine = mineHome ? 'home' : 'away'
  const other = mineHome ? 'away' : 'home'
  const gf = m.result[mine]
  const ga = m.result[other]
  const pens = m.result.pens
  const wonPens = pens ? pens[mine] > pens[other] : false
  const pos = myPosition(career.league)
  const best = bestPerformer(career)
  const net = career.lastEarned || 0
  const title = headline({ club: career.club.name, opp: (mineHome ? away : home).name, gf, ga,
    pens: pens ? wonPens ? 'win' : 'loss' : null, scorers: m.scorers, top: !cup && m.posBefore > 1 && pos === 1 })
  return <section className="card cs-board" aria-label="Final score">
    <header><span>{cup ? CUP_NAME + ' · ' + roundName(m.round, t.rounds.length) : DIVISIONS[career.level].name + ' · MD ' + (m.round + 1)}</span>
      <time>{formatGameDate(cup ? cupDate(career, m.round) : leagueDate(career, { round: m.round }))}</time></header>
    <div className="cs-score">
      <ScoreSide team={home} scorers={m.scorers?.filter((s) => s.mine === mineHome)} />
      <div className="cs-digits"><small>Full time</small><b>{m.result.home}–{m.result.away}</b>{pens && <small>Pens {pens.home}–{pens.away}</small>}</div>
      <ScoreSide team={away} scorers={m.scorers?.filter((s) => s.mine !== mineHome)} />
    </div>
    <h2>{title}</h2>
    <dl className="cs-facts">
      <div><dt>{cup ? CUP_NAME : 'League place'}</dt><dd>{cup ? (gf > ga || wonPens ? (t.championId === ME ? 'Winners' : 'Through') : 'Knocked out') : '#' + pos}</dd></div>
      <div><dt>Match income, net</dt><dd>{net > 0 ? '+' : ''}{money(net)}</dd></div>
      {best && <div><dt>Your top cap</dt><dd>{best.name} <b>{best.rating.toFixed(1)}</b></dd></div>}
    </dl>
  </section>
}

export function CareerFinalWhistle({ career, onReport, onDetails }) {
  useEffect(() => {
    const id = setTimeout(onReport, 3200)
    return () => clearTimeout(id)
  }, [onReport])
  return <div className="screen cs-whistle"><div>
    <CareerScoreboard career={career} />
    <button className="btn btn-gold btn-block" onClick={onReport}>Read match report</button>
    <button className="btn btn-secondary btn-block" onClick={onDetails}>Match details &amp; goal clips</button>
  </div></div>
}
