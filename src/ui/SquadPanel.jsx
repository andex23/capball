import { useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { transferWindow, playedThisSeason, DIVISIONS } from '../game/career'
import { formOf, ROLE_LABEL, priceOf, sellValue, squadRatings, clubRatings, averageRating, WINDOW_AFTER, ATTRS, ATTR_LABEL, potentialRange, ovrAt, migratePlayer, money } from '../game/squad'
import { CAP_ROLES } from '../data/TeamOptions'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'

function Rating({ value }) {
  const tier = value >= 75 ? 'gold' : value >= 65 ? 'silver' : 'bronze' // EA FC card colours
  return <span className="squad-rating" data-tier={tier} aria-label={`Rating ${value}`}>{value}</span>
}

/** PWR · SHT · PAS · PHY, small. */
function Attrs({ attrs }) {
  if (!attrs) return null
  return (
    <span className="squad-attrs">
      {ATTRS.map((k) => <span key={k}><small>{ATTR_LABEL[k]}</small>{attrs[k]}</span>)}
    </span>
  )
}

/** Club money, in naira. */
function Coins({ n }) {
  return <span className="squad-coins squad-naira">{money(n)}</span>
}

/** Your six players, your club budget and the transfer window. */
export default function SquadPanel({ career }) {
  const [marketOpen, setMarketOpen] = useState(false)
  const [starting, setStarting] = useState(null) // bench index being brought into the six
  const win = transferWindow(career)
  const played = playedThisSeason(career.league)
  const mine = averageRating(squadRatings(career.squad))
  const rivals = career.league.teams.filter((t) => t.cpu)
  const leagueAvg = rivals.length ? Math.round(rivals.reduce((a, t) => a + averageRating(clubRatings(career.level, t.name)), 0) / rivals.length) : 0
  const opensAt = WINDOW_AFTER.find((n) => n > played)
  const shutLine = opensAt != null
    ? `The transfer window opens after matchday ${opensAt}.`
    : 'The transfer window opens again before next season.'

  return (
    <section className="card card-pad squad-card" aria-label="Squad">
      <div className="squad-head">
        <h2 className="saved-h">Starting six</h2>
        <Coins n={career.coins} />
      </div>
      <p className="muted t-note">PWR: how hard he flicks · SHT: how straight a hard flick goes · PAS: how straight a soft one goes · PHY: how hard he is to knock aside. Your OVR is <b>{mine}</b>; the {DIVISIONS[career.level].name} averages <b>{leagueAvg}</b>.</p>
      <ul className="squad-list">
        {CAP_ROLES.map((role) => {
          const p = migratePlayer(career.squad[role], role)
          const here = ovrAt(p, role)
          return (
            <li key={role}>
              <span className="squad-role">{ROLE_LABEL[role]}</span>
              <span className="squad-shirt">{career.club.numbers?.[role] ?? ''}</span>
              <span className="squad-name">
                <span className="squad-name-main">{p.name}</span>
                <small className="squad-stats">{p.pos !== ROLE_LABEL[role] ? `${p.pos} playing ${ROLE_LABEL[role]} · ` : ''}Age {p.age} · POT {potentialRange(p)}{p.apps > 0 ? ` · ${p.goals || 0} goal${p.goals === 1 ? '' : 's'} · form ${formOf(p)}` : ''}</small>
                <Attrs attrs={p.attrs} />
              </span>
              <Rating value={here} />
            </li>
          )
        })}
      </ul>
      <h3 className="squad-sub-h">Bench</h3>
      <ul className="squad-list squad-bench">
        {(career.bench || []).map((p, i) => (
          <li key={p.id}>
            <span className="squad-role">{p.pos}</span>
            <span className="squad-name">
              <span className="squad-name-main">{p.name}</span>
              <small className="squad-stats">Age {p.age} · POT {potentialRange(p)}{p.apps > 0 ? ` · ${p.apps} app${p.apps === 1 ? '' : 's'}` : ' · no games yet'}</small>
              <Attrs attrs={p.attrs} />
            </span>
            <Rating value={p.rating} />
            <button className="btn btn-secondary squad-buy" onClick={() => { playButtonSelect(); setStarting(i) }}>Start</button>
          </li>
        ))}
      </ul>
      <p className="muted t-note">Make up to three substitutions in a match from the pause menu. Players who never get a game slide a little over the summer.</p>
      {starting != null && career.bench?.[starting] && <StartFromBench career={career} index={starting} onDone={() => setStarting(null)} />}
      {win ? (
        <>
          <p className="t-note squad-window">The {win.index === 0 ? 'pre-season' : 'mid-season'} transfer window is open.</p>
          <button className="btn btn-gold btn-block" onClick={() => { playButtonSelect(); setMarketOpen(true) }}>
            <Icon name="next" size={18} /> Transfer market
          </button>
        </>
      ) : (
        <p className="muted t-note"><Icon name="lock" size={13} /> {shutLine}</p>
      )}
      {career.biz?.lastMatch && <p className="muted t-note">Last match: <Coins n={career.lastEarned} /> after wages. A win pays {money(60)} in prize money, a draw {money(25)}, a loss {money(10)}, plus {money(5)} a goal; each division up pays half as much again. The full books are under Club business.</p>}
      {marketOpen && win && <TransferMarket career={career} market={win.market} onClose={() => setMarketOpen(false)} />}
    </section>
  )
}

/** Bring a bench player into the starting six in place of someone. */
function StartFromBench({ career, index, onDone }) {
  const p = career.bench[index]
  const roles = CAP_ROLES.filter((r) => (r === 'gk') === (p.pos === 'GK'))
  return (
    <Modal title={`Start ${p.name}`} onClose={onDone}>
      <p className="muted t-note">{p.pos} · OVR {p.rating}. Who drops to the bench?</p>
      <ul className="squad-list">
        {roles.map((role) => {
          const out = migratePlayer(career.squad[role], role)
          return (
            <li key={role}>
              <span className="squad-role">{ROLE_LABEL[role]}</span>
              <span className="squad-name">{out.name} <Rating value={ovrAt(out, role)} /> → <b>{ovrAt(p, role)}</b> here</span>
              <button className="btn btn-gold squad-buy" onClick={() => { if (useCareerStore.getState().swap(index, role)) { playConfirm(); onDone() } }}>Swap</button>
            </li>
          )
        })}
      </ul>
      <button className="btn btn-ghost btn-block" onClick={onDone}>Cancel</button>
    </Modal>
  )
}

function TransferMarket({ career, market, onClose }) {
  const [buying, setBuying] = useState(null)
  return (
    <Modal title="Transfer market" onClose={onClose}>
      <div className="squad-head"><span className="muted">Club budget</span><Coins n={career.coins} /></div>
      {market.length === 0 && <p className="muted">You’ve signed everyone on offer this window.</p>}
      <ul className="squad-list squad-market">
        {market.map((p) => {
          const fee = priceOf(p)
          return (
            <li key={p.id}>
              <span className="squad-role">{p.pos}</span>
              <span className="squad-name">
                <span className="squad-name-main">{p.name}</span>
                <small className="squad-stats">Age {p.age} · POT {potentialRange(p)}{p.youth ? ' · youth prospect' : ''}</small>
                <Attrs attrs={p.attrs} />
              </span>
              <Rating value={p.rating} />
              <button className="btn btn-secondary squad-buy" onClick={() => { playButtonSelect(); setBuying(p) }}><Coins n={fee} /></button>
            </li>
          )
        })}
      </ul>
      <p className="muted t-note">Fees rise steeply with OVR; young players with room to grow cost more, players over 30 less. Signing a player lets the one in that spot go for 60% of his value. Keepers only replace your keeper; outfield players can play anywhere outfield, at their OVR for that position.</p>
      {buying && <SignFor career={career} player={buying} onDone={() => setBuying(null)} />}
    </Modal>
  )
}

/** Pick who makes way for the new signing. */
function SignFor({ career, player, onDone }) {
  const fee = priceOf(player)
  const roles = CAP_ROLES.filter((r) => (r === 'gk') === (player.pos === 'GK'))
  const benchSlots = (career.bench || []).map((p, i) => [i, p]).filter(([, p]) => (p.pos === 'GK') === (player.pos === 'GK'))
  const [error, setError] = useState(null)
  const sign = (role) => {
    if (useCareerStore.getState().buy(player.id, role)) { playConfirm(); onDone() }
    else setError('Not enough in the club budget for that deal.')
  }
  return (
    <div className="squad-sign" role="group" aria-label={`Sign ${player.name}`}>
      <p><b>{player.name}</b> ({player.pos} · {player.rating}) costs <Coins n={fee} />. Who makes way?</p>
      <ul className="squad-list">
        {roles.map((role) => {
          const out = migratePlayer(career.squad[role], role)
          const cost = fee - sellValue(out)
          const afford = career.coins >= cost
          return (
            <li key={role}>
              <span className="squad-role">{ROLE_LABEL[role]}</span>
              <span className="squad-name">{out.name} <Rating value={ovrAt(out, role)} /> → <b>{ovrAt(player, role)}</b> here</span>
              <button className="btn btn-gold squad-buy" disabled={!afford} onClick={() => sign(role)}>
                {cost <= 0 ? `+${money(-cost)}` : `−${money(cost)}`}
              </button>
            </li>
          )
        })}
        {benchSlots.map(([i, out]) => {
          const cost = fee - sellValue(out)
          const afford = career.coins >= cost
          return (
            <li key={`b${i}`}>
              <span className="squad-role">BENCH</span>
              <span className="squad-name">{out.name} <Rating value={out.rating} /></span>
              <button className="btn btn-gold squad-buy" disabled={!afford} onClick={() => sign(`bench:${i}`)}>
                {cost <= 0 ? `+${money(-cost)}` : `−${money(cost)}`}
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="t-note" role="alert">{error}</p>}
      <button className="btn btn-ghost btn-block" onClick={onDone}>Cancel</button>
    </div>
  )
}

/** After a match: each player's rating out of 10, Man of the Match, and who improved. */
export function PlayerRatings({ career, title = 'Last match', fixtureId = null }) {
  const rep = career?.lastReport
  if (!rep || (fixtureId && rep.fixtureId !== fixtureId)) return null
  const surname = (n) => String(n || '').split(' ').pop()
  // With substitutes: everyone who played, in role order, subs marked
  if (rep.players) {
    const everyone = [...Object.values(career.squad), ...(career.bench || [])]
    const order = (x) => CAP_ROLES.indexOf(x.role) * 2 + (x.sub === 'on' ? 1 : 0)
    const rows = rep.players.slice().sort((a, b) => order(a) - order(b))
    return (
      <section className="card card-pad ratings-card" aria-label="Player ratings">
        <h2 className="saved-h">{title}</h2>
        <ul className="ratings-list">
          {rows.map((x) => {
            const p = everyone.find((q) => q.id === x.id)
            const ch = rep.changes?.find((c) => c.id === x.id)
            return (
              <li key={x.id} data-motm={rep.motmId === x.id ? 'true' : undefined}>
                <span className="squad-role">{ROLE_LABEL[x.role] || ''}</span>
                <span className="squad-name">
                  <span className="squad-name-main">{surname(p?.name)}{x.sub === 'on' ? ' ▲' : x.sub === 'off' ? ' ▼' : ''}</span>
                  {rep.motmId === x.id && <small className="ratings-motm">★ Man of the Match</small>}
                  {x.sub && <small className="squad-stats">{x.sub === 'on' ? 'came on' : 'taken off'}</small>}
                  {x.goals > 0 && <small className="squad-stats">{'⚽'.repeat(Math.min(x.goals, 4))}</small>}
                </span>
                {ch && <span className="ratings-change" data-up={ch.to > ch.from ? 'true' : undefined}>{ch.to > ch.from ? '▲' : '▼'} {ch.to}</span>}
                <b className="ratings-score" data-tier={x.rating >= 8 ? 'great' : x.rating >= 6.5 ? 'good' : x.rating < 5.5 ? 'poor' : undefined}>{x.rating?.toFixed(1)}</b>
              </li>
            )
          })}
        </ul>
        {rep.changes?.some((c) => c.to > c.from) && <p className="muted t-note">Good games build experience; a player under his potential steps up a point when he has enough.</p>}
      </section>
    )
  }
  if (!rep.ratings || !Object.keys(rep.ratings).length) return null
  return (
    <section className="card card-pad ratings-card" aria-label="Player ratings">
      <h2 className="saved-h">{title}</h2>
      <ul className="ratings-list">
        {CAP_ROLES.map((role) => {
          const p = career.squad[role]
          const r = rep.ratings[role]
          const ch = rep.changes?.find((c) => c.role === role)
          return (
            <li key={role} data-motm={rep.motm === role ? 'true' : undefined}>
              <span className="squad-role">{ROLE_LABEL[role]}</span>
              <span className="squad-name">
                <span className="squad-name-main">{surname(p?.name)}</span>
                {rep.motm === role && <small className="ratings-motm">★ Man of the Match</small>}
                {rep.goals?.[role] > 0 && <small className="squad-stats">{'⚽'.repeat(Math.min(rep.goals[role], 4))}</small>}
              </span>
              {ch && <span className="ratings-change" data-up={ch.to > ch.from ? 'true' : undefined}>{ch.to > ch.from ? '▲' : '▼'} {ch.to}</span>}
              <b className="ratings-score" data-tier={r >= 8 ? 'great' : r >= 6.5 ? 'good' : r < 5.5 ? 'poor' : undefined}>{r?.toFixed(1)}</b>
            </li>
          )
        })}
      </ul>
      {rep.changes?.some((c) => c.to > c.from) && <p className="muted t-note">Good games build experience; a player under his potential steps up a point when he has enough (young players need less).</p>}
    </section>
  )
}
