import { useCareerStore } from '../state/careerStore'
import { spendingFrozen, DIVISIONS, TOP } from '../game/career'
import { TABLE_FINISHES, resolveFinish, isFinish, DEFAULT_FINISH } from '../data/StadiumData'
import {
  VENUE, TRAINING, ACADEMY, UPGRADE_COST, TICKETS, ticketPrice, attendance, wageBill, ledgerTotals,
  INCOME, COSTS, LEDGER_LABEL, clubValue, TV_MONEY,
} from '../game/club'
import { money } from '../game/squad'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'

const naira = (n) => money(n / 10_000)
const people = (n) => Math.round(n).toLocaleString('en-NG')

const FACILITY = [
  { kind: 'stadium', label: 'Venue', levels: VENUE, effect: (l) => `${l.table}, room for ${people(l.seats)} to watch` },
  { kind: 'training', label: 'Training ground', levels: TRAINING, effect: (l) => (l.xp > 1 ? `Players improve ${Math.round((l.xp - 1) * 100)}% faster` : 'No boost to development') },
  { kind: 'academy', label: 'Academy', levels: ACADEMY, effect: (l) => `${l.intake} youth player${l.intake === 1 ? '' : 's'} a summer${l.pot > 0 ? `, +${l.pot} potential` : l.pot < 0 ? ', modest potential' : ''}` },
]

const SPONSOR_KIND = {
  steady: (a) => `${money(a)} every match`,
  win: (a) => `${money(a)} for every win`,
  upfront: (a) => `${money(a)} now, once`,
}

/** The business side of the club: money in and out, the ground, tickets, sponsor and academy. */
export default function ClubPanel({ career }) {
  const biz = career.biz
  if (!biz) return null
  const store = useCareerStore.getState()
  const frozen = spendingFrozen(career)
  const wages = wageBill(career.squad, career.bench, career.reserves)
  const books = ledgerTotals(biz.ledger)
  const last = biz.lastMatch
  const lastNet = last ? last.gate + last.sponsor + last.prize - last.wages : null
  const seats = VENUE[biz.stadium].seats

  return (
    <section className="card card-pad club-card" aria-label="Club business">
      <div className="squad-head">
        <h2 className="saved-h">Club business</h2>
        <span className="squad-coins squad-naira" data-neg={career.coins < 0 ? 'true' : undefined}>{money(career.coins)}</span>
      </div>

      <dl className="club-facts">
        <div><dt>Fans</dt><dd>{people(biz.fans)}</dd></div>
        <div><dt>Wage bill</dt><dd>{money(wages)} a match</dd></div>
        <div><dt>Club value</dt><dd>{money(clubValue(career.squad, career.bench, biz, career.reserves))}</dd></div>
      </dl>

      {frozen && (
        <p className="club-alert" role="alert">The club is in the red. The board has frozen transfers and building work until the balance is back above zero. Sell a player or win some matches.</p>
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
      <p className="muted t-note">Your home venue: <b>{VENUE[biz.stadium].name}</b>, {VENUE[biz.stadium].table.toLowerCase()}, with room for {people(seats)} to watch. Cheaper tickets bring more people in, and more come as you win.</p>

      <ProTable career={career} />

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

    </section>
  )
}

/** Top division: choose the table your home matches at Cap Arena are played on. */
function ProTable({ career }) {
  const pro = career.level === TOP
  const current = isFinish(career.biz.finish) ? career.biz.finish : DEFAULT_FINISH
  const atArena = VENUE[career.biz.stadium]?.venue === 'capArena'
  return (
    <>
      <h3 className="squad-sub-h">Pro table</h3>
      {!pro ? (
        <p className="muted t-note">Reach the {DIVISIONS[TOP].name} to choose the finish of your pro table at Cap Arena.</p>
      ) : (
        <>
          <div className="finish-grid" role="radiogroup" aria-label="Pro table finish">
            {TABLE_FINISHES.map((x) => {
              const f = resolveFinish(x.id, career.club)
              return (
                <button key={x.id} role="radio" aria-checked={current === x.id} className="finish-pick" data-on={current === x.id ? 'true' : undefined}
                  onClick={() => { playButtonSelect(); useCareerStore.getState().tableFinish(x.id) }}>
                  <span className="finish-swatch" aria-hidden="true" style={{ '--c1': f.c1, '--c2': f.c2, '--fline': f.line, '--rail': f.rail, '--trim': f.trim }} />
                  <b>{x.label}</b>
                  <small>{x.note}</small>
                </button>
              )
            })}
          </div>
          <p className="muted t-note">{atArena ? 'Your home matches are played on this table.' : 'Your home matches use it once you build Cap Arena.'} Away teams bring their own.</p>
        </>
      )}
    </>
  )
}
