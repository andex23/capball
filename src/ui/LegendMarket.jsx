import { useState } from 'react'
import { seasonLegends, TRAIT_LABEL } from '../data/Legends'
import { money, ovrOf } from '../game/squad'
import { legendUnavailable } from '../game/transfers'
import { useCareerStore } from '../state/careerStore'
import CapPreview from './CapPreview'

export default function LegendMarket({ career }) {
  const [message, setMessage] = useState('')
  return <section className="legend-market" aria-label="Season legends">
    <h3 className="saved-h">Season {career.season} legends</h3>
    {seasonLegends(career.season).map((p) => {
      const reason = legendUnavailable(career, p)
      return <article className="legend-offer" key={p.id}>
        <CapPreview config={{ primary: '#cf9a36', edge: '#fff1a7', finish: 'chrome', badge: 'star', capText: p.name }} size={54} />
        <div><h4>{p.name}</h4><small>{p.pos} · {ovrOf(p.attrs, p.pos)} OVR · age {p.age}</small>
          <p>{p.story}</p><b>{TRAIT_LABEL[p.trait]}</b>
        </div>
        <button className="btn btn-secondary" disabled={!!reason} onClick={() => {
          const r = useCareerStore.getState().signLegend(p.id)
          setMessage(r === true ? p.name + ' joins your reserves. Move him into the matchday squad to play.' : r.error)
        }}>{reason || 'Sign for ' + money(p.fee)}</button>
      </article>
    })}
    {message && <p role="status">{message}</p>}
  </section>
}

