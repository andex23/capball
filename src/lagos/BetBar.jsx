import { useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { useLagosStore, potFor } from './lagosStore'
import { naira } from '../data/shop'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import BetSheet from './BetSheet'
import Modal from '../ui/Modal'

const SETUP = [SCREEN.TEAM_SELECT, SCREEN.STADIUM_SELECT, SCREEN.FORMATION]

/**
 * Once you're matched with a real player: a Bet button before kickoff, their
 * offer to accept or decline, and what's on the match once it's agreed.
 */
export default function BetBar() {
  const screen = useMatchStore((s) => s.screen)
  const gameMode = useMatchStore((s) => s.gameMode)
  const connected = useMatchStore((s) => s.onlineStatus?.status === 'connected')
  const opponent = useMatchStore((s) => s.teamConfig?.[s.onlineMyTeam === 'team1' ? 'team2' : 'team1']?.name)
  const { bet, betError, match, botMatch } = useLagosStore()
  const [choosing, setChoosing] = useState(false)
  if (gameMode !== 'online' || botMatch) return null
  const setup = SETUP.includes(screen)
  const staked = Number(match?.stake) > 0 && bet?.step === 'on'
  const who = opponent || 'Your opponent'

  return (
    <>
      {setup && connected && (
        <div className="bet-bar" role="status">
          {staked ? (
            <span className="bet-on">{naira(bet.stake)} bet · winner takes {naira(potFor(bet.stake))}</span>
          ) : bet?.side === 'mine' ? (
            <>
              <span className="bet-wait">{bet.step === 'confirming' ? 'Confirm in Lagos Life…' : `Waiting for ${who} to accept ${naira(bet.stake)}…`}</span>
              {bet.step === 'waiting' && <button className="btn btn-secondary bet-bar-btn" onClick={() => { playButtonSelect(); useLagosStore.getState().withdrawBet() }}>Cancel</button>}
            </>
          ) : !bet ? (
            <button className="btn btn-gold bet-bar-btn" onClick={() => { playButtonSelect(); useLagosStore.setState({ betError: null }); setChoosing(true) }}>₦ Bet</button>
          ) : null}
          {betError && !bet && <span className="bet-note">{betError}</span>}
        </div>
      )}

      {choosing && !bet && (
        <BetSheet onClose={() => setChoosing(false)} onBet={(stake) => { setChoosing(false); useLagosStore.getState().offerBet(stake) }} />
      )}

      {bet?.side === 'theirs' && bet.step !== 'on' && (
        <Modal title="Bet" onClose={() => useLagosStore.getState().declineBet()}>
          <div className="bet-sheet">
            <p className="bet-offer"><strong>{who}</strong> wants to bet</p>
            <p className="bet-pot bet-big">{naira(bet.stake)}</p>
            <p className="muted t-note">Winner takes {naira(potFor(bet.stake))}. Lagos Life keeps 5%; a draw gives both bets back. Lagos Life asks you to confirm before it’s taken.</p>
            <button className="btn btn-gold btn-lg btn-block" disabled={bet.step === 'confirming'} onClick={() => { playConfirm(); useLagosStore.getState().acceptBet() }}>{bet.step === 'confirming' ? 'Confirm in Lagos Life…' : `Accept ${naira(bet.stake)}`}</button>
            <button className="btn btn-secondary btn-block" disabled={bet.step === 'confirming'} onClick={() => { playButtonSelect(); useLagosStore.getState().declineBet() }}>No thanks</button>
          </div>
        </Modal>
      )}
    </>
  )
}
