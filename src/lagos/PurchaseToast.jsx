import { useEffect } from 'react'
import { useLagosStore } from './lagosStore'
import { SHOP_ITEMS, BAND_ITEMS } from '../data/shop'
import { playConfirm } from '../audio/SoundManager'
import CapPreview from '../ui/CapPreview'
import Icon from '../ui/Icon'

const WORDS = {
  done: { title: 'Purchase complete', icon: 'check', ms: 3500 },
  pending: { title: 'Payment received', icon: null, ms: 7000 },
  failed: { title: 'Purchase failed', icon: null, ms: 6000 },
}

/** The note at the top after buying: complete, paid and unlocking, or failed. */
export default function PurchaseToast() {
  const note = useLagosStore((s) => s.justBought)
  useEffect(() => {
    if (!note) return
    if (note.state !== 'failed' && note.state !== 'pending') playConfirm()
    const t = setTimeout(() => useLagosStore.setState({ justBought: null }), (WORDS[note.state] || WORDS.done).ms)
    return () => clearTimeout(t)
  }, [note])
  if (!note) return null
  const words = WORDS[note.state] || WORDS.done
  const cap = SHOP_ITEMS.find((i) => i.productId === note.productId)
  const band = BAND_ITEMS.find((i) => i.productId === note.productId)
  const item = cap ? cap.design.name : band ? `${band.band.name} band` : null
  const line = note.state === 'pending'
    ? `${item ? `${item} unlocks` : 'Your item unlocks'} in a moment. No need to pay again.`
    : note.state === 'failed'
      ? note.text || 'Nothing was unlocked.'
      : item
  if (note.state === 'done' && !item) return null
  return (
    <div className={`unlock-toast purchase-toast is-${note.state || 'done'}`} role="status" onClick={() => useLagosStore.setState({ justBought: null })}>
      {cap ? <CapPreview config={cap.design} size={48} /> : band ? <span className="band-dot" style={{ '--band': band.band.color }} aria-hidden="true" /> : null}
      <div>
        <div className="unlock-toast-title">{words.icon && <Icon name={words.icon} size={13} />} {words.title}</div>
        <div className="unlock-toast-name">{line}</div>
      </div>
    </div>
  )
}
