import { useState } from 'react'
import { CAP_DESIGNS, RARE_DESIGNS, designPatch, isDesign, isUnlocked } from '../data/TeamOptions'
import { useProgress } from '../state/unlocks'
import { useAccountStore } from '../state/accountStore'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

/** Ready-made drink-cap designs, then the rare ones you earn. Tap one to put it on your caps. */
export default function CapDesigns({ config, onPick, disabled = false }) {
  const progress = useProgress()
  const signedIn = !!useAccountStore((s) => s.username)
  const [hint, setHint] = useState(null)
  const pick = (d) => { playButtonSelect(); setHint(null); onPick(designPatch(d)) }
  return (
    <div className="cap-designs-wrap">
      <div className="cap-designs" role="group" aria-label="Ready-made designs">
        {CAP_DESIGNS.map((d) => (
          <button key={d.key} className="cap-design" aria-pressed={isDesign(config, d)} disabled={disabled} onClick={() => pick(d)}>
            <CapPreview config={d} size={58} />
            <span>{d.name}</span>
          </button>
        ))}
      </div>
      <div className="eyebrow" style={{ margin: '12px 0 8px' }}>{signedIn ? 'Rare caps — earn these' : 'Rare caps — sign in to earn these'}</div>
      <div className="cap-designs" role="group" aria-label="Rare designs">
        {RARE_DESIGNS.map((d) => {
          const open = isUnlocked(d, progress)
          const [have, target] = d.need(progress)
          return (
            <button
              key={d.key}
              className="cap-design rare"
              data-locked={open ? undefined : 'true'}
              aria-pressed={open && isDesign(config, d)}
              disabled={disabled}
              onClick={() => (open ? pick(d) : (playButtonSelect(), setHint(d.key)))}
              aria-label={open ? d.name : `${d.name} — locked: ${d.hint}`}
            >
              <span className="cap-design-art">
                <CapPreview config={d} size={58} />
                {!open && <span className="cap-design-lock"><Icon name="lock" size={16} /></span>}
              </span>
              <span>{d.name}</span>
              {!open && <small className="cap-design-need">{Math.min(have || 0, target)}/{target}</small>}
            </button>
          )
        })}
      </div>
      {hint && <p className="cap-design-hint" role="status">{RARE_DESIGNS.find((d) => d.key === hint)?.hint} to unlock it.</p>}
    </div>
  )
}
