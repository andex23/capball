/**
 * The transfer market, as its own page in the career's Market tab: players
 * first, the club's money and window at the top, simple tabs (For you, Best,
 * Bargains, Young, Free) and the rest of the filters behind one button. Open a
 * player for one clear price and three offers.
 */
import { useMemo, useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { DIVISIONS } from '../game/career'
import { transferWindow, squadSize, squadFull, MAX_SQUAD, talksWith, spendingFrozen, playedThisSeason } from '../game/transfers'
import { searchMarket, locate, hydrate, askingPrice, willingness, standingOf, STANDING_LABEL, clubOvr, TIER_LABEL, MAX_BIDS } from '../game/world'
import { wageOf } from '../game/club'
import { potentialRange, money, windowDeadline, ATTRS, ATTR_LABEL, ROLE_LABEL } from '../game/squad'
import { isScouted, roughPotential, SCOUT_FEE } from '../game/clubLife'
import { fitFor, offerOptions, tabRows, MARKET_TABS } from '../game/marketFit'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import LegendMarket from './LegendMarket'
import Icon from './Icon'
import Modal from './Modal'
import { Rating, DIV_SHORT } from './PlayerBits'
import './market.css'

const PAGE = 25
const POSITIONS = ['ALL', 'GK', 'DEF', 'MID', 'ATK']
const SORTS = { ovr: 'Best rated', pot: 'Potential', price: 'Cheapest', age: 'Youngest' }

/** Potential as you know it: exact range once scouted, a rough guess before. */
const potOf = (career, p) => (isScouted(career, p.id) ? potentialRange(p) : `${roughPotential(p)}?`)

const DEAL_LINE = {
  in: (d) => `Signed ${d.name}${d.club ? ` from ${d.club}` : ' on a free'} · ${money(d.fee)}`,
  out: (d) => `Sold ${d.name} to ${d.club} · ${money(d.fee)}`,
  released: (d) => `Released ${d.name} · paid ${money(d.fee)}`,
  loan: (d) => `Loaned ${d.name} to ${d.club}`,
}

export default function TransferMarket({ career }) {
  const [open, setOpen] = useState(null) // player id
  const [tab, setTab] = useState('forYou')
  const [pos, setPos] = useState('ALL')
  const [name, setName] = useState('')
  const [filters, setFilters] = useState({ level: String(career.level), sort: 'ovr', affordable: false, happyOnly: false, listed: false })
  const [showFilters, setShowFilters] = useState(false)
  const [legends, setLegends] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const rows = useMemo(() => {
    const f = filters
    // The tabs look across every division (and the free agents); the Division filter narrows the Best tab
    const lv = tab !== 'best' ? undefined : f.level === 'all' ? undefined : f.level === 'free' ? 'free' : Number(f.level)
    const base = searchMarket(career.world, {
      pos, level: lv, sort: tab === 'best' ? f.sort : 'ovr', name, listed: f.listed,
      maxPrice: f.affordable ? Math.max(0, career.coins) : undefined, happy: f.happyOnly,
    }, career.level, career.rep ?? 0)
    return tabRows(career, base, tab)
  }, [career, pos, name, tab, filters])

  const win = transferWindow(career)
  const played = playedThisSeason(career.league)
  const reset = () => setShown(PAGE)

  if (open) return <PlayerPage career={career} id={open} onBack={() => setOpen(null)} />

  const used = Object.entries(filters).filter(([k, v]) => (k === 'level' ? v !== String(career.level) : k === 'sort' ? v !== 'ovr' : v)).length

  return (
    <section className="tm" aria-label="Transfer market">
      <div className="tm-strip">
        <div><small>Budget</small><b className="tm-money">{money(career.coins)}</b></div>
        <div data-full={squadFull(career) ? 'true' : undefined}><small>Squad</small><b>{squadSize(career)}/{MAX_SQUAD}</b></div>
        <div data-open={win ? 'true' : undefined}><small>Window</small><b>{win ? `Open · ${windowDeadline(win.index) - played} game${windowDeadline(win.index) - played === 1 ? '' : 's'} left` : 'Shut'}</b></div>
      </div>
      {squadFull(career) && <p className="club-alert" role="status">Your squad is full. Sell, release or loan out a player before you can sign anyone.</p>}
      {!win && <p className="tm-note"><Icon name="lock" size={13} /> Players at clubs can only be signed in a transfer window. Free agents can sign any time.</p>}

      <div className="tm-search">
        <input className="field" type="search" placeholder="Search a player or club" value={name} onChange={(e) => { setName(e.target.value); reset() }} aria-label="Search a player or club" />
        <button className="tm-filter-btn" onClick={() => { playButtonSelect(); setShowFilters(true) }}>Filters{used ? ` · ${used}` : ''}</button>
      </div>
      <div className="tm-chips" role="group" aria-label="Position">
        {POSITIONS.map((p) => <button key={p} aria-pressed={pos === p} onClick={() => { playButtonSelect(); setPos(p); reset() }}>{p === 'ALL' ? 'All' : p}</button>)}
      </div>
      <div className="tm-tabs" role="tablist">
        {Object.entries(MARKET_TABS).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { playButtonSelect(); setTab(k); reset() }}>{label}</button>
        ))}
      </div>

      <button className="tm-legends" aria-expanded={legends} onClick={() => { playButtonSelect(); setLegends((v) => !v) }}>
        <b>★ Legends</b><span>Big names for one season</span><Icon name="next" size={14} />
      </button>
      {legends && <div className="tm-legends-body"><LegendMarket career={career} /></div>}

      {tab === 'forYou' && <p className="tm-note">Players who’d start for you, that you can afford, without silly wages. Biggest upgrade first.</p>}
      {rows.length === 0 ? (
        <p className="tm-note tm-empty">{tab === 'forYou' ? 'Nobody you can afford would start for you right now. Try Bargains or Free.' : 'Nobody matches. Try another tab, or change a filter.'}</p>
      ) : (
        <ul className="tm-list">
          {rows.slice(0, shown).map((r) => <PlayerCard key={r.player.id} career={career} row={r} onOpen={() => { playButtonSelect(); setOpen(r.player.id) }} />)}
        </ul>
      )}
      {rows.length > shown && <button className="btn btn-secondary btn-block" onClick={() => setShown((n) => n + PAGE)}>Show more ({rows.length - shown})</button>}

      {(career.deals || []).length > 0 && (
        <div className="tm-deals">
          <small>Your recent deals</small>
          <ul>{career.deals.slice(0, 4).map((d, i) => <li key={i}>{DEAL_LINE[d.type]?.(d)}</li>)}</ul>
        </div>
      )}

      {showFilters && (
        <Modal title="Filters" onClose={() => setShowFilters(false)}>
          <div className="tm-filters">
            <label><span>Division (Best tab)</span>
              <select className="field" value={filters.level} onChange={(e) => { setFilters((f) => ({ ...f, level: e.target.value })); reset() }}>
                <option value="all">All divisions</option>
                {DIVISIONS.map((d, i) => <option key={d.name} value={String(i)}>{d.name}</option>)}
                <option value="free">Free agents</option>
              </select>
            </label>
            <label><span>Sort (Best tab)</span>
              <select className="field" value={filters.sort} onChange={(e) => { setFilters((f) => ({ ...f, sort: e.target.value })); reset() }}>
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="tm-check"><input type="checkbox" checked={filters.affordable} onChange={(e) => { setFilters((f) => ({ ...f, affordable: e.target.checked })); reset() }} /> Only players in my budget</label>
            <label className="tm-check"><input type="checkbox" checked={filters.happyOnly} onChange={(e) => { setFilters((f) => ({ ...f, happyOnly: e.target.checked })); reset() }} /> Only players happy to join (no extra pay)</label>
            <label className="tm-check"><input type="checkbox" checked={filters.listed} onChange={(e) => { setFilters((f) => ({ ...f, listed: e.target.checked })); reset() }} /> Only transfer-listed and free agents</label>
            <p className="tm-note">Players from a higher division don’t want to drop down to the {DIVISIONS[career.level].name}. They’ll come for a signing bonus and higher wages; the further they drop, the more they want.</p>
            <button className="btn btn-gold btn-block" onClick={() => setShowFilters(false)}>Show players</button>
          </div>
        </Modal>
      )}
    </section>
  )
}

/** One player in the list: rating, who he is, where he'd fit, and the one price. */
function PlayerCard({ career, row, onOpen }) {
  const { player: p, club, total, willing, standing, fit } = row
  const tooDear = total > Math.max(0, career.coins)
  return (
    <li>
      <button className="tm-card" onClick={onOpen} data-dim={tooDear ? 'true' : undefined}>
        <Rating value={p.rating} />
        <span className="tm-card-main">
          <b>{p.name}</b>
          <small>{p.pos} · {p.age} · {club ? `${club.name} · ${DIV_SHORT[club.level]}` : 'Free agent'}{standing === 'listed' ? ' · listed' : ''}</small>
          <span className="tm-tags">
            {fit && fit.delta > 0 && <span className="tm-tag" data-tone="good">+{fit.delta} on your {ROLE_LABEL[fit.role] || fit.pos}</span>}
            {!club && <span className="tm-tag" data-tone="good">Free</span>}
            {p.age <= 21 && <span className="tm-tag">POT {potOf(career, p)}</span>}
            {willing.reluctant && <span className="tm-tag" data-tone="warn">Wants {willing.premium}× pay to drop down</span>}
            {tooDear && <span className="tm-tag" data-tone="bad">Over your budget</span>}
          </span>
        </span>
        <span className="tm-price"><b>{money(total)}</b><small>{money(Math.round(wageOf(p) * (willing.premium || 1)))} a game</small></span>
      </button>
    </li>
  )
}

/** One player: who he is and how he compares with your starter, one clear price, three offers. */
function PlayerPage({ career, id, onBack }) {
  const where = locate(career.world, id)
  const [result, setResult] = useState(null)
  const p0 = where?.player
  const club = where?.club || null
  const asking = p0 ? askingPrice(p0, club) : 0
  const talks = talksWith(career, id)
  const options = offerOptions(asking)
  const [bid, setBid] = useState(() => talks?.counter ?? options[1].fee)

  // Signed: he's left the world
  if (!where) {
    return (
      <section className="tm tm-player">
        <button className="tm-back" onClick={onBack}><Icon name="back" size={16} /> Back to the market</button>
        <div className="tm-done">
          <b>Done deal!</b>
          <p>{result?.name || 'He'} has signed and joined your reserves. Bring him into the matchday ten from your squad.</p>
          <button className="btn btn-gold btn-block" onClick={onBack}>Back to the market</button>
        </div>
      </section>
    )
  }
  const hp = hydrate(p0)
  const standing = standingOf(p0, club)
  const willing = willingness(p0, club, career.level, career.rep ?? 0)
  const fit = fitFor(career, hp)
  const win = transferWindow(career)
  const ended = talks?.ended || (talks?.tries ?? 0) >= MAX_BIDS
  const fee = club ? bid : asking
  const totalCost = fee + willing.bonus
  const wages = Math.round(wageOf(hp) * (willing.premium || 1))
  const blocked = squadFull(career) ? `Your squad is full (${MAX_SQUAD}). Sell, release or loan out a player first.`
    : club && !win ? 'The transfer window is shut. Come back when it opens.'
      : spendingFrozen(career) ? 'The board has frozen spending while the club is in the red.'
        : ended ? `${club?.name || 'His agent'} won’t talk again until the next window.` : null
  const triesLeft = MAX_BIDS - (talks?.tries ?? 0)
  const mineAttrs = fit?.mine.attrs

  const send = () => {
    const r = useCareerStore.getState().bid(id, fee)
    if (r.verdict === 'accept') playConfirm()
    else playButtonSelect()
    if (r.verdict === 'counter') setBid(r.fee)
    setResult({ ...r, name: p0.name })
  }

  return (
    <section className="tm tm-player" aria-label={hp.name}>
      <button className="tm-back" onClick={onBack}><Icon name="back" size={16} /> Back to the market</button>
      <div className="tm-hero">
        <Rating value={hp.rating} />
        <div className="tm-hero-main">
          <h2>{hp.name}</h2>
          <p>{hp.pos} · Age {hp.age} · Potential {potOf(career, hp)}</p>
          <p className="tm-hero-club">{club ? <>{STANDING_LABEL[standing]} at <b>{club.name}</b> · {DIVISIONS[club.level].name} · {TIER_LABEL[club.tier]?.toLowerCase()} (OVR {clubOvr(club)})</> : 'Free agent: no club, no fee to pay, just his signing-on fee.'}</p>
        </div>
        <div className="tm-bars">
          {ATTRS.map((k) => {
            const d = mineAttrs ? hp.attrs[k] - (mineAttrs[k] ?? hp.attrs[k]) : 0
            return (
              <div key={k} className="tm-bar">
                <div><span>{ATTR_LABEL[k]}</span><span>{hp.attrs[k]} {d !== 0 && <b data-tone={d > 0 ? 'good' : 'bad'}>{d > 0 ? '+' : '−'}{Math.abs(d)}</b>}</span></div>
                <i><em style={{ width: `${Math.max(4, Math.min(100, hp.attrs[k]))}%` }} /></i>
              </div>
            )
          })}
        </div>
        {fit && (
          <p className="tm-fit" data-tone={fit.delta > 0 ? 'good' : undefined}>
            {fit.delta > 0
              ? <>↑ Better than your {ROLE_LABEL[fit.role] || fit.pos} <b>{fit.mine.name} ({fit.mine.rating})</b>. He’d start.</>
              : <>Your {ROLE_LABEL[fit.role] || fit.pos} <b>{fit.mine.name}</b> is rated {fit.mine.rating}. He’d be a squad player.</>}
          </p>
        )}
        {!isScouted(career, id) && (
          <button className="tm-scout" disabled={!career.scoutCredits && career.coins < (SCOUT_FEE[career.level] ?? 10)} onClick={() => { playButtonSelect(); useCareerStore.getState().scout(id) }}>
            {career.scoutCredits ? 'Use a free scout report to see his real potential' : `Scout him to see his real potential · ${money(SCOUT_FEE[career.level] ?? 10)}`}
          </button>
        )}
      </div>

      <div className="tm-cost">
        <div className="tm-cost-big"><span>Total to sign</span><b>{money(totalCost)}</b></div>
        {club ? <div className="tm-cost-row"><span>Fee to {club.name}</span><span>{money(fee)}</span></div> : <div className="tm-cost-row"><span>His signing-on fee</span><span>{money(asking)}</span></div>}
        {willing.bonus > 0 && <div className="tm-cost-row"><span>Signing bonus (to drop down)</span><span>{money(willing.bonus)}</span></div>}
        <div className="tm-cost-row"><span>His wages</span><span>{money(wages)} a game{willing.reluctant ? ` (${willing.premium}×)` : ''}</span></div>
        <div className="tm-cost-row" data-neg={career.coins - totalCost < 0 ? 'true' : undefined}><span>Budget left after</span><span>{money(career.coins - totalCost)}</span></div>
      </div>

      {blocked ? <p className="club-alert" role="status">{blocked}</p> : (
        <>
          {club && (
            <div className="tm-offers" role="group" aria-label="Your offer">
              {options.map((o) => (
                <button key={o.key} aria-pressed={bid === o.fee} onClick={() => { playButtonSelect(); setBid(o.fee) }}>
                  <small>{o.label}</small><b>{money(o.fee)}</b><span data-chance={o.chance}>{o.note}</span>
                </button>
              ))}
            </div>
          )}
          {club && talks?.counter && bid === talks.counter && !options.some((o) => o.fee === bid) && <p className="tm-note">Their price: {money(talks.counter)}.</p>}
          <button className="btn btn-gold btn-lg btn-block" disabled={career.coins < totalCost} onClick={send}>
            {club ? `Offer ${money(fee)}` : `Sign him for ${money(asking)}`}{willing.bonus ? ` + bonus` : ''}
          </button>
          {career.coins < totalCost && <p className="tm-note">That’s more than your budget of {money(career.coins)}.</p>}
          {club && (
            <div className="tm-tries"><span>Offers left this window</span><span className="tm-dots" aria-label={`${triesLeft} of ${MAX_BIDS}`}>{Array.from({ length: MAX_BIDS }, (_, i) => <i key={i} data-used={i >= triesLeft ? 'true' : undefined} />)}</span></div>
          )}
        </>
      )}

      {result && result.verdict !== 'accept' && (
        <p className="market-verdict" data-verdict={result.verdict} role="status">
          {result.verdict === 'counter' ? `${club?.name} want ${money(result.fee)}. Your offer is set to that.` : result.why || 'Offer turned down.'}
        </p>
      )}
    </section>
  )
}
