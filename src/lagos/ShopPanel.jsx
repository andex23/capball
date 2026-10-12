import { useState } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { designPatch, isUnlocked } from '../data/TeamOptions'
import { bandEarned } from '../data/bands'
import { SHOP_ITEMS, BAND_ITEMS, naira } from '../data/shop'
import { useProgress } from '../state/unlocks'
import { useLagosStore } from './lagosStore'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import CapPreview from '../ui/CapPreview'

/**
 * Everything for sale in one place: caps and rubber bands, with prices.
 * Looks only. Earned or bought items can be used straight away.
 */
export default function ShopPanel() {
  const [tab, setTab] = useState('caps')
  const [picked, setPicked] = useState(null)
  const progress = useProgress()
  const { owned, buying, shopNote, status } = useLagosStore()
  const myTeam = useMatchStore((s) => (s.aiTeam === 'team1' ? 'team2' : 'team1'))

  const items = tab === 'caps' ? SHOP_ITEMS : BAND_ITEMS
  const have = (item) => owned.includes(item.productId) || (item.design ? item.earnable && isUnlocked(item.design, progress) : bandEarned(item.band, progress))
  const sel = picked ? items.find((i) => i.productId === picked) : null
  const name = (i) => (i.design ? i.design.name : `${i.band.name} band`)

  const applyCap = (item) => {
    playConfirm()
    useMatchStore.getState().setTeamConfig(myTeam, designPatch(item.design))
    useLagosStore.setState({ shopNote: { tone: 'good', text: `${item.design.name} is on your team.` } })
  }

  return (
    <div className="shop">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'caps'} onClick={() => { playButtonSelect(); setTab('caps'); setPicked(null) }}>Caps</button>
        <button role="tab" aria-selected={tab === 'bands'} onClick={() => { playButtonSelect(); setTab('bands'); setPicked(null) }}>Rubber bands</button>
      </div>
      {status !== 'ready' && <p className="muted t-note">Connecting to Lagos Life…</p>}
      <p className="muted t-note">{tab === 'caps' ? 'Rare caps can also be earned by playing. Exclusives are only here.' : 'Stretch a band round one player’s cap. Pick who wears it in the Squad tab.'} Looks only.</p>

      <div className="shop-grid" role="list">
        {items.map((item) => {
          const got = have(item)
          return (
            <button
              key={item.productId}
              role="listitem"
              type="button"
              className="shop-item"
              aria-pressed={picked === item.productId}
              onClick={() => { playButtonSelect(); setPicked(item.productId) }}
            >
              {item.design
                ? <CapPreview config={{ ...item.design }} size={64} number={10} />
                : <span className="band-dot shop-band" style={{ '--band': item.band.color }} aria-hidden="true" />}
              <span className="shop-name">{name(item)}</span>
              <small className={got ? 'shop-owned' : 'shop-price'}>{got ? 'Yours' : naira(item.price)}</small>
            </button>
          )
        })}
      </div>

      {sel && (
        <div className="cap-buy">
          {have(sel) ? (
            sel.design
              ? <button className="btn btn-gold btn-block" onClick={() => applyCap(sel)}>Use {sel.design.name} on my team</button>
              : <p className="cap-design-hint">The {sel.band.name.toLowerCase()} band is yours. Put it on a player in the Squad tab.</p>
          ) : (
            <>
              {sel.earnable && <p className="muted t-note">{sel.design ? sel.design.hint : sel.band.hint} to get it free.</p>}
              <button className="btn btn-gold btn-block" disabled={!!buying || status !== 'ready'} onClick={() => { playButtonSelect(); useLagosStore.getState().buy(sel.productId, sel.design ? sel.design.name : `The ${sel.band.name.toLowerCase()} band`) }}>
                {buying === sel.productId ? 'Opening Lagos Life…' : `Buy ${name(sel)} for ${naira(sel.price)}`}
              </button>
            </>
          )}
        </div>
      )}
      {shopNote && <p className={shopNote.tone === 'bad' ? 't-warn' : 'cap-design-hint'} role="status">{shopNote.text}</p>}
    </div>
  )
}
