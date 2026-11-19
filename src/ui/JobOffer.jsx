/**
 * A club wants you as manager. The offer card: who they are, what you keep,
 * what you get, and take it or stay. Used after a big season and after the sack.
 */
import { DIVISIONS, TARGETS, targetFor } from '../game/career'
import { offerDetails } from '../game/jobs'
import { money, squadRatings, averageRating } from '../game/squad'
import { useCareerStore } from '../state/careerStore'
import { playConfirm, playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'

const WHY = {
  promoted: (c) => `We’ve watched you take ${c} up. We want a manager who wins.`,
  champions: (c) => `Champions with ${c}. Come and do it here.`,
  cup: (c) => `You won the Cap Cup with ${c}. We want that here.`,
  sacked: () => 'We know it ended badly. We think you deserve another go.',
}

export function JobOfferCard({ career, overlay = false }) {
  const offer = career.jobOffer
  const d = offer && offerDetails(career, offer)
  if (!d) return null
  const mine = averageRating(squadRatings(career.squad))
  const take = () => { playConfirm(); useCareerStore.getState().takeJob() }
  const stay = () => { playButtonSelect(); useCareerStore.getState().turnDownJob() }
  const card = (
    <section className="job-offer" role={overlay ? 'dialog' : undefined} aria-label={`Job offer from ${offer.name}`}>
      <div className="job-tab">📨 A job offer</div>
      <div className="job-head">
        <CapPreview config={d.kit} size={64} />
        <div>
          <b>{offer.name} want you</b>
          <small>{d.division} · squad OVR {d.ovr} · budget {money(d.budget)}</small>
        </div>
      </div>
      <p className="job-quote">“{(WHY[offer.reason] || WHY.promoted)(career.club.name)} The job is yours if you want it.”</p>
      <div className="job-cols">
        <div><small>You keep</small><span>Your manager rating</span><span>Trophies and records</span><span>Head-to-head records</span></div>
        <div><small>You get</small><span>Their squad (OVR {d.ovr})</span><span>Budget {money(d.budget)}</span><span>Board: {TARGETS[targetFor(offer.level)].replace(/:.*/, '').toLowerCase()}</span></div>
      </div>
      {!career.sacked && (
        <p className="job-stay">Stay: {career.club.name} (OVR {mine}), {DIVISIONS[career.level].name}, {money(career.coins)}. The fans will love you for it.</p>
      )}
      <button className="btn btn-gold btn-lg btn-block" onClick={take}>Take the job</button>
      {!career.sacked && <button className="btn btn-secondary btn-block" onClick={stay}>Stay at {career.club.name}</button>}
      <p className="job-note">Your old club and its players take {offer.name}’s place in the {d.division}.</p>
    </section>
  )
  return overlay ? <div className="sr-overlay">{card}</div> : card
}
