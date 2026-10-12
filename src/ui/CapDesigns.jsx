import { useState } from 'react'
import { CAP_DESIGNS, RARE_DESIGNS, designPatch, isDesign, isUnlocked } from '../data/TeamOptions'
import { useProgress } from '../state/unlocks'
import { useAccountStore } from '../state/accountStore'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'
import { isLagos } from '../platform'
import { useLagosStore } from '../lagos/lagosStore'
import { SHOP_DESIGNS, itemFor, naira } from '../data/shop'

/** Ready-made drink-cap designs, then the rare ones you earn. Tap one to put it on your caps. */
export default function CapDesigns({ config, onPick, disabled = false }) {
  const progress = useProgress()
  const signedIn = !!useAccountStore((s) => s.username)
  const [hint, setHint] = useState(null)
  // Inside Lagos Life, caps can also be bought
  const shop = isLagos()
  const owned = useLagosStore((s) => s.owned)
  const buying = useLagosStore((s) => s.buying)
  const shopNote = useLagosStore((s) => s.shopNote)
  const owns = (d) => shop && owned.includes(itemFor(d.key)?.productId)
  const pick = (d) => { playButtonSelect(); setHint(null); useLagosStore.getState().clearShopNote?.(); onPick(designPatch(d)) }
  const hinted = hint ? itemFor(hint) : null
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
      <div className="eyebrow" style={{ margin: '12px 0 8px' }}>{shop ? 'Rare caps — earn these, or buy one' : signedIn ? 'Rare caps — earn these' : 'Rare caps — sign in to earn these'}</div>
      <div className="cap-designs" role="group" aria-label="Rare designs">
        {RARE_DESIGNS.map((d) => {
          const open = isUnlocked(d, progress) || owns(d)
          const [have, target] = d.need(progress)
          const price = shop ? itemFor(d.key)?.price : null
          return (
            <button
              key={d.key}
              className="cap-design rare"
              data-locked={open ? undefined : 'true'}
              data-shop={shop ? 'true' : undefined}
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
              {!open && <small className="cap-design-need">{Math.min(have || 0, target)}/{target}{price ? ` · ${naira(price)}` : ''}</small>}
            </button>
          )
        })}
      </div>
      {shop && (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 8px' }}>Lagos Life exclusives</div>
          <div className="cap-designs" role="group" aria-label="Lagos Life exclusives">
            {SHOP_DESIGNS.map((d) => {
              const open = owns(d)
              return (
                <button
                  key={d.key}
                  className="cap-design rare"
                  data-locked={open ? undefined : 'true'}
                  data-shop="true"
                  aria-pressed={open && isDesign(config, d)}
                  disabled={disabled}
                  onClick={() => (open ? pick(d) : (playButtonSelect(), setHint(d.key)))}
                  aria-label={open ? d.name : `${d.name}: ${naira(d.price)}`}
                >
                  <span className="cap-design-art">
                    <CapPreview config={d} size={58} />
                    {!open && <span className="cap-design-lock"><Icon name="lock" size={16} /></span>}
                  </span>
                  <span>{d.name}</span>
                  {!open && <small className="cap-design-need">{naira(d.price)}</small>}
                </button>
              )
            })}
          </div>
        </>
      )}
      {hint && shop && hinted ? (
        <div className="cap-buy" role="group" aria-label={`Get ${hinted.design.name}`}>
          <p className="cap-design-hint">
            {hinted.earnable ? `${hinted.design.hint} to unlock ${hinted.design.name} for free, or get it now.` : `${hinted.design.name} is a Lagos Life exclusive.`}
          </p>
          <button className="btn btn-gold btn-block" disabled={!!buying} onClick={() => { playButtonSelect(); useLagosStore.getState().buy(hinted.productId, hinted.design.name) }}>
            {buying === hinted.productId ? 'Opening Lagos Life…' : `Buy for ${naira(hinted.price)}`}
          </button>
          <p className="muted t-note">Looks only. Caps never play differently.</p>
        </div>
      ) : hint && <p className="cap-design-hint" role="status">{RARE_DESIGNS.find((d) => d.key === hint)?.hint} to unlock it.</p>}
      {shop && shopNote && <p className={shopNote.tone === 'bad' ? 't-warn' : 'cap-design-hint'} role="status">{shopNote.text}</p>}
    </div>
  )
}
