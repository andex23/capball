/**
 * The shop: spend your wallet (what your matches have earned) on rare caps,
 * exclusives and rubber bands. Looks only. Anything earned the free way, or
 * bought, is yours to use straight away.
 */
import { useState } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { designPatch, isUnlocked } from '../data/TeamOptions'
import { SHOP_ITEMS } from '../data/shop'
import { BAND_PART_NAMES, BAND_PARTS_LOOK } from '../game/bandStyle'
import { CAP_PRICES, BAND_PRICES, walletNaira, DAILY_CAP } from '../game/wallet'
import { COLLECTION } from '../game/collection'
import { useWalletStore } from '../state/walletStore'
import { useProgress } from '../state/unlocks'
import { useLagosStore } from '../lagos/lagosStore'
import { isLagos } from '../platform'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import CapPreview from './CapPreview'
import Icon from './Icon'

export default function WalletShop() {
  const [tab, setTab] = useState('caps')
  const [picked, setPicked] = useState(null)
  const [note, setNote] = useState(null)
  const progress = useProgress()
  const balance = useWalletStore((s) => s.balance)
  const caps = useWalletStore((s) => s.caps)
  const bands = useWalletStore((s) => s.bands)
  const lagosOwned = useLagosStore((s) => s.owned)
  const myTeam = useMatchStore((s) => (s.aiTeam === 'team1' ? 'team2' : 'team1'))

  const collectionItems = COLLECTION.filter((d) => d.price).map((d) => ({ productId: `cap_${d.key}`, design: { ...d, art: d.key, capNames: 'none' }, earnable: false, key: d.key, kind: 'cap', price: d.price }))
  const capItems = [...collectionItems, ...SHOP_ITEMS.filter((i) => CAP_PRICES[i.design.key] && (i.earnable || isLagos())).map((i) => ({ ...i, key: i.design.key, kind: 'cap', price: CAP_PRICES[i.design.key] }))]
  // Band Studio extras: a pattern or a finish, bought once, then used in Edit team › Band
  const bandItems = Object.keys(BAND_PRICES).map((k) => ({ key: k, kind: 'band', price: BAND_PRICES[k], band: { name: BAND_PART_NAMES[k], look: BAND_PARTS_LOOK[k] } }))
  const items = tab === 'caps' ? capItems : bandItems
  const have = (i) => i.kind === 'cap'
    ? caps.includes(i.key) || lagosOwned.includes(i.productId) || (i.earnable && isUnlocked(i.design, progress))
    : bands.includes(i.key) || (isLagos() && lagosOwned.some((p) => p.startsWith('band_')))
  const sel = picked ? items.find((i) => i.key === picked) : null
  const name = (i) => (i.kind === 'cap' ? i.design.name : i.band.name)

  const buy = (i) => {
    if (useWalletStore.getState().buy(i.kind, i.key)) { playConfirm(); setNote({ tone: 'good', text: `${name(i)} is yours.` }) }
    else setNote({ tone: 'bad', text: `You need ${walletNaira(i.price - balance)} more. Every match you finish adds to your wallet.` })
  }
  const use = (i) => {
    playConfirm()
    useMatchStore.getState().setTeamConfig(myTeam, designPatch(i.design))
    setNote({ tone: 'good', text: `${i.design.name} is on your team.` })
  }

  return (
    <div className="shop">
      <div className="wallet-bal">
        <Icon name="trophy" size={18} />
        <div><small>Your wallet</small><b>{walletNaira(balance)}</b></div>
        <p>Every match you finish pays in: more for a win, goals and harder opponents. Up to {walletNaira(DAILY_CAP)} a day.</p>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'caps'} onClick={() => { playButtonSelect(); setTab('caps'); setPicked(null); setNote(null) }}>Caps</button>
        <button role="tab" aria-selected={tab === 'bands'} onClick={() => { playButtonSelect(); setTab('bands'); setPicked(null); setNote(null) }}>Band extras</button>
      </div>
      <div className="shop-grid" role="list">
        {items.map((i) => {
          const got = have(i)
          return (
            <button key={i.key} role="listitem" type="button" className="shop-item" aria-pressed={picked === i.key} onClick={() => { playButtonSelect(); setPicked(i.key); setNote(null) }}>
              {i.kind === 'cap'
                ? <CapPreview config={{ ...i.design }} size={64} number={10} />
                : <BandLook look={i.band.look} />}
              <span className="shop-name">{name(i)}</span>
              <small className={got ? 'shop-owned' : 'shop-price'}>{got ? 'Yours' : walletNaira(i.price)}</small>
            </button>
          )
        })}
      </div>
      {sel && (
        <div className="cap-buy">
          {have(sel) ? (
            sel.kind === 'cap'
              ? <button className="btn btn-gold btn-block" onClick={() => use(sel)}>Use {sel.design.name} on my team</button>
              : <p className="cap-design-hint">The {sel.band.name.toLowerCase()} is yours. Use it in Edit team › Band.</p>
          ) : (
            <>
              {sel.earnable && sel.kind === 'cap' && <p className="muted t-note">Or {sel.design.hint?.toLowerCase()} to get it free.</p>}
              <button className="btn btn-gold btn-block" disabled={balance < sel.price} onClick={() => buy(sel)}>
                {balance < sel.price ? `${walletNaira(sel.price - balance)} more to buy` : `Buy ${name(sel)} · ${walletNaira(sel.price)}`}
              </button>
            </>
          )}
        </div>
      )}
      {note && <p className={note.tone === 'bad' ? 't-warn' : 'cap-design-hint'} role="status">{note.text}</p>}
    </div>
  )
}

/** A band extra in the shop: a strip of it drawn on a cap's band. */
function BandLook({ look }) {
  return <CapPreview config={{ primary: '#2B3A67', edge: '#FFFFFF', pattern: 'none', badge: 'none', bandEnabled: true, ...look }} size={64} number={10} />
}
