import { useMemo, useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { DIVISIONS } from '../game/career'
import { transferWindow, squadSize, squadFull, MAX_SQUAD, talksWith, spendingFrozen } from '../game/transfers'
import { searchMarket, locate, hydrate, askingPrice, willingness, standingOf, STANDING_LABEL, clubOvr, TIER_LABEL, MAX_BIDS } from '../game/world'
import { wageOf } from '../game/club'
import { potentialRange, priceOf, money, windowDeadline } from '../game/squad'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'
import { Rating, Attrs, Coins, DIV_SHORT } from './PlayerBits'

const PAGE = 30
const POSITIONS = ['ALL', 'GK', 'DEF', 'MID', 'ATK']
const SORTS = { ovr: 'Best OVR', pot: 'Potential', price: 'Cheapest', age: 'Youngest' }
const AGES = { 0: 'Any age', 21: '21 or under', 24: '24 or under', 28: '28 or under' }

/**
 * The transfer market: every player at every club in the world, and the free
 * agents. Search, open a player, and bid.
 */
export default function TransferMarket({ career, onClose }) {
  const [pos, setPos] = useState('ALL')
  const [level, setLevel] = useState(String(career.level))
  const [sort, setSort] = useState('ovr')
  const [maxAge, setMaxAge] = useState('0')
  const [name, setName] = useState('')
  const [affordable, setAffordable] = useState(false)
  const [happyOnly, setHappyOnly] = useState(false)
  const [listed, setListed] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState(null) // player id

  const rows = useMemo(() => {
    const lv = level === 'all' ? undefined : level === 'free' ? 'free' : Number(level)
    return searchMarket(career.world, {
      pos, level: lv, sort, maxAge: Number(maxAge) || undefined, name, listed,
      maxPrice: affordable ? Math.max(0, career.coins) : undefined, happy: happyOnly,
    }, career.level)
  }, [career.world, career.level, career.coins, pos, level, sort, maxAge, name, affordable, happyOnly, listed])

  const win = transferWindow(career)
  const reset = () => setShown(PAGE)

  if (open) return <PlayerDetail career={career} id={open} onBack={() => setOpen(null)} onClose={onClose} />

  return (
    <Modal title="Transfer market" onClose={onClose}>
      <div className="market-status">
        <span>Budget <Coins n={career.coins} /></span>
        <span data-full={squadFull(career) ? 'true' : undefined}>Squad <b>{squadSize(career)}/{MAX_SQUAD}</b></span>
        <span data-open={win ? 'true' : undefined}>{win ? `Window open · shuts at matchday ${windowDeadline(win.index)}` : 'Window shut'}</span>
      </div>
      {squadFull(career) && <p className="club-alert" role="status">Your squad is full. Sell, release or loan out a player before you can sign anyone.</p>}
      {!win && <p className="muted t-note"><Icon name="lock" size={13} /> Players at clubs can only be signed in a transfer window. Free agents can sign any time.</p>}

      <p className="muted t-note">Players from a higher division don’t want to drop down to the {DIVISIONS[career.level].name}. They’ll come for money: a signing bonus and higher wages (marked ×). The further they drop, the more they want.</p>
      <div className="market-filters">
        <input className="field" type="search" placeholder="Search a player or club" value={name} onChange={(e) => { setName(e.target.value); reset() }} aria-label="Search a player or club" />
        <div className="segmented stretch" role="group" aria-label="Position">
          {POSITIONS.map((p) => <button key={p} aria-pressed={pos === p} onClick={() => { setPos(p); reset() }}>{p === 'ALL' ? 'All' : p}</button>)}
        </div>
        <div className="market-selects">
          <label><span>Division</span>
            <select className="field" value={level} onChange={(e) => { setLevel(e.target.value); reset() }}>
              <option value="all">All divisions</option>
              {DIVISIONS.map((d, i) => <option key={d.name} value={String(i)}>{d.name}</option>)}
              <option value="free">Free agents</option>
            </select>
          </label>
          <label><span>Sort</span>
            <select className="field" value={sort} onChange={(e) => { setSort(e.target.value); reset() }}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label><span>Age</span>
            <select className="field" value={maxAge} onChange={(e) => { setMaxAge(e.target.value); reset() }}>
              {Object.entries(AGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="market-checks">
          <label><input type="checkbox" checked={affordable} onChange={(e) => { setAffordable(e.target.checked); reset() }} /> In my budget</label>
          <label><input type="checkbox" checked={happyOnly} onChange={(e) => { setHappyOnly(e.target.checked); reset() }} /> No drop-down premium</label>
          <label><input type="checkbox" checked={listed} onChange={(e) => { setListed(e.target.checked); reset() }} /> Listed and free agents</label>
        </div>
      </div>

      <p className="muted t-note market-count">{rows.length} player{rows.length === 1 ? '' : 's'}</p>
      {rows.length === 0
        ? <p className="muted t-note">Nobody matches. Try another division, or turn off a filter.</p>
        : (
          <ul className="squad-list market-rows">
            {rows.slice(0, shown).map(({ player: p, club, total, standing, willing }) => (
              <li key={p.id}>
                <button className="market-row" onClick={() => { playButtonSelect(); setOpen(p.id) }} data-reluctant={willing.reluctant ? 'true' : undefined}>
                  <span className="squad-role">{p.pos}</span>
                  <span className="squad-name">
                    <span className="squad-name-main">{p.name}</span>
                    <small className="squad-stats">{club ? `${club.name} · ${DIV_SHORT[club.level]}` : 'Free agent'} · {p.age} · POT {potentialRange(p)}{standing === 'listed' ? ' · listed' : ''}</small>
                  </span>
                  <Rating value={p.rating} />
                  <span className="market-price">{money(total)}{willing.reluctant && <small>×{willing.premium} wages</small>}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      {rows.length > shown && <button className="btn btn-secondary btn-block" onClick={() => setShown((n) => n + PAGE)}>Show more</button>}
    </Modal>
  )
}

/** One player in the market: who he is, what his club wants, and your bid. */
function PlayerDetail({ career, id, onBack, onClose }) {
  const where = locate(career.world, id)
  const [result, setResult] = useState(null)
  const p0 = where?.player
  const club = where?.club || null
  const asking = p0 ? askingPrice(p0, club) : 0
  const step = Math.max(5, Math.round((asking * 0.05) / 5) * 5)
  const talks = talksWith(career, id)
  const [bid, setBid] = useState(() => talks?.counter ?? (club ? Math.max(5, Math.round((asking * 0.9) / 5) * 5) : asking))

  // Signed: he's left the world
  if (!where) {
    return (
      <Modal title="Done deal" onClose={onClose}>
        <p className="t-note">{result?.name || 'He'} has signed and joined your reserves. Bring him into the matchday ten from your squad list.</p>
        <button className="btn btn-gold btn-block" onClick={onBack}>Back to the market</button>
      </Modal>
    )
  }
  const hp = hydrate(p0)
  const standing = standingOf(p0, club)
  const willing = willingness(p0, club, career.level)
  const win = transferWindow(career)
  const ended = talks?.ended || (talks?.tries ?? 0) >= MAX_BIDS
  const blocked = squadFull(career) ? `Your squad is full (${MAX_SQUAD}). Sell, release or loan out a player first.`
      : club && !win ? 'The transfer window is shut. Come back when it opens.'
        : spendingFrozen(career) ? 'The board has frozen spending while the club is in the red.'
          : ended ? `${club?.name || 'His agent'} won’t talk again until the next window.` : null

  const send = () => {
    const r = useCareerStore.getState().bid(id, bid)
    if (r.verdict === 'accept') playConfirm()
    else playButtonSelect()
    if (r.verdict === 'counter') setBid(r.fee)
    setResult({ ...r, name: p0.name })
  }

  return (
    <Modal title={hp.name} onClose={onClose}>
      <button className="btn btn-ghost market-back" onClick={onBack}><Icon name="back" size={16} /> Back to the search</button>
      <div className="player-card">
        <Rating value={hp.rating} />
        <div>
          <p className="player-card-line"><b>{hp.pos}</b> · Age {hp.age} · POT {potentialRange(hp)}</p>
          <Attrs attrs={hp.attrs} />
          <p className="muted t-note">
            {club ? <>{STANDING_LABEL[standing]} at <b>{club.name}</b> ({DIVISIONS[club.level].name}, {TIER_LABEL[club.tier].toLowerCase()}, OVR {clubOvr(club)})</> : 'Free agent: no club, no fee, just a signing-on payment.'}
          </p>
          <p className="muted t-note">Value {money(priceOf(hp))} · Wages {money(wageOf(hp))} a match</p>
        </div>
      </div>

      <div className="market-ask">
        <span>{club ? 'Asking price' : 'Signing-on fee'}</span>
        <b>{money(asking)}</b>
      </div>
      {willing.reluctant && (
        <div className="market-reluctant" role="note">
          <p>{willing.why}</p>
          <ul className="club-lines">
            <li><span>Signing bonus (on top of the fee)</span><b>{money(willing.bonus)}</b></li>
            <li><span>His wages with you</span><b>{money(Math.round(wageOf(hp) * willing.premium))} a match</b></li>
          </ul>
        </div>
      )}

      {blocked ? <p className="club-alert" role="status">{blocked}</p> : (
        <div className="market-bid">
          {club && (
            <div className="market-stepper">
              <button className="btn btn-secondary" aria-label="Bid less" onClick={() => setBid((b) => Math.max(5, b - step))}>−</button>
              <output aria-live="polite">{money(bid)}</output>
              <button className="btn btn-secondary" aria-label="Bid more" onClick={() => setBid((b) => b + step)}>+</button>
            </div>
          )}
          {club && (
            <div className="market-quick">
              {[0.8, 0.9, 1].map((f) => {
                const v = Math.max(5, Math.round((asking * f) / 5) * 5)
                return <button key={f} className="btn btn-ghost" aria-pressed={bid === v} onClick={() => setBid(v)}>{f === 1 ? 'Asking' : `${Math.round(f * 100)}%`}</button>
              })}
            </div>
          )}
          <button className="btn btn-gold btn-lg btn-block" disabled={career.coins < bid + willing.bonus} onClick={send}>
            {club ? `Bid ${money(bid)}` : `Sign for ${money(asking)}`}{willing.bonus ? ` + ${money(willing.bonus)} bonus` : ''}
          </button>
          {career.coins < bid + willing.bonus && <p className="muted t-note">That’s more than your budget of {money(career.coins)}.</p>}
          {club && <p className="muted t-note">Bids left this window: {MAX_BIDS - (talks?.tries ?? 0)}. Clubs accept fair bids, counter low ones and walk away after {MAX_BIDS}.</p>}
        </div>
      )}

      {result && result.verdict !== 'accept' && (
        <p className="market-verdict" data-verdict={result.verdict} role="status">
          {result.verdict === 'counter' ? `${club?.name} want ${money(result.fee)}. Your bid is set to that.` : result.why || 'Bid rejected.'}
        </p>
      )}
    </Modal>
  )
}
