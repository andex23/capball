import { useEffect } from 'react'
import { useLagosStore } from './lagosStore'
import { SHOP_ITEMS, BAND_ITEMS } from '../data/shop'
import { playConfirm } from '../audio/SoundManager'
import CapPreview from '../ui/CapPreview'
import Icon from '../ui/Icon'

/** "Purchase complete": a small note at the top when a bought cap or band arrives. */
export default function PurchaseToast() {
  const done = useLagosStore((s) => s.justBought)
  useEffect(() => {
    if (!done) return
    playConfirm()
    const t = setTimeout(() => useLagosStore.setState({ justBought: null }), 3500)
    return () => clearTimeout(t)
  }, [done])
  if (!done) return null
  const cap = SHOP_ITEMS.find((i) => i.productId === done.productId)
  const band = BAND_ITEMS.find((i) => i.productId === done.productId)
  if (!cap && !band) return null
  return (
    <div className="unlock-toast purchase-toast" role="status" onClick={() => useLagosStore.setState({ justBought: null })}>
      {cap ? <CapPreview config={cap.design} size={48} /> : <span className="band-dot" style={{ '--band': band.band.color }} aria-hidden="true" />}
      <div>
        <div className="unlock-toast-title"><Icon name="check" size={13} /> Purchase complete</div>
        <div className="unlock-toast-name">{cap ? cap.design.name : `${band.band.name} band`}</div>
      </div>
    </div>
  )
}
