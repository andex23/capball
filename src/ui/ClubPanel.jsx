import { useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { spendingFrozen, TOP } from '../game/career'
import { TABLE_FINISHES, resolveFinish, isFinish, DEFAULT_FINISH } from '../data/StadiumData'
import {
  VENUE, TRAINING, ACADEMY, UPGRADE_COST, TICKETS, ticketPrice, attendance, wageBill, ledgerTotals,
  INCOME, COSTS, LEDGER_LABEL, clubValue, TV_MONEY,
} from '../game/club'
import { money } from '../game/squad'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import BoardObjectives from './BoardObjectives'
import Icon from './Icon'
import './club.css'

export const CLUB_PAGES = { sponsor: 'Sponsor', tickets: 'Ticket prices', facilities: 'Facilities', finances: 'Finances' }
const people = (n) => Math.round(n).toLocaleString('en-NG')
const price = (n) => '₦' + people(n)
const signed = (n) => (n > 0 ? '+' : '') + money(n)
const terms = (offer) => money(offer.amount) + ({ steady: ' per match', win: ' per win', upfront: ' up front' }[offer.kind])
const matchNet = (match) => match.gate + match.prize + match.sponsor - match.wages

const FACILITIES = [
  { key: 'stadium', label: 'Home ground', levels: VENUE, benefit: (now, next) => people(now.seats) + ' → ' + people(next.seats) + ' seats' },
  { key: 'training', label: 'Training ground', levels: TRAINING, benefit: (now, next) => 'Match experience bonus ' + Math.round((now.xp - 1) * 100) + '% → ' + Math.round((next.xp - 1) * 100) + '%' },
  { key: 'academy', label: 'Youth academy', levels: ACADEMY, benefit: (now, next) => next.intake + ' recruits each summer' + (next.pot > now.pot ? ' · higher potential' : '') },
]

function Overview({ career, onOpen }) {
  const { biz, coins } = career
  const available = FACILITIES.map(({ key }) => UPGRADE_COST[key][biz[key] + 1]).filter(Number.isFinite)
  const offers = biz.offers?.length || 0
  const rows = [
    ['sponsor', !biz.sponsor && offers ? 'Choose a sponsor' : 'Sponsor', biz.sponsor?.name || (offers ? offers + ' offers' : 'No offers')],
    ['tickets', 'Ticket prices', price(ticketPrice(career.level, biz.ticket))],
    ['facilities', 'Upgrade facilities', available.length ? 'From ' + money(Math.min(...available)) : 'Fully upgraded'],
    ['finances', 'Finances', 'Season ' + career.season],
  ]
  return <>
    <section className="card club-overview" aria-label="Budget and season target">
      <div className="club-balance"><span>Available budget</span><strong data-negative={coins < 0}>{money(coins)}</strong>
        {biz.lastMatch && <small>Last match <b>{signed(matchNet(biz.lastMatch))}</b></small>}
      </div>
      {spendingFrozen(career) && <p className="club-alert" role="alert">Transfers and upgrades are paused until your balance reaches ₦0.</p>}
      <BoardObjectives career={career} />
    </section>
    <nav className="card club-menu" aria-label="Manage club">
      {rows.map(([key, label, value]) => <button key={key} onClick={() => onOpen(key)}>
        <strong>{label}</strong><span>{value}</span><Icon name="next" size={17} />
      </button>)}
    </nav>
  </>
}

function Sponsors({ career }) {
  const { sponsor, offers } = career.biz
  if (sponsor) return <div className="club-signed" role="status">
    <small>Signed for season {career.season}</small><strong>{sponsor.name}</strong>
    <span>{sponsor.kind === 'upfront' ? money(sponsor.amount) + ' paid on signing' : terms(sponsor)}</span>
  </div>
  if (!offers.length) return <p>No offers this season.</p>
  return <>
    <p className="club-caption">Choose one deal for this season.</p>
    <ul className="club-options">{offers.map((offer, i) => <li key={offer.name}>
      <div><strong>{terms(offer)}</strong><small>{offer.name}</small></div>
      <button className="btn btn-gold" aria-label={'Sign ' + offer.name} onClick={() => {
        if (useCareerStore.getState().sponsor(i)) playConfirm()
      }}>Sign</button>
    </li>)}</ul>
  </>
}

function Tickets({ career }) {
  const biz = career.biz
  const venue = VENUE[biz.stadium]
  return <>
    <p className="club-caption"><strong>{venue.name}</strong> · {people(venue.seats)} seats</p>
    <fieldset className="club-prices"><legend>Home ticket price</legend>
      <div className="club-price-head" aria-hidden="true"><span>Ticket</span><span>Price</span><span>Est. fans</span></div>
      {Object.entries(TICKETS).map(([key, t]) => <label key={key} data-selected={biz.ticket === key}>
        <span><input type="radio" name="club-ticket" value={key} checked={biz.ticket === key}
          onChange={() => { playButtonSelect(); useCareerStore.getState().tickets(key) }} />{t.label}</span>
        <strong>{price(ticketPrice(career.level, key))}</strong>
        <span>{people(attendance({ ...biz, ticket: key }))}<span className="sr-only"> estimated fans</span></span>
      </label>)}
    </fieldset>
  </>
}

function Facilities({ career }) {
  const [receipt, setReceipt] = useState('')
  const { biz, coins } = career
  return <>
    <p className="club-caption">Available budget <b>{money(coins)}</b></p>
    {spendingFrozen(career) && <p className="club-alert" role="alert">Upgrades are paused until your balance reaches ₦0.</p>}
    <ul className="club-options">{FACILITIES.map(({ key, label, levels, benefit }) => {
      const lv = biz[key]
      const now = levels[lv]
      const next = levels[lv + 1]
      const cost = UPGRADE_COST[key][lv + 1]
      return <li key={key}><div>
        <small>{label} · {now.name}</small>
        {next ? <><strong>{next.name}</strong><span>{benefit(now, next)}</span></> : <strong>Fully upgraded</strong>}
      </div>
        {next && <button className="btn btn-secondary" disabled={coins < cost} aria-label={'Build ' + next.name + ' for ' + money(cost)}
          onClick={() => {
            if (useCareerStore.getState().build(key)) { playConfirm(); setReceipt(next.name + ' built for ' + money(cost) + '.') }
          }}>Build {money(cost)}</button>}
      </li>
    })}</ul>
    {receipt && <p className="club-receipt" role="status">{receipt}</p>}
    {career.level === TOP && <ProTable career={career} />}
  </>
}

function ProTable({ career }) {
  const current = isFinish(career.biz.finish) ? career.biz.finish : DEFAULT_FINISH
  return <details className="club-detail">
    <summary>Pro table finish · {resolveFinish(current, career.club).label}</summary>
    <p className="club-caption">{VENUE[career.biz.stadium].venue === 'capArena' ? 'Used for home matches at Cap Arena.' : 'Takes effect when you build Cap Arena.'}</p>
    <div className="finish-grid" role="group" aria-label="Pro table finish">
      {TABLE_FINISHES.map((x) => {
        const f = resolveFinish(x.id, career.club)
        return <button key={x.id} className="finish-pick" aria-pressed={x.id === current} data-on={x.id === current}
          onClick={() => { playButtonSelect(); useCareerStore.getState().tableFinish(x.id) }}>
          <span className="finish-swatch" aria-hidden="true" style={{ '--c1': f.c1, '--c2': f.c2, '--fline': f.line, '--rail': f.rail, '--trim': f.trim }} />
          <b>{x.label}</b>
        </button>
      })}
    </div>
  </details>
}

function Finances({ career }) {
  const { biz } = career
  const books = ledgerTotals(biz.ledger)
  const last = biz.lastMatch
  return <>
    <h3 className="saved-h">Season {career.season}</h3>
    <dl className="club-ledger">
      <div><dt>Money in</dt><dd>{money(books.income)}</dd></div>
      <div><dt>Money out</dt><dd>{money(books.costs)}</dd></div>
      <div className="club-net"><dt>{books.profit < 0 ? 'Season loss' : 'Season profit'}</dt><dd>{money(Math.abs(books.profit))}</dd></div>
    </dl>
    <details className="club-detail"><summary>Season breakdown</summary>
      <dl className="club-ledger">
        {[...INCOME, ...COSTS].filter((k) => biz.ledger[k]).map((k) =>
          <div key={k}><dt>{LEDGER_LABEL[k]}</dt><dd>{signed((COSTS.includes(k) ? -1 : 1) * biz.ledger[k])}</dd></div>)}
      </dl>
      {!books.income && !books.costs && <p>No transactions yet.</p>}
      <p className="club-caption">Bonuses and cup prizes arrive at season end.{TV_MONEY[career.level] ? ' Season TV money is ' + money(TV_MONEY[career.level]) + '.' : ''}</p>
    </details>
    {last && <details className="club-detail"><summary>Last match · {signed(matchNet(last))}</summary>
      <dl className="club-ledger">
        <div><dt>{last.home ? 'Tickets · ' + people(last.attendance) + ' fans' : 'Tickets · away match'}</dt><dd>{money(last.gate)}</dd></div>
        <div><dt>Prize money</dt><dd>{money(last.prize)}</dd></div>
        {last.sponsor > 0 && <div><dt>Sponsor</dt><dd>{money(last.sponsor)}</dd></div>}
        <div><dt>Wages</dt><dd>{signed(-last.wages)}</dd></div>
      </dl>
    </details>}
    <details className="club-detail"><summary>Club figures</summary>
      <dl className="club-ledger">
        <div><dt>Fans</dt><dd>{people(biz.fans)}</dd></div>
        <div><dt>Wages per match</dt><dd>{money(wageBill(career.squad, career.bench, career.reserves))}</dd></div>
        <div><dt>Club value</dt><dd>{money(clubValue(career.squad, career.bench, biz, career.reserves))}</dd></div>
      </dl>
    </details>
  </>
}

const SECTIONS = { sponsor: Sponsors, tickets: Tickets, facilities: Facilities, finances: Finances }

export default function ClubPanel({ career, page = 'club', onOpen }) {
  if (!career.biz) return null
  const Section = SECTIONS[page]
  return Section
    ? <section className="card card-pad club-section" aria-label={CLUB_PAGES[page]}><Section career={career} /></section>
    : <Overview career={career} onOpen={onOpen} />
}
