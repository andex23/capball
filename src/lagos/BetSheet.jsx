import { useState } from 'react'
import Modal from '../ui/Modal'
import { naira } from '../data/shop'
import { BET_PICKS, BET_MIN, BET_MAX, potFor, cleanStake } from './lagosStore'
import { playButtonSelect } from '../audio/SoundManager'

/** "How much?": pick a bet in Lagos Life money, then find a player or send a code. */
export default function BetSheet({ onClose, onPlay, busy }) {
  const [amount, setAmount] = useState(500)
  const set = (n) => { playButtonSelect(); setAmount(cleanStake(n)) }
  return (
    <Modal title="Place a bet" onClose={onClose}>
      <div className="bet-sheet">
        <p className="muted t-note">With your Lagos Life money. Lagos Life asks you to confirm before it’s taken.</p>
        <div className="bet-amount" role="group" aria-label="Bet amount">
          <button type="button" className="btn btn-secondary bet-step" aria-label="Less" onClick={() => set(amount - (amount > 1000 ? 500 : 100))} disabled={amount <= BET_MIN}>−</button>
          <input
            className="field display tabular bet-input"
            inputMode="numeric"
            aria-label="Amount in naira"
            value={naira(amount)}
            onChange={(e) => setAmount(cleanStake(Number(e.target.value.replace(/\D/g, '')) || 0, false))}
            onBlur={() => setAmount((a) => cleanStake(a))}
          />
          <button type="button" className="btn btn-secondary bet-step" aria-label="More" onClick={() => set(amount + (amount >= 1000 ? 500 : 100))} disabled={amount >= BET_MAX}>+</button>
        </div>
        <div className="bet-picks">
          {BET_PICKS.map((n) => (
            <button key={n} type="button" className={`chip${amount === n ? ' is-on' : ''}`} aria-pressed={amount === n} onClick={() => set(n)}>{naira(n)}</button>
          ))}
        </div>
        <p className="bet-pot">Winner takes {naira(potFor(cleanStake(amount)))}</p>
        <p className="muted t-note">Lagos Life keeps 5%. A draw gives both bets back. Leaving early loses yours.</p>
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => onPlay('quick', cleanStake(amount))}>OK · find a player</button>
        <button className="btn btn-purple btn-block" disabled={busy} onClick={() => onPlay('create', cleanStake(amount))}>OK · send a code to a friend</button>
      </div>
    </Modal>
  )
}
