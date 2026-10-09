import { CAP_DESIGNS, designPatch, isDesign } from '../data/TeamOptions'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'

/** A grid of ready-made drink-cap designs; tap one to put it on your caps. */
export default function CapDesigns({ config, onPick, disabled = false }) {
  return (
    <div className="cap-designs" role="group" aria-label="Ready-made designs">
      {CAP_DESIGNS.map((d) => {
        const on = isDesign(config, d)
        return (
          <button
            key={d.key}
            className="cap-design"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => { playButtonSelect(); onPick(designPatch(d)) }}
          >
            <CapPreview config={d} size={58} />
            <span>{d.name}</span>
          </button>
        )
      })}
    </div>
  )
}
