import { useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { transferWindow, playedThisSeason, DIVISIONS } from '../game/career'
import { formOf, ROLE_LABEL, priceOf, sellValue, squadRatings, clubRatings, averageRating, WINDOW_AFTER } from '../game/squad'
import { CAP_ROLES } from '../data/TeamOptions'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'

function Rating({ value }) {
  const tier = value >= 75 ? 'gold' : value >= 60 ? 'silver' : value >= 45 ? 'bronze' : 'plain'
  return <span className="squad-rating" data-tier={tier} aria-label={`Rating ${value}`}>{value}</span>
}

function Coins({ n }) {
  return <span className="squad-coins"><i aria-hidden="true" />{n.toLocaleString()}</span>
}

/** Your six players, your coins and the transfer window. */
export default function SquadPanel({ career }) {
  const [marketOpen, setMarketOpen] = useState(false)
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
        <h2 className="saved-h">Squad</h2>
        <Coins n={career.coins} />
      </div>
      <p className="muted t-note">Better players flick harder. Your team averages <b>{mine}</b>; clubs in the {DIVISIONS[career.level].name} average <b>{leagueAvg}</b>.</p>
      <ul className="squad-list">
        {CAP_ROLES.map((role) => {
          const p = career.squad[role]
          return (
            <li key={role}>
              <span className="squad-role">{ROLE_LABEL[role]}</span>
              <span className="squad-shirt">{career.club.numbers?.[role] ?? ''}</span>
              <span className="squad-name">
                <span className="squad-name-main">{p.name}</span>
                {p.apps > 0 && <small className="squad-stats">{p.goals || 0} goal{p.goals === 1 ? '' : 's'} · form {formOf(p)}</small>}
              </span>
              <Rating value={p.rating} />
            </li>
          )
        })}
      </ul>
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
      {career.lastEarned > 0 && <p className="muted t-note">Last match earned <Coins n={career.lastEarned} />. Wins pay 60, draws 25, plus 5 a goal.</p>}
      {marketOpen && win && <TransferMarket career={career} market={win.market} onClose={() => setMarketOpen(false)} />}
    </section>
  )
}

function TransferMarket({ career, market, onClose }) {
  const [buying, setBuying] = useState(null)
  return (
    <Modal title="Transfer market" onClose={onClose}>
      <div className="squad-head"><span className="muted">You have</span><Coins n={career.coins} /></div>
      {market.length === 0 && <p className="muted">You’ve signed everyone on offer this window.</p>}
      <ul className="squad-list squad-market">
        {market.map((p) => {
          const fee = priceOf(p.rating)
          return (
            <li key={p.id}>
              <span className="squad-role">{p.keeper ? 'GK' : 'FIELD'}</span>
              <span className="squad-name">
                <span className="squad-name-main">{p.name}</span>
                {p.apps > 0 && <small className="squad-stats">{p.goals || 0} goal{p.goals === 1 ? '' : 's'} · form {formOf(p)}</small>}
              </span>
              <Rating value={p.rating} />
              <button className="btn btn-secondary squad-buy" onClick={() => { playButtonSelect(); setBuying(p) }}><Coins n={fee} /></button>
            </li>
          )
        })}
      </ul>
      <p className="muted t-note">Signing a player lets the one in that spot go for {Math.round(0.6 * 100)}% of his value. Keepers only replace your keeper.</p>
      {buying && <SignFor career={career} player={buying} onDone={() => setBuying(null)} />}
    </Modal>
  )
}

/** Pick who makes way for the new signing. */
function SignFor({ career, player, onDone }) {
  const fee = priceOf(player.rating)
  const roles = CAP_ROLES.filter((r) => (r === 'gk') === !!player.keeper)
  const [error, setError] = useState(null)
  const sign = (role) => {
    if (useCareerStore.getState().buy(player.id, role)) { playConfirm(); onDone() }
    else setError('Not enough coins for that deal.')
  }
  return (
    <div className="squad-sign" role="group" aria-label={`Sign ${player.name}`}>
      <p><b>{player.name}</b> ({player.rating}) costs <Coins n={fee} />. Who makes way?</p>
      <ul className="squad-list">
        {roles.map((role) => {
          const out = career.squad[role]
          const cost = fee - sellValue(out.rating)
          const afford = career.coins >= cost
          return (
            <li key={role}>
              <span className="squad-role">{ROLE_LABEL[role]}</span>
              <span className="squad-name">{out.name} <Rating value={out.rating} /></span>
              <button className="btn btn-gold squad-buy" disabled={!afford} onClick={() => sign(role)}>
                {cost <= 0 ? `+${-cost}` : `−${cost}`}
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
      {rep.changes?.some((c) => c.to > c.from) && <p className="muted t-note">Big games make players better — a rating of 7.5 or more can earn a point.</p>}
    </section>
  )
}
