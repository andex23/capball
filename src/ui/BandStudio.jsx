/**
 * Band Studio: design the band your whole team wears round the skirt of every
 * cap. Pattern, two colours, width and finish. Solid, Twin Line, Matte and
 * Satin are free; the other patterns and finishes are bought once from the
 * wallet. Looks only: a band never changes how a cap plays.
 */
import { useMemo, useState } from 'react'
import {
  BAND_PATTERNS, BAND_PATTERN_NAMES, BAND_WIDTH_NAMES, BAND_FINISHES, BAND_COLORS, BAND_DEFAULTS,
  BAND_PART_PRICES, BAND_PART_NAMES, isFreeBandPart, bandStyleOf, drawBand,
} from '../game/bandStyle'
import { walletNaira } from '../game/wallet'
import { useWalletStore } from '../state/walletStore'
import { useLagosStore } from '../lagos/lagosStore'
import { isLagos } from '../platform'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

const FINISH_NAMES = { matte: 'Matte', satin: 'Satin', gloss: 'Gloss', chrome: 'Chrome' }

/** A little strip of the pattern, for its chip. */
function PatternSwatch({ pattern, base, accent }) {
  const url = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      c.width = 120; c.height = 28
      drawBand(c.getContext('2d'), 120, 28, { pattern, base, accent })
      return c.toDataURL()
    } catch { return '' }
  }, [pattern, base, accent])
  return <span className="bs-swatch" style={{ backgroundImage: url ? `url(${url})` : undefined, backgroundColor: base }} aria-hidden="true" />
}

function Colours({ label, value, onPick, disabled }) {
  return (
    <div className="bs-row">
      <div className="eyebrow">{label}</div>
      <div className="bs-colours" role="group" aria-label={label}>
        {BAND_COLORS.map((c) => (
          <button key={c} type="button" className="bs-colour" style={{ '--c': c }} aria-pressed={value.toLowerCase() === c.toLowerCase()} aria-label={c} disabled={disabled} onClick={() => onPick(c)} />
        ))}
        <label className="bs-colour bs-custom" aria-label={`${label}: any colour`}>
          <input type="color" value={value} disabled={disabled} onChange={(e) => onPick(e.target.value.toUpperCase())} />
          <span aria-hidden="true">+</span>
        </label>
      </div>
    </div>
  )
}

export default function BandStudio({ config, onUpdate, disabled = false }) {
  const [offer, setOffer] = useState(null) // a locked extra being looked at
  const [note, setNote] = useState(null)
  const walletParts = useWalletStore((s) => s.bands)
  const balance = useWalletStore((s) => s.balance)
  const lagosOwned = useLagosStore((s) => s.owned)
  const oldBandBuyer = isLagos() && lagosOwned.some((p) => p.startsWith('band_'))
  const owns = (k) => isFreeBandPart(k) || walletParts.includes(k) || oldBandBuyer

  const on = config.bandEnabled === true
  const style = bandStyleOf({ ...BAND_DEFAULTS, ...config, bandEnabled: true })
  const set = (patch) => { playButtonSelect(); setNote(null); setOffer(null); onUpdate({ bandEnabled: true, ...patch }) }
  const pick = (field, key) => (owns(key) ? set({ [field]: key }) : (playButtonSelect(), setNote(null), setOffer({ field, key })))

  const buy = () => {
    if (useWalletStore.getState().buy('band', offer.key)) {
      playConfirm()
      onUpdate({ bandEnabled: true, [offer.field]: offer.key })
      setNote({ tone: 'good', text: `${BAND_PART_NAMES[offer.key]} is yours, for good.` })
      setOffer(null)
    } else setNote({ tone: 'bad', text: `You need ${walletNaira(BAND_PART_PRICES[offer.key] - balance)} more. Every match you finish adds to your wallet.` })
  }

  return (
    <section className="band-studio" aria-label="Band Studio">
      <div className="bs-head">
        <CapPreview config={{ ...config, bandEnabled: on }} size={104} number={10} />
        <div>
          <div className="eyebrow">Band Studio</div>
          <p className="muted t-note">One band for your whole team, round every cap. Looks only.</p>
          <div className="bs-onoff" role="group" aria-label="Band">
            <button type="button" aria-pressed={on} disabled={disabled} onClick={() => set({})}>On</button>
            <button type="button" aria-pressed={!on} disabled={disabled} onClick={() => { playButtonSelect(); setOffer(null); onUpdate({ bandEnabled: false }) }}>Off</button>
          </div>
        </div>
      </div>

      <div className="bs-row">
        <div className="eyebrow">Pattern</div>
        <div className="bs-patterns" role="group" aria-label="Pattern">
          {BAND_PATTERNS.map((k) => (
            <button key={k} type="button" className="bs-chip" aria-pressed={on && style.pattern === k} disabled={disabled} data-locked={owns(k) ? undefined : 'true'} onClick={() => pick('bandPattern', k)}>
              <PatternSwatch pattern={k} base={style.base} accent={style.accent} />
              <span>{BAND_PATTERN_NAMES[k]}</span>
              {!owns(k) && <small className="bs-price"><Icon name="lock" size={10} /> {walletNaira(BAND_PART_PRICES[k])}</small>}
            </button>
          ))}
        </div>
      </div>

      <Colours label="Base colour" value={style.base} disabled={disabled} onPick={(c) => set({ bandBase: c })} />
      <Colours label="Accent colour" value={style.accent} disabled={disabled} onPick={(c) => set({ bandAccent: c })} />

      <div className="bs-row">
        <div className="eyebrow">Width</div>
        <div className="bs-seg" role="group" aria-label="Width">
          {Object.keys(BAND_WIDTH_NAMES).map((k) => (
            <button key={k} type="button" aria-pressed={on && style.width === k} disabled={disabled} onClick={() => set({ bandWidth: k })}>{BAND_WIDTH_NAMES[k]}</button>
          ))}
        </div>
      </div>

      <div className="bs-row">
        <div className="eyebrow">Finish</div>
        <div className="bs-seg" role="group" aria-label="Finish">
          {BAND_FINISHES.map((k) => (
            <button key={k} type="button" aria-pressed={on && style.finish === k} disabled={disabled} data-locked={owns(k) ? undefined : 'true'} onClick={() => pick('bandFinish', k)}>
              {FINISH_NAMES[k]}{!owns(k) && <Icon name="lock" size={10} />}
            </button>
          ))}
        </div>
      </div>

      {offer && (
        <div className="cap-buy">
          <p className="cap-design-hint">{BAND_PART_NAMES[offer.key]}: {walletNaira(BAND_PART_PRICES[offer.key])} from your wallet, yours for good. You have {walletNaira(balance)}.</p>
          <button className="btn btn-gold btn-block" disabled={disabled} onClick={buy}>
            {balance >= BAND_PART_PRICES[offer.key] ? `Buy for ${walletNaira(BAND_PART_PRICES[offer.key])}` : `${walletNaira(BAND_PART_PRICES[offer.key] - balance)} more to buy`}
          </button>
        </div>
      )}
      {note && <p className={note.tone === 'bad' ? 't-warn' : 'cap-design-hint'} role="status">{note.text}</p>}

      {on && <button type="button" className="btn btn-secondary btn-block" disabled={disabled} onClick={() => { playButtonSelect(); setOffer(null); onUpdate({ bandEnabled: false }) }}>Remove band</button>}
    </section>
  )
}
