import { useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { DIVISIONS } from '../game/career'
import {
  transferWindow, playedThisSeason, squadSize, MAX_SQUAD, YOUTH_MAX, inSlot, offersFor, loanClub, releaseCost, valueOf,
} from '../game/transfers'
import { wageOf } from '../game/club'
import { fitnessOf, contractOf, renewTerms } from '../game/clubLife'
import { formOf, ROLE_LABEL, squadRatings, averageRating, WINDOW_AFTER, windowDeadline, potentialRange, ovrAt, migratePlayer, money } from '../game/squad'
import { CAP_ROLES } from '../data/TeamOptions'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'
import { Rating, Attrs, Coins, DIV_SHORT } from './PlayerBits'
import TransferMarket from './TransferMarket'

const DEAL_LINE = {
  in: (d) => `Signed ${d.name}${d.club ? ` from ${d.club}` : ' on a free'} · ${money(d.fee)}`,
  out: (d) => `Sold ${d.name} to ${d.club} · ${money(d.fee)}`,
  released: (d) => `Released ${d.name} · paid ${money(d.fee)}`,
  loan: (d) => `Loaned ${d.name} to ${d.club}`,
}

/** Your squad of up to fifteen, the youth team, players out on loan and the transfer market. */
export default function SquadPanel({ career }) {
  const [marketOpen, setMarketOpen] = useState(false)
  const [starting, setStarting] = useState(null) // bench index being brought into the six
  const [manage, setManage] = useState(null)     // slot of the player being managed
  const [youth, setYouth] = useState(null)       // youth-team index being managed
  const win = transferWindow(career)
  const played = playedThisSeason(career.league)
  const mine = averageRating(squadRatings(career.squad))
  const rivals = career.league.teams.filter((t) => t.cpu && Number.isFinite(t.ovr))
  const leagueAvg = rivals.length ? Math.round(rivals.reduce((a, t) => a + t.ovr, 0) / rivals.length) : null
  const opensAt = WINDOW_AFTER.find((n) => n > played)
  const size = squadSize(career)
  const shutLine = opensAt != null
    ? `The transfer window opens after matchday ${opensAt}. Free agents can sign any time.`
    : 'The transfer window opens again before next season. Free agents can sign any time.'
  const row = (slot, p, label, extra = null) => (
    <li key={slot}>
      <span className="squad-role">{label}</span>
      <span className="squad-name">
        <span className="squad-name-main">{p.name}</span>
        <small className="squad-stats">{p.pos !== label && label !== 'BENCH' && label !== 'RES' ? `${p.pos} playing ${label} · ` : ''}Age {p.age} · POT {potentialRange(p)}{p.apps > 0 ? ` · ${p.goals || 0} goal${p.goals === 1 ? '' : 's'} · form ${formOf(p)}` : ''}</small>
        <PlayerTags p={p} />
        <Attrs attrs={p.attrs} />
      </span>
      <Rating value={CAP_ROLES.includes(slot) ? ovrAt(p, slot) : p.rating} />
      <span className="squad-actions">
        {extra}
        <button className="btn btn-secondary squad-buy" aria-label={`Manage ${p.name}`} onClick={() => { playButtonSelect(); setManage(slot) }}>
          <Icon name="settings" size={14} />
        </button>
      </span>
    </li>
  )

  return (
    <section className="card card-pad squad-card" aria-label="Squad">
      <div className="squad-head">
        <h2 className="saved-h">Squad <small className="squad-count" data-full={size >= MAX_SQUAD ? 'true' : undefined}>{size} of {MAX_SQUAD}</small></h2>
        <Coins n={career.coins} />
      </div>
      <p className="muted t-note">Six start and four sit on the bench; up to five more are reserves. PWR: how hard he flicks · SHT: how straight a hard flick goes · PAS: how straight a soft one goes · PHY: how hard he is to knock aside. Your OVR is <b>{mine}</b>{leagueAvg ? <>; the {DIVISIONS[career.level].name} averages <b>{leagueAvg}</b></> : null}.</p>

      <h3 className="squad-sub-h">Starting six</h3>
      <ul className="squad-list squad-rows">
        {CAP_ROLES.map((role) => row(role, migratePlayer(career.squad[role], role), ROLE_LABEL[role]))}
      </ul>

      <h3 className="squad-sub-h">Bench</h3>
      <ul className="squad-list squad-rows">
        {(career.bench || []).map((p, i) => row(`bench:${i}`, p, p.pos,
          <button className="btn btn-secondary squad-buy" onClick={() => { playButtonSelect(); setStarting(i) }}>Start</button>))}
      </ul>
      <p className="muted t-note">Make up to three substitutions in a match from the pause menu. Players who never get a game slide a little over the summer.</p>

      <h3 className="squad-sub-h">Reserves</h3>
      {(career.reserves || []).length > 0
        ? <ul className="squad-list squad-rows">{career.reserves.map((p, i) => row(`reserve:${i}`, p, p.pos))}</ul>
        : <p className="muted t-note">No reserves. Sign players from the market or promote from the youth team, up to a squad of {MAX_SQUAD}.</p>}
      {size > MAX_SQUAD && <p className="club-alert" role="alert">Your squad is over {MAX_SQUAD} after loans came back. Sell, release or loan out {size - MAX_SQUAD} before you can sign anyone.</p>}

      {(career.loans || []).length > 0 && (
        <>
          <h3 className="squad-sub-h">Out on loan</h3>
          <ul className="squad-list squad-simple">
            {career.loans.map((l) => (
              <li key={l.player.id}>
                <span className="squad-role">{l.player.pos}</span>
                <span className="squad-name"><span className="squad-name-main">{l.player.name}</span><small className="squad-stats">At {l.club} ({DIVISIONS[l.level]?.name}) until the summer</small></span>
                <Rating value={l.player.rating} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="squad-sub-h">Youth team · {(career.youthTeam || []).length} of {YOUTH_MAX}</h3>
      {(career.youthTeam || []).length > 0 ? (
        <ul className="squad-list squad-rows">
          {career.youthTeam.map((p, i) => (
            <li key={p.id}>
              <span className="squad-role">{p.pos}</span>
              <span className="squad-name">
                <span className="squad-name-main">{p.name}</span>
                <small className="squad-stats">Age {p.age} · POT {potentialRange(p)}</small>
                <Attrs attrs={p.attrs} />
              </span>
              <Rating value={p.rating} />
              <span className="squad-actions">
                <button className="btn btn-secondary squad-buy" onClick={() => { playButtonSelect(); setYouth(i) }}>
                  <Icon name="settings" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="muted t-note">The youth team is empty. Your academy sends up new players every summer.</p>}
      <p className="muted t-note">Youth players don’t count towards the {MAX_SQUAD} and aren’t paid. They grow fast; promote them when they’re ready. At 19 they must move up or leave.</p>

      {win
        ? <p className="t-note squad-window">The {win.index === 0 ? 'pre-season' : 'mid-season'} transfer window is open. It shuts when you play matchday {windowDeadline(win.index)} ({windowDeadline(win.index) - played} match{windowDeadline(win.index) - played === 1 ? '' : 'es'} left).</p>
        : <p className="muted t-note"><Icon name="lock" size={13} /> {shutLine}</p>}
      <button className="btn btn-gold btn-block" onClick={() => { playButtonSelect(); setMarketOpen(true) }}>
        <Icon name="next" size={18} /> Transfer market
      </button>

      {(career.deals || []).length > 0 && (
        <ul className="club-lines squad-deals" aria-label="Recent transfers">
          {career.deals.slice(0, 4).map((d, i) => <li key={i}><span>{DEAL_LINE[d.type]?.(d)}</span></li>)}
        </ul>
      )}
      {career.biz?.lastMatch && <p className="muted t-note">Last match: <Coins n={career.lastEarned} /> after wages. The full books are under Club business.</p>}

      {starting != null && career.bench?.[starting] && <StartFromBench career={career} index={starting} onDone={() => setStarting(null)} />}
      {manage && inSlot(career, manage) && <PlayerSheet career={career} slot={manage} onDone={() => setManage(null)} />}
      {youth != null && career.youthTeam?.[youth] && <YouthSheet career={career} index={youth} onDone={() => setYouth(null)} />}
      {marketOpen && <TransferMarket career={career} onClose={() => setMarketOpen(false)} />}
    </section>
  )
}

/** Contract, fitness and morale, when there's something to say. */
function PlayerTags({ p }) {
  const fit = fitnessOf(p)
  const last = contractOf(p) <= 1
  if (fit >= 100 && !last && !p.wantsAway) return null
  return (
    <span className="squad-tags">
      {fit < 100 && <span data-tone={fit < 70 ? 'bad' : 'warn'}>Fit {fit}%</span>}
      {last && <span data-tone="warn">Contract ends this season</span>}
      {p.wantsAway && <span data-tone="bad">Wants to leave</span>}
    </span>
  )
}

/** Bring a bench player into the starting six in place of someone. */
function StartFromBench({ career, index, onDone }) {
  const p = career.bench[index]
  const roles = CAP_ROLES.filter((r) => (r === 'gk') === (p.pos === 'GK'))
  return (
    <Modal title={`Start ${p.name}`} onClose={onDone}>
      <p className="muted t-note">{p.pos} · OVR {p.rating}. Who drops to the bench?</p>
      <ul className="squad-list squad-simple">
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

/** One of your players: his details, and selling, loaning, releasing or moving him. */
function PlayerSheet({ career, slot, onDone }) {
  const [error, setError] = useState(null)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const p = inSlot(career, slot)
  const store = useCareerStore.getState()
  const win = transferWindow(career)
  const isReserve = slot.startsWith('reserve:')
  const where = isReserve ? 'Reserves' : slot.startsWith('bench:') ? 'Bench' : `Starting six · ${ROLE_LABEL[slot]}`
  const offers = offersFor(career, slot)
  const loanTo = win ? loanClub(career, slot) : null
  const run = (r) => { if (r === true) { playConfirm(); onDone() } else setError(r?.error || 'That can’t be done.') }
  // A reserve can come into the ten in place of a starter or bench player (keeper for keeper)
  const keeper = p.pos === 'GK'
  const swaps = isReserve ? [
    ...CAP_ROLES.filter((r) => (r === 'gk') === keeper).map((role) => ({ to: role, label: ROLE_LABEL[role], out: migratePlayer(career.squad[role], role), here: ovrAt(p, role), was: ovrAt(migratePlayer(career.squad[role], role), role) })),
    ...(career.bench || []).map((out, i) => ({ to: `bench:${i}`, label: 'BENCH', out, here: p.rating, was: out.rating })).filter(({ out }) => (out.pos === 'GK') === keeper),
  ] : []
  return (
    <Modal title={p.name} onClose={onDone}>
      <div className="player-card">
        <Rating value={CAP_ROLES.includes(slot) ? ovrAt(p, slot) : p.rating} />
        <div>
          <p className="player-card-line"><b>{p.pos}</b> · Age {p.age} · POT {potentialRange(p)} · {where}</p>
          <Attrs attrs={p.attrs} />
          <p className="muted t-note">Value {money(valueOf(p))} · Wages {money(wageOf(p))} a match{p.apps ? ` · ${p.apps} app${p.apps === 1 ? '' : 's'}, ${p.goals || 0} goal${p.goals === 1 ? '' : 's'}` : ''}</p>
          <p className="muted t-note">Fitness {fitnessOf(p)}%{fitnessOf(p) < 100 ? ' (a tired player flicks softer; rest him a match to recover)' : ''} · Contract: {contractOf(p) <= 1 ? 'ends this season' : `${contractOf(p)} seasons left`}</p>
          {p.wantsAway && <p className="t-note career-warning">{p.name} is unhappy and wants to leave. He won’t sign a new deal; clubs know he’s available.</p>}
        </div>
      </div>

      {contractOf(p) <= 2 && !p.wantsAway && (() => {
        const t = renewTerms(career, p)
        return (
          <>
            <h3 className="squad-sub-h">New contract</h3>
            <p className="muted t-note">{t.years} seasons at {money(Math.round(wageOf(p) / (p.wageX || 1) * t.wageX))} a match (a {Math.round((t.rise - 1) * 100)}% rise). {contractOf(p) <= 1 ? 'If you don’t renew, he leaves on a free in the summer.' : ''}</p>
            <button className="btn btn-gold btn-block" onClick={() => run(store.renew(slot))}>Offer {t.years}-season deal</button>
          </>
        )
      })()}

      {swaps.length > 0 && (
        <>
          <h3 className="squad-sub-h">Bring him into the matchday ten</h3>
          <ul className="squad-list squad-simple">
            {swaps.map(({ to, label, out, here, was }) => (
              <li key={to}>
                <span className="squad-role">{label}</span>
                <span className="squad-name">{out.name} <Rating value={was} /> → <b>{here}</b></span>
                <button className="btn btn-gold squad-buy" onClick={() => { if (store.promote(Number(slot.split(':')[1]), to)) { playConfirm(); onDone() } }}>Swap</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="squad-sub-h">Sell</h3>
      {!win ? <p className="muted t-note"><Icon name="lock" size={13} /> Clubs only buy while a transfer window is open.</p>
        : offers.length === 0 ? <p className="muted t-note">No club has made an offer. Clubs bid for players who would get into their team.</p>
          : (
            <ul className="squad-list squad-simple">
              {offers.map((o) => (
                <li key={o.clubId}>
                  <span className="squad-role">{DIV_SHORT[o.level]}</span>
                  <span className="squad-name"><span className="squad-name-main">{o.club}</span><small className="squad-stats">{DIVISIONS[o.level]?.name}</small></span>
                  <button className="btn btn-gold squad-buy" onClick={() => run(store.sell(slot, o.clubId))}>Accept {money(o.fee)}</button>
                </li>
              ))}
            </ul>
          )}

      <h3 className="squad-sub-h">Loan out</h3>
      {!win ? <p className="muted t-note"><Icon name="lock" size={13} /> Loans are agreed in a transfer window.</p>
        : loanTo ? (
          <>
            <p className="muted t-note">{loanTo.name} ({DIVISIONS[loanTo.level].name}) will play him until the summer. He frees a squad place, they pay his wages, and regular games help him grow.</p>
            <button className="btn btn-secondary btn-block" onClick={() => run(store.loan(slot))}>Loan to {loanTo.name}</button>
          </>
        ) : <p className="muted t-note">No club wants him on loan: he wouldn’t get games anywhere.</p>}

      <h3 className="squad-sub-h">Release</h3>
      {!confirmRelease
        ? <button className="btn btn-ghost btn-block" onClick={() => setConfirmRelease(true)}>Release him ({money(releaseCost(p))} to pay off his wages)</button>
        : <button className="btn btn-danger btn-block" onClick={() => run(store.release(slot))}>Yes, release {p.name}</button>}

      {error && <p className="club-alert" role="alert">{error}</p>}
    </Modal>
  )
}

/** A youth-team player: promote him to the squad or let him go. */
function YouthSheet({ career, index, onDone }) {
  const [error, setError] = useState(null)
  const p = career.youthTeam[index]
  const store = useCareerStore.getState()
  const run = (r) => { if (r === true) { playConfirm(); onDone() } else setError(r?.error || 'That can’t be done.') }
  return (
    <Modal title={p.name} onClose={onDone}>
      <div className="player-card">
        <Rating value={p.rating} />
        <div>
          <p className="player-card-line"><b>{p.pos}</b> · Age {p.age} · POT {potentialRange(p)} · Youth team</p>
          <Attrs attrs={p.attrs} />
          <p className="muted t-note">Value {money(valueOf(p))}. Promoting him puts him in the reserves and on wages of {money(wageOf(p))} a match.</p>
        </div>
      </div>
      <button className="btn btn-gold btn-block" onClick={() => run(store.promoteYouth(index))}>Promote to the squad</button>
      <button className="btn btn-ghost btn-block" onClick={() => run(store.releaseYouth(index))}>Release him</button>
      {error && <p className="club-alert" role="alert">{error}</p>}
    </Modal>
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
