import { useState } from 'react'
import { RARE_DESIGNS, designPatch, isDesign, isUnlocked } from '../data/TeamOptions'
import { useCapDesigns } from '../game/capOverrides'
import { useProgress } from '../state/unlocks'
import { useAccountStore } from '../state/accountStore'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'
import { isLagos } from '../platform'
import { useLagosStore } from '../lagos/lagosStore'
import { SHOP_DESIGNS, itemFor, naira, SHOP_OPEN } from '../data/shop'
import { useWalletStore } from '../state/walletStore'

// A plain cap in the team's own colours: the starting point for designing your own
export const PLAIN = { key: 'plain', name: 'Plain', pattern: 'none', badge: 'none', finish: 'matte', capText: '' }
const DEFAULT_KIT = { primary: '#D32F2F', edge: '#FFD700' }

/** Every design this player can put on now: plain, the drink caps, and the rare or bought ones they own. */
export function useOpenDesigns(defaultKit = DEFAULT_KIT) {
  const designs = useCapDesigns()
  const progress = useProgress()
  const owned = useLagosStore((s) => s.owned)
  const walletCaps = useWalletStore((s) => s.caps)
  const owns = (d) => walletCaps.includes(d.key) || (isLagos() && owned.includes(itemFor(d.key)?.productId))
  return [
    { ...PLAIN, primary: defaultKit.primary, edge: defaultKit.edge },
    ...designs,
    ...RARE_DESIGNS.filter((d) => isUnlocked(d, progress) || owns(d)),
    ...(isLagos() ? SHOP_DESIGNS.filter(owns) : []),
  ]
}

/**
 * A plain cap to start from, the ready-made drink-cap designs, then the rare
 * ones you earn. Tap one to put it on your caps. `defaultKit` gives the plain
 * cap its colours (the team's defaults).
 */
export default function CapDesigns({ config, onPick, disabled = false, defaultKit = DEFAULT_KIT, section = 'all', onCustom = null }) {
  const plain = { ...PLAIN, primary: defaultKit.primary, edge: defaultKit.edge }
  const designs = useCapDesigns()
  const progress = useProgress()
  const signedIn = !!useAccountStore((s) => s.username)
  const [hint, setHint] = useState(null)
  // Inside Lagos Life, caps can also be bought
  const shop = isLagos() && SHOP_OPEN
  const owned = useLagosStore((s) => s.owned)
  const buying = useLagosStore((s) => s.buying)
  const shopNote = useLagosStore((s) => s.shopNote)
  // Anything already bought stays yours, shop open or not
  const walletCaps = useWalletStore((s) => s.caps)
  const owns = (d) => walletCaps.includes(d.key) || (isLagos() && owned.includes(itemFor(d.key)?.productId))
  const pick = (d) => { playButtonSelect(); setHint(null); useLagosStore.getState().clearShopNote?.(); onPick(designPatch(d)) }
  const hinted = hint ? itemFor(hint) : null
  const show = (s) => section === 'all' || section === s
  // Caps you can only win (weekly goals, cups, the Weekend Cup) stay out of sight until you have them
  const rare = RARE_DESIGNS.filter((d) => !d.hidden || isUnlocked(d, progress) || owns(d))
  // "Your own": the club's own cap, made in the cap maker (selected when it isn't one of the ready-made looks)
  const allDesigns = [...(onCustom ? [] : [plain]), ...designs, ...RARE_DESIGNS, ...SHOP_DESIGNS]
  const isCustom = !allDesigns.some((d) => isDesign(config, d))
  return (
    <div className="cap-designs-wrap">
      {show('free') && <div className="cap-designs" role="group" aria-label="Ready-made designs">
        {onCustom ? (
          <button className="cap-design cap-design-own" aria-pressed={isCustom} disabled={disabled} onClick={() => { playButtonSelect(); onCustom() }}>
            <span className="cap-design-art"><CapPreview config={isCustom ? config : { ...config, ...designPatch(plain) }} size={58} /><span className="cap-design-edit" aria-hidden>✎</span></span>
            <span>Your own</span>
          </button>
        ) : (
          <button className="cap-design" aria-pressed={isDesign(config, plain)} disabled={disabled} onClick={() => pick(plain)}>
            <CapPreview config={plain} size={58} />
            <span>Plain</span>
          </button>
        )}
        {designs.map((d) => (
          <button key={d.key} className="cap-design" aria-pressed={isDesign(config, d)} disabled={disabled} onClick={() => pick(d)}>
            <CapPreview config={d} size={58} />
            <span>{d.name}</span>
          </button>
        ))}
      </div>}
      {show('earn') && <>
      <div className="eyebrow" style={{ margin: section === 'all' ? '12px 0 8px' : '0 0 8px' }}>{shop ? 'Rare caps — earn these, or buy one' : signedIn ? 'Rare caps — earn these' : 'Rare caps — sign in to earn these'}</div>
      <div className="cap-designs" role="group" aria-label="Rare designs">
        {rare.map((d) => {
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
      </>}
      {isLagos() && show('lagos') && (
        <>
          <div className="eyebrow" style={{ margin: section === 'all' ? '12px 0 8px' : '0 0 8px' }}>Lagos Life exclusives</div>
          <div className="cap-designs" role="group" aria-label="Lagos Life exclusives">
            {SHOP_DESIGNS.map((d) => {
              const open = owns(d)
              return (
                <button
                  key={d.key}
                  className="cap-design rare"
                  data-locked={open ? undefined : 'true'}
                  data-shop={shop ? 'true' : undefined}
                  aria-pressed={open && isDesign(config, d)}
                  disabled={disabled}
                  onClick={() => (open ? pick(d) : (playButtonSelect(), setHint(d.key)))}
                  aria-label={open ? d.name : shop ? `${d.name}: ${naira(d.price)}` : `${d.name}: in the shop soon`}
                >
                  <span className="cap-design-art">
                    <CapPreview config={d} size={58} />
                    {!open && <span className="cap-design-lock"><Icon name="lock" size={16} /></span>}
                  </span>
                  <span>{d.name}</span>
                  {!open && <small className="cap-design-need">{shop ? naira(d.price) : 'Soon'}</small>}
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
      ) : hint && <p className="cap-design-hint" role="status">{RARE_DESIGNS.find((d) => d.key === hint) ? `${RARE_DESIGNS.find((d) => d.key === hint).hint} to unlock it.` : 'In the Lagos Life shop soon.'}</p>}
      {shop && shopNote && <p className={shopNote.tone === 'bad' ? 't-warn' : 'cap-design-hint'} role="status">{shopNote.text}</p>}
    </div>
  )
}
