import { useState, useEffect } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { createRoom, joinRoom, disconnect } from '../multiplayer/MultiplayerManager'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'
import Icon from '../ui/Icon'

const CODE_LENGTH = 6

function Spinner() {
  return <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', borderRightColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
}

export default function OnlineScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const status = useMatchStore((s) => s.onlineStatus)
  const [view, setView] = useState('menu') // 'menu' | 'host' | 'join'
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState(() => {
    // Invite links carry ?room=CODE
    const fromUrl = new URLSearchParams(window.location.search).get('room')
    return fromUrl ? fromUrl.toUpperCase().slice(0, CODE_LENGTH) : ''
  })
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Connected → both players move on to team select together
  useEffect(() => {
    if (status.status !== 'connected') return
    const t = setTimeout(() => goToScreen(SCREEN.TEAM_SELECT), 900)
    return () => clearTimeout(t)
  }, [status.status, goToScreen])

  // Opened from an invite link → go straight to the join form
  useEffect(() => {
    if (joinCode) setView('join')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const host = async () => {
    playConfirm()
    setView('host')
    setBusy(true)
    try {
      setRoomCode(await createRoom())
    } catch {
      // status message comes from the manager
    } finally {
      setBusy(false)
    }
  }

  const join = async (e) => {
    e?.preventDefault()
    if (joinCode.length !== CODE_LENGTH) return
    playConfirm()
    setBusy(true)
    try {
      await joinRoom(joinCode)
    } catch {
      setBusy(false)
    }
  }

  const back = () => {
    playButtonSelect()
    disconnect()
    if (view === 'menu') goToScreen(SCREEN.MENU)
    else { setView('menu'); setRoomCode(''); setBusy(false) }
  }

  const inviteUrl = roomCode ? `${window.location.origin}${window.location.pathname}?room=${roomCode}` : ''

  const share = async () => {
    playButtonSelect()
    const text = `Play CAPBALL with me! Room code ${roomCode}`
    if (navigator.share) {
      try { await navigator.share({ title: 'CAPBALL', text, url: inviteUrl }); return } catch { /* cancelled */ }
    }
    copy(`${text}\n${inviteUrl}`)
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked — the code is on screen */ }
  }

  const isError = status.status === 'error' || status.status === 'disconnected'
  const connected = status.status === 'connected'

  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
      <div className="card" style={{ width: 'min(460px, 100%)' }}>
        <div className="sheet-head">
          <div>
            <div className="eyebrow">Online match</div>
            <h1 className="display" style={{ fontSize: 40 }}>
              {view === 'host' ? 'Host a room' : view === 'join' ? 'Join a room' : 'Play a friend'}
            </h1>
          </div>
          <span className="mode-icon"><Icon name="globe" size={24} /></span>
        </div>

        <div className="sheet-body">
          {view === 'menu' && (
            <>
              <p className="muted">One player hosts and shares a code; the other joins with it. The host plays the home team.</p>
              <button className="btn btn-primary btn-lg btn-block" onClick={host} onMouseEnter={playHoverTick}>Host a room</button>
              <button className="btn btn-secondary btn-lg btn-block" onClick={() => { playButtonSelect(); setView('join') }} onMouseEnter={playHoverTick}>I have a code</button>
            </>
          )}

          {view === 'host' && (
            <>
              <div style={{ textAlign: 'center' }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Room code</div>
                <div className="display tabular" aria-live="polite" style={{ fontSize: 64, letterSpacing: '0.12em', color: roomCode ? 'var(--accent)' : 'var(--text-3)' }}>
                  {roomCode || '······'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button className="btn btn-primary" onClick={share} disabled={!roomCode}><Icon name="share" size={18} /> Invite</button>
                <button className="btn btn-secondary" onClick={() => { playButtonSelect(); copy(roomCode) }} disabled={!roomCode}>
                  <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied' : 'Copy code'}
                </button>
              </div>
            </>
          )}

          {view === 'join' && (
            <form onSubmit={join} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="eyebrow" htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                className="field display tabular"
                style={{ fontSize: 36, textAlign: 'center', letterSpacing: '0.2em', minHeight: 64 }}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
                placeholder="ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                autoFocus
                disabled={busy}
              />
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={joinCode.length !== CODE_LENGTH || busy}>
                {busy ? <><Spinner /> Joining…</> : 'Join match'}
              </button>
            </form>
          )}

          {view !== 'menu' && status.msg && (
            <div
              role="status"
              className="chip"
              style={{ justifyContent: 'center', cursor: 'default', borderColor: isError ? 'var(--bad)' : connected ? 'var(--good)' : undefined, color: isError ? '#ffb3bd' : connected ? 'var(--good)' : undefined }}
            >
              {!isError && !connected && <Spinner />}
              {connected && <Icon name="check" size={16} />}
              {status.msg}
            </div>
          )}

          <button className="btn btn-ghost" onClick={back} style={{ alignSelf: 'flex-start' }}>
            <Icon name="back" size={18} /> Back
          </button>
        </div>
      </div>
    </div>
  )
}
