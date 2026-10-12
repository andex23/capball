import { useState } from 'react'
import { DIVISIONS } from '../game/career'
import { clubOvr, bestSix, hydrate, TIER_LABEL, standingOf, STANDING_LABEL } from '../game/world'
import { potentialRange, squadRatings, averageRating } from '../game/squad'
import { playButtonSelect } from '../audio/SoundManager'
import { Rating } from './PlayerBits'

/** The clubs in your division: how strong each is, its star, and its whole squad. */
export default function LeagueClubs({ career }) {
  const [open, setOpen] = useState(null)
  const clubs = (career.world?.clubs || []).filter((c) => c.level === career.level)
  if (!clubs.length) return null
  const mine = averageRating(squadRatings(career.squad))
  const rows = [...clubs.map((c) => ({ c, ovr: clubOvr(c) })), { c: null, ovr: mine }].sort((a, b) => b.ovr - a.ovr)
  return (
    <section className="card card-pad" aria-label="Clubs in your division">
      <h2 className="saved-h">Clubs in the {DIVISIONS[career.level].name}</h2>
      <p className="muted t-note">Each club’s OVR is its best six. Tap a club to see its squad.</p>
      <ul className="league-clubs">
        {rows.map(({ c, ovr }) => {
          if (!c) {
            return (
              <li key="me" data-mine="true">
                <div className="league-club-row">
                  <span className="league-club-name"><b>{career.club.name}</b><small>Your club</small></span>
                  <Rating value={ovr} />
                </div>
              </li>
            )
          }
          const players = c.players.map(hydrate).sort((a, b) => b.rating - a.rating)
          const star = players[0]
          const six = new Set(Object.values(bestSix(c.players)).map((p) => p.id))
          const isOpen = open === c.id
          return (
            <li key={c.id}>
              <button className="league-club-row" aria-expanded={isOpen} onClick={() => { playButtonSelect(); setOpen(isOpen ? null : c.id) }}>
                <span className="league-club-name"><b>{c.name}</b><small>{TIER_LABEL[c.tier]} · star: {star.name} ({star.rating})</small></span>
                <Rating value={ovr} />
              </button>
              {isOpen && (
                <ul className="squad-list squad-simple league-club-squad">
                  {players.map((p) => (
                    <li key={p.id}>
                      <span className="squad-role">{p.pos}</span>
                      <span className="squad-name">
                        <span className="squad-name-main">{p.name}</span>
                        <small className="squad-stats">{p.age} · POT {potentialRange(p)} · {six.has(p.id) ? 'Plays' : STANDING_LABEL[standingOf(p, c)]}</small>
                      </span>
                      <Rating value={p.rating} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
