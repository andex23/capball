import { ATTRS, ATTR_LABEL, money } from '../game/squad'

/** Divisions in three letters, for tight rows. */
export const DIV_SHORT = ['SUN', 'DIS', 'NAT', 'PRE']

/** An OVR badge in EA FC card colours. */
export function Rating({ value }) {
  const tier = value >= 75 ? 'gold' : value >= 65 ? 'silver' : 'bronze'
  return <span className="squad-rating" data-tier={tier} aria-label={`Rating ${value}`}>{value}</span>
}

/** PWR · SHT · PAS · PHY, small. */
export function Attrs({ attrs }) {
  if (!attrs) return null
  return (
    <span className="squad-attrs">
      {ATTRS.map((k) => <span key={k}><small>{ATTR_LABEL[k]}</small>{attrs[k]}</span>)}
    </span>
  )
}

/** Club money, in naira. */
export function Coins({ n }) {
  return <span className="squad-coins squad-naira" data-neg={n < 0 ? 'true' : undefined}>{money(n)}</span>
}
