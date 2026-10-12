import { useEffect, useRef, useState } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { createRoom, joinRoom, disconnect } from '../multiplayer/MultiplayerManager'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import { useLagosStore, potFor } from './lagosStore'
import BetSheet from './BetSheet'
import { naira } from '../data/shop'
import { sdkMessage } from './sdk'
import { roomCodeFor, isHostFor, opponentOf } from './friendMatch'
import Icon from '../ui/Icon'

const CODE_LENGTH = 6
const JOIN_TRIES = 25
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Matches already played this visit: coming back to this screen starts a new one
const used = new Set()

function Spinner() {
  return <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', borderRightColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
}

/** Free friend matches through Lagos Life's own matchmaking. */
export default function LagosFriendScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const status = useMatchStore((s) => s.onlineStatus)
  const lagos = useLagosStore()
  const me = lagos.player?.id
  // Only a match that's waiting or in play counts; a cancelled or finished one is gone
  const match = lagos.match && !used.has(lagos.match.id) && ['open', 'playing'].includes(lagos.match.status) ? lagos.match : null
  const [view, setView] = useState('menu') // 'menu' | 'join'
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [madeCode, setMadeCode] = useState(false)
  const [betting, setBetting] = useState(false)
  const linking = useRef(null)

  // Both players in: open the room on the host's phone, connect from the other
  // Sandbox: the test bot takes the other seat; it can't connect phone to phone
  const opponentNow = match ? opponentOf(match, me) : null
  const testBot = lagos.mode === 'test' && !!opponentNow && /bot|test/i.test(`${opponentNow.id} ${opponentNow.name}`)

  useEffect(() => {
    if (!match || match.status !== 'playing' || !me || testBot || linking.current === match.id) return
    linking.current = match.id
    const code = roomCodeFor(match.id)
    setError(null)
    ;(async () => {
      try {
        if (isHostFor(match, me)) {
          for (let i = 0; ; i++) {
            try { await createRoom(0, 'internet', code); break }
            catch (e) { if (e?.type !== 'unavailable-id' || i >= 5) throw e; await wait(3000) }
          }
        } else {
          for (let i = 0; ; i++) {
            if (linking.current !== match.id) return
            try { await joinRoom(code); break }
            catch (e) { if (i >= JOIN_TRIES) throw e; await wait(2000) }
          }
        }
      } catch {
        if (linking.current === match.id) setError('Couldn’t connect to your friend. Check your connection and try again.')
      }
    })()
  }, [match, me, testBot])

  // Leaving the screen (into the match, or back) closes this match for the lobby
  useEffect(() => () => { if (linking.current) used.add(linking.current) }, [])

  // Connected: both players go on to pick their teams together
  useEffect(() => {
    if (status.status !== 'connected' || !linking.current) return
    const t = setTimeout(() => goToScreen(SCREEN.TEAM_SELECT), 900)
    return () => clearTimeout(t)
  }, [status.status, goToScreen])

  const find = async (kind, code, stake = 0) => {
    playConfirm()
    setBusy(true)
    setError(null)
    try {
      const old = useLagosStore.getState().match
      if (old && (used.has(old.id) || !['open', 'playing'].includes(old.status))) await useLagosStore.getState().leaveMatch()
      await useLagosStore.getState().findMatch(kind, code, kind === 'join' ? 0 : stake)
      setBetting(false)
      setMadeCode(kind === 'create')
    } catch (e) {
      setBetting(false)
      setError(sdkMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    playButtonSelect()
    linking.current = null
    disconnect()
    await useLagosStore.getState().leaveMatch()
    setView('menu')
  }

  const back = async () => {
    if (match) await cancel()
    else playButtonSelect()
    if (view === 'join' && !match) { setView('menu'); return }
    goToScreen(SCREEN.MENU)
  }

  const opponent = match ? opponentOf(match, me) : null
  const waiting = match?.status === 'open'
  const playing = match?.status === 'playing'
  const ready = lagos.status === 'ready'
  const bet = match ? Number(match.stake) || 0 : 0

  return (
    <div className="screen online-screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
      <div className="card" style={{ width: 'min(460px, 100%)' }}>
        <div className="sheet-head">
          <div>
            <div className="eyebrow">{bet > 0 ? `Lagos Life · ${naira(bet)} bet` : 'Lagos Life · free match'}</div>
            <h1 className="display" style={{ fontSize: 40 }}>
              {playing ? `Vs ${opponent?.name || 'your friend'}` : waiting ? (madeCode ? 'Waiting for a friend' : 'Finding a player') : view === 'join' ? 'Join a friend' : 'Play a friend'}
            </h1>
          </div>
          <span className="mode-icon"><Icon name="globe" size={24} /></span>
        </div>

        <div className="sheet-body">
          {!ready && (
            <p className={lagos.status === 'error' ? 't-warn' : 'muted'} role="status">
              {lagos.status === 'error' ? lagos.error : 'Connecting to Lagos Life…'}
            </p>
          )}

          {ready && !match && view === 'menu' && (
            <>
              <p className="muted">Play another Lagos Life player on their own phone, for free or for a bet.</p>
              <button className="btn btn-gold btn-lg btn-block" onClick={() => find('quick')} disabled={busy}>{busy ? <><Spinner /> Searching…</> : 'Find a player'}</button>
              <button className="btn btn-purple btn-lg btn-block" onClick={() => find('create')} disabled={busy}>Make a code for a friend</button>
              <button className="btn btn-blue btn-lg btn-block" onClick={() => { playButtonSelect(); setView('join') }} disabled={busy}>I have a code</button>
              <button className="btn btn-secondary btn-lg btn-block lagos-bet-btn" onClick={() => { playButtonSelect(); setBetting(true) }} disabled={busy}>₦ Bet with Lagos Life money</button>
            </>
          )}

          {ready && !match && view === 'join' && (
            <form onSubmit={(e) => { e.preventDefault(); if (joinCode.length === CODE_LENGTH) find('join', joinCode) }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="eyebrow" htmlFor="lagos-code">Match code</label>
              <input
                id="lagos-code"
                className="field display tabular"
                style={{ fontSize: 36, textAlign: 'center', letterSpacing: '0.2em', minHeight: 64 }}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
                placeholder="ABCDEF"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                disabled={busy}
              />
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={joinCode.length !== CODE_LENGTH || busy}>
                {busy ? <><Spinner /> Joining…</> : 'Join match'}
              </button>
            </form>
          )}

          {waiting && (
            <>
              {madeCode && match.code && (
                <div style={{ textAlign: 'center' }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Match code</div>
                  <div className="display tabular" aria-live="polite" style={{ fontSize: 56, letterSpacing: '0.12em', color: 'var(--accent)' }}>{match.code}</div>
                  <p className="muted t-note">Tell your friend this code. They open Counterball in Lagos Life, tap Play a Friend, then I have a code.{bet > 0 ? ` They’ll be asked to match your ${naira(bet)} bet.` : ''}</p>
                </div>
              )}
              <div role="status" className="chip online-status" style={{ justifyContent: 'center', cursor: 'default' }}><Spinner /> Waiting for the other player…</div>
              <button className="btn btn-secondary btn-block" onClick={cancel}>Cancel</button>
            </>
          )}

          {playing && bet > 0 && <p className="lagos-pot" role="status">Winner takes {naira(potFor(bet))}</p>}

          {playing && lagos.mode === 'test' && (
            <>
              <p className="muted t-note">{testBot ? 'This is the sandbox’s test opponent. Play its seat against the computer here; the result is reported to Lagos Life as a real match.' : 'Sandbox: if the other seat is Lagos Life’s test bot, play it against the computer here instead.'}</p>
              <button className="btn btn-gold btn-lg btn-block" onClick={() => { playConfirm(); useLagosStore.getState().playTestOpponent() }}>Play the test opponent here</button>
            </>
          )}

          {playing && !error && !testBot && (
            <div role="status" className="chip online-status" style={{ justifyContent: 'center', cursor: 'default', borderColor: status.status === 'connected' ? 'var(--good)' : undefined, color: status.status === 'connected' ? 'var(--good)' : undefined }}>
              {status.status === 'connected' ? <Icon name="check" size={16} /> : <Spinner />}
              {status.status === 'connected' ? 'Connected!' : `Connecting to ${opponent?.name || 'your friend'}…`}
            </div>
          )}

          {error && <p className="t-warn" role="alert">{error}</p>}
          {betting && <BetSheet busy={busy} onClose={() => setBetting(false)} onPlay={(kind, stake) => find(kind, undefined, stake)} />}
          {error && playing && <button className="btn btn-secondary btn-block" onClick={cancel}>Leave this match</button>}

          <button className="btn btn-secondary" onClick={back} style={{ alignSelf: 'flex-start' }}>
            <Icon name="back" size={18} /> Back
          </button>
        </div>
      </div>
    </div>
  )
}
