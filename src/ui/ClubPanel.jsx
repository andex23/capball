import { useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { spendingFrozen, DIVISIONS } from '../game/career'
import {
  STADIUM, TRAINING, ACADEMY, UPGRADE_COST, TICKETS, ticketPrice, attendance, wageBill, ledgerTotals,
  INCOME, COSTS, LEDGER_LABEL, clubValue, TV_MONEY,
} from '../game/club'
import { money, potentialRange, sellValue } from '../game/squad'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'

const naira = (n) => money(n / 10_000)
const people = (n) => Math.round(n).toLocaleString('en-NG')

const FACILITY = [
  { kind: 'stadium', label: 'Stadium', levels: STADIUM, effect: (l) => `${people(l.seats)} seats` },
  { kind: 'training', label: 'Training ground', levels: TRAINING, effect: (l) => (l.xp > 1 ? `Players improve ${Math.round((l.xp - 1) * 100)}% faster` : 'No boost to development') },
  { kind: 'academy', label: 'Youth academy', levels: ACADEMY, effect: (l) => (l.pot == null ? 'No graduates' : `A graduate each summer${l.pot > 0 ? `, +${l.pot} potential` : ''}`) },
]

const SPONSOR_KIND = {
  steady: (a) => `${money(a)} every match`,
  win: (a) => `${money(a)} for every win`,
  upfront: (a) => `${money(a)} now, once`,
}

/** The business side of the club: money in and out, the ground, tickets, sponsor and academy. */
export default function ClubPanel({ career }) {
  const [youthOpen, setYouthOpen] = useState(false)
  const biz = career.biz
  if (!biz) return null
  const store = useCareerStore.getState()
  const frozen = spendingFrozen(career)
  const wages = wageBill(career.squad, career.bench)
  const books = ledgerTotals(biz.ledger)
  const last = biz.lastMatch
  const lastNet = last ? last.gate + last.sponsor + last.prize - last.wages : null
  const seats = STADIUM[biz.stadium].seats

  return (
    <section className="card card-pad club-card" aria-label="Club business">
      <div className="squad-head">
        <h2 className="saved-h">Club business</h2>
        <span className="squad-coins squad-naira" data-neg={career.coins < 0 ? 'true' : undefined}>{money(career.coins)}</span>
      </div>

      <dl className="club-facts">
        <div><dt>Fans</dt><dd>{people(biz.fans)}</dd></div>
        <div><dt>Wage bill</dt><dd>{money(wages)} a match</dd></div>
        <div><dt>Club value</dt><dd>{money(clubValue(career.squad, career.bench, biz))}</dd></div>
      </dl>

      {frozen && (
        <p className="club-alert" role="alert">The club is in the red. The board has frozen transfers and building work until the balance is back above zero. Sell a player or win some matches.</p>
      )}

      {career.youthOffer && (
        <div className="club-youth">
          <p><b>Academy graduate:</b> {career.youthOffer.name}, {career.youthOffer.pos}, age {career.youthOffer.age}. OVR {career.youthOffer.rating}, potential {potentialRange(career.youthOffer)}.</p>
          <button className="btn btn-gold squad-buy" onClick={() => { playButtonSelect(); setYouthOpen(true) }}>Sign him</button>
          <button className="btn btn-ghost squad-buy" onClick={() => { playButtonSelect(); store.youth(null) }}>Let him go</button>
        </div>
      )}

      {last && (
        <>
          <h3 className="squad-sub-h">Last match</h3>
          <ul className="club-lines">
            {last.home ? <li><span>Tickets ({people(last.attendance)} came)</span><b>+{money(last.gate)}</b></li> : <li><span>Away match, no ticket money</span><b /></li>}
            <li><span>Prize money</span><b>+{money(last.prize)}</b></li>
            {last.sponsor > 0 && <li><span>Sponsor</span><b>+{money(last.sponsor)}</b></li>}
            <li><span>Wages</span><b data-neg="true">−{money(last.wages)}</b></li>
            <li className="club-total"><span>Profit</span><b data-neg={lastNet < 0 ? 'true' : undefined}>{lastNet >= 0 ? '+' : ''}{money(lastNet)}</b></li>
          </ul>
        </>
      )}

      <h3 className="squad-sub-h">This season’s books</h3>
      <ul className="club-lines">
        {INCOME.filter((k) => biz.ledger[k]).map((k) => <li key={k}><span>{LEDGER_LABEL[k]}</span><b>+{money(biz.ledger[k])}</b></li>)}
        {COSTS.filter((k) => biz.ledger[k]).map((k) => <li key={k}><span>{LEDGER_LABEL[k]}</span><b data-neg="true">−{money(biz.ledger[k])}</b></li>)}
        <li className="club-total"><span>Profit so far</span><b data-neg={books.profit < 0 ? 'true' : undefined}>{books.profit >= 0 ? '+' : ''}{money(books.profit)}</b></li>
      </ul>
      <p className="muted t-note">Season bonuses and cup prizes are paid at the end. {TV_MONEY[career.level] ? `TV money in the ${DIVISIONS[career.level].name} is ${money(TV_MONEY[career.level])} a season.` : 'There’s no TV money until the division above.'}</p>

      <h3 className="squad-sub-h">Tickets</h3>
      <div className="club-tickets" role="radiogroup" aria-label="Ticket price">
        {Object.entries(TICKETS).map(([key, t]) => {
          const crowd = attendance({ ...biz, ticket: key })
          return (
            <button key={key} role="radio" aria-checked={biz.ticket === key} className="club-ticket" data-on={biz.ticket === key ? 'true' : undefined}
              onClick={() => { playButtonSelect(); store.tickets(key) }}>
              <b>{t.label}</b>
              <span>{naira(ticketPrice(career.level, key))}</span>
              <small>{people(crowd)} / {people(seats)}</small>
            </button>
          )
        })}
      </div>
      <p className="muted t-note">Cheaper tickets fill more seats. The crowd at home matches also grows as you win.</p>

      <h3 className="squad-sub-h">Sponsor</h3>
      {biz.sponsor ? (
        <p className="t-note"><b>{biz.sponsor.name}</b> · {SPONSOR_KIND[biz.sponsor.kind](biz.sponsor.amount)}. New offers come in next summer.</p>
      ) : biz.offers?.length ? (
        <ul className="squad-list club-offers">
          {biz.offers.map((o, i) => (
            <li key={o.name}>
              <span className="squad-name"><span className="squad-name-main">{o.name}</span><small className="squad-stats">{SPONSOR_KIND[o.kind](o.amount)}</small></span>
              <button className="btn btn-gold squad-buy" onClick={() => { playConfirm(); store.sponsor(i) }}>Sign</button>
            </li>
          ))}
        </ul>
      ) : <p className="muted t-note">No sponsor this season.</p>}

      <h3 className="squad-sub-h">Facilities</h3>
      <ul className="squad-list club-facilities">
        {FACILITY.map((f) => {
          const lv = biz[f.kind]
          const now = f.levels[lv]
          const nextLv = f.levels[lv + 1]
          const cost = UPGRADE_COST[f.kind][lv + 1]
          const can = nextLv && !frozen && career.coins >= cost
          return (
            <li key={f.kind}>
              <span className="squad-name">
                <span className="squad-name-main">{f.label}: {now.name}</span>
                <small className="squad-stats">{f.effect(now)}{nextLv ? ` · next: ${nextLv.name}, ${f.effect(nextLv).toLowerCase()}` : ' · fully built'}</small>
              </span>
              {nextLv && (
                <button className="btn btn-secondary squad-buy" disabled={!can} onClick={() => { playConfirm(); store.build(f.kind) }}>
                  Build {money(cost)}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {youthOpen && career.youthOffer && <YouthSigning career={career} onDone={() => setYouthOpen(false)} />}
    </section>
  )
}

/** Put the academy graduate on the bench in place of someone (who leaves for his value). */
function YouthSigning({ career, onDone }) {
  const y = career.youthOffer
  const slots = (career.bench || []).map((p, i) => ({ p, i })).filter(({ p }) => (p.pos === 'GK') === (y.pos === 'GK'))
  return (
    <Modal title={`Sign ${y.name}`} onClose={onDone}>
      <p className="muted t-note">He takes a place on the bench. Who leaves? You get his sale value.</p>
      <ul className="squad-list squad-bench">
        {slots.map(({ p, i }) => (
          <li key={p.id}>
            <span className="squad-role">{p.pos}</span>
            <span className="squad-name"><span className="squad-name-main">{p.name}</span><small className="squad-stats">Age {p.age} · OVR {p.rating}</small></span>
            <span />
            <button className="btn btn-secondary squad-buy" onClick={() => { playConfirm(); if (useCareerStore.getState().youth(i)) onDone() }}>+{money(sellValue(p))}</button>
          </li>
        ))}
      </ul>
      {slots.length === 0 && <p className="muted t-note">No bench place for a {y.pos === 'GK' ? 'keeper' : 'outfield player'}.</p>}
    </Modal>
  )
}
