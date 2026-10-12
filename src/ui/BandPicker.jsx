import { useState } from 'react'
import { CAP_ROLES, playerNames } from '../data/TeamOptions'
import { BANDS, bandEarned } from '../data/bands'
import { bandProductId, naira } from '../data/shop'
import { useProgress } from '../state/unlocks'
import { isLagos } from '../platform'
import { useLagosStore } from '../lagos/lagosStore'
import { playButtonSelect } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

/**
 * A rubber band for each player: pick a player, then a band. Free bands are
 * open; others are earned (or, inside Lagos Life, bought). Looks only.
 */
export default function BandPicker({ config, onUpdate, numberOf, disabled = false }) {
  const [role, setRole] = useState('atk1')
  const [hint, setHint] = useState(null)
  const progress = useProgress()
  const shop = isLagos()
  const owned = useLagosStore((s) => s.owned)
  const buying = useLagosStore((s) => s.buying)
  const shopNote = useLagosStore((s) => s.shopNote)
  const names = playerNames(config)
  const bands = config.bands || {}
  const open = (b) => bandEarned(b, progress) || (shop && owned.includes(bandProductId(b.key)))
  const list = BANDS.filter((b) => shop || !b.shopOnly)
  const choose = (key) => { playButtonSelect(); setHint(null); onUpdate({ bands: { ...bands, [role]: key || undefined } }) }
  const hinted = hint ? BANDS.find((b) => b.key === hint) : null

  return (
    <div className="band-picker">
      <div className="eyebrow">Rubber bands</div>
      <p className="muted t-note">Stretch a band round a player’s cap to make him yours. Looks only.</p>
      <div className="band-players" role="group" aria-label="Choose a player">
        {CAP_ROLES.map((r) => (
          <button key={r} type="button" className="band-player" aria-pressed={role === r} disabled={disabled} onClick={() => { playButtonSelect(); setRole(r); setHint(null) }} aria-label={names[r]}>
            <CapPreview config={config} size={46} role={r} number={numberOf(r)} />
            <small>{names[r]}</small>
          </button>
        ))}
      </div>
      <div className="band-swatches" role="group" aria-label={`Band for ${names[role]}`}>
        <button type="button" className="band-swatch" aria-pressed={!bands[role]} disabled={disabled} onClick={() => choose(null)}>
          <span className="band-dot band-none" aria-hidden="true" />
          <small>None</small>
        </button>
        {list.map((b) => {
          const ok = open(b)
          return (
            <button
              key={b.key}
              type="button"
              className="band-swatch"
              data-locked={ok ? undefined : 'true'}
              aria-pressed={bands[role] === b.key}
              disabled={disabled}
              onClick={() => (ok ? choose(b.key) : (playButtonSelect(), setHint(b.key)))}
              aria-label={ok ? b.name : `${b.name}, locked`}
            >
              <span className="band-dot" style={{ '--band': b.color }} aria-hidden="true">{!ok && <Icon name="lock" size={11} />}</span>
              <small>{b.name}</small>
            </button>
          )
        })}
      </div>
      {hinted && (
        <div className="cap-buy">
          <p className="cap-design-hint">
            {hinted.shopOnly ? `${hinted.name} is a Lagos Life exclusive.` : `${hinted.hint} to unlock the ${hinted.name.toLowerCase()} band${shop ? ', or get it now.' : '.'}`}
          </p>
          {shop && hinted.price && (
            <button className="btn btn-gold btn-block" disabled={!!buying} onClick={() => { playButtonSelect(); useLagosStore.getState().buy(bandProductId(hinted.key), `The ${hinted.name.toLowerCase()} band`) }}>
              {buying === bandProductId(hinted.key) ? 'Opening Lagos Life…' : `Buy for ${naira(hinted.price)}`}
            </button>
          )}
        </div>
      )}
      {shop && shopNote && <p className={shopNote.tone === 'bad' ? 't-warn' : 'cap-design-hint'} role="status">{shopNote.text}</p>}
    </div>
  )
}
