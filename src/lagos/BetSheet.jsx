import { useState } from 'react'
import Modal from '../ui/Modal'
import { naira } from '../data/shop'
import { BET_PICKS, BET_MIN, BET_MAX, BET_STEP, potFor, cleanStake } from './lagosStore'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'

/** Bet: how much of your Lagos Life money. */
export default function BetSheet({ onClose, onBet }) {
  const [amount, setAmount] = useState(BET_PICKS[0])
  const pick = (n) => { playButtonSelect(); setAmount(cleanStake(n)) }
  const stake = cleanStake(amount)
  return (
    <Modal title="Bet" onClose={onClose}>
      <div className="bet-sheet">
        <div className="bet-picks">
          {BET_PICKS.map((n) => (
            <button key={n} type="button" className={`chip${stake === n ? ' is-on' : ''}`} aria-pressed={stake === n} onClick={() => pick(n)}>{naira(n)}</button>
          ))}
        </div>
        <div className="bet-amount" role="group" aria-label="Bet amount">
          <button type="button" className="btn btn-secondary bet-step" aria-label="Less" onClick={() => pick(stake - BET_STEP)} disabled={stake <= BET_MIN}>−</button>
          <input
            className="field display tabular bet-input"
            inputMode="numeric"
            aria-label="Amount in naira"
            value={naira(amount)}
            onChange={(e) => setAmount(cleanStake(Number(e.target.value.replace(/\D/g, '')) || 0, false))}
            onBlur={() => setAmount((a) => cleanStake(a))}
          />
          <button type="button" className="btn btn-secondary bet-step" aria-label="More" onClick={() => pick(stake + BET_STEP)} disabled={stake >= BET_MAX}>+</button>
        </div>
        <p className="bet-pot">Winner takes {naira(potFor(stake))}</p>
        <p className="muted t-note">Lagos Life keeps 5%. Up to {naira(BET_MAX)} a match.</p>
        <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); onBet(stake) }}>Bet {naira(stake)}</button>
      </div>
    </Modal>
  )
}
