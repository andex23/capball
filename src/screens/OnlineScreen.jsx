import { useState, useEffect, useCallback } from 'react'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { createRoom, joinRoom, setStatusCallback, disconnect, getMyTeam } from '../multiplayer/MultiplayerManager'
import { playButtonSelect, playConfirm, playHoverTick } from '../audio/SoundManager'

export default function OnlineScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const setGameMode = useMatchStore((s) => s.setGameMode)
  const [view, setView] = useState('menu') // 'menu', 'create', 'join'
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [status, setStatus] = useState({ status: 'idle', msg: '' })
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setStatusCallback(setStatus)
    return () => { setStatusCallback(null); disconnect() }
  }, [])

  // When connected, assign teams and go to team select
  useEffect(() => {
    if (status.status === 'connected') {
      setTimeout(() => {
        setGameMode('online')
        // Store which team this player controls
        useMatchStore.setState({ onlineMyTeam: getMyTeam() })
        goToScreen(SCREEN.TEAM_SELECT)
      }, 1500)
    }
  }, [status, setGameMode, goToScreen])

  const handleCreate = useCallback(async () => {
    playConfirm()
    setView('create')
    setError('')
    try {
      const code = await createRoom()
      setRoomCode(code)
    } catch (e) {
      setError('Failed to create room. Try again.')
    }
  }, [])

  const handleJoin = useCallback(async () => {
    if (joinCode.length < 4) { setError('Enter a valid room code'); return }
    playConfirm()
    setError('')
    try {
      await joinRoom(joinCode)
    } catch (e) {
      setError('Could not join room. Check the code and try again.')
    }
  }, [joinCode])

  // Share the room code via native share or clipboard
  const handleShare = useCallback(async () => {
    const shareText = `Join my CAPBALL match! Room code: ${roomCode}\n\nPlay at: ${window.location.origin}`

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CAPBALL Online Match', text: shareText })
        return
      } catch (e) {} // user cancelled or not supported
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      // Last fallback: select text
      prompt('Copy this invite:', shareText)
    }
  }, [roomCode])

  // Copy just the code
  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {}
  }, [roomCode])

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />

      <div style={styles.card}>
        <h2 style={styles.title}>ONLINE MATCH</h2>
        <div style={styles.titleLine} />

        {view === 'menu' && (
          <div style={styles.options}>
            <div style={styles.infoText}>
              Host creates a room, guest joins with the code.
              Host plays as <b style={{ color: '#E53935' }}>Team 1</b>, Guest plays as <b style={{ color: '#1E88E5' }}>Team 2</b>.
            </div>
            <button className="arcade-btn" style={styles.createBtn} onClick={handleCreate} onMouseEnter={playHoverTick}>
              CREATE ROOM
            </button>
            <button className="arcade-btn" style={styles.joinBtn} onClick={() => { playButtonSelect(); setView('join') }} onMouseEnter={playHoverTick}>
              JOIN ROOM
            </button>
            <button className="arcade-link" style={styles.backBtn} onClick={() => goToScreen(SCREEN.MENU)} onMouseEnter={playHoverTick}>
              BACK
            </button>
          </div>
        )}

        {view === 'create' && (
          <div style={styles.options}>
            {roomCode ? (
              <>
                <div style={styles.codeLabel}>YOUR ROOM CODE</div>
                <div style={styles.codeDisplay}>{roomCode}</div>

                {/* Share buttons */}
                <div style={styles.shareRow}>
                  <button className="arcade-btn" style={styles.shareBtn} onClick={handleShare} onMouseEnter={playHoverTick}>
                    &#128279; SHARE INVITE
                  </button>
                  <button className="arcade-link" style={styles.copyBtn} onClick={handleCopyCode} onMouseEnter={playHoverTick}>
                    {copied ? '✓ COPIED!' : 'COPY CODE'}
                  </button>
                </div>

                <div style={styles.codeHint}>Send the code or invite link to your friend</div>

                <div style={styles.teamInfo}>
                  You are <span style={{ color: '#E53935', fontWeight: '700' }}>TEAM 1</span> (Host)
                </div>

                <div style={styles.statusText}>
                  {status.status === 'waiting' && '⏳ Waiting for opponent to join...'}
                  {status.status === 'connected' && '✓ Opponent connected! Starting match setup...'}
                  {status.status === 'error' && `✗ ${status.msg}`}
                </div>
              </>
            ) : (
              <div style={styles.statusText}>Creating room...</div>
            )}
            <button className="arcade-link" style={styles.backBtn} onClick={() => { disconnect(); setView('menu') }} onMouseEnter={playHoverTick}>
              CANCEL
            </button>
          </div>
        )}

        {view === 'join' && (
          <div style={styles.options}>
            <div style={styles.codeLabel}>ENTER ROOM CODE</div>
            <input
              style={styles.codeInput}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
            />

            <div style={styles.teamInfo}>
              You will be <span style={{ color: '#1E88E5', fontWeight: '700' }}>TEAM 2</span> (Guest)
            </div>

            {error && <div style={styles.errorText}>{error}</div>}
            <div style={styles.statusText}>
              {status.status === 'connecting' && '⏳ Connecting...'}
              {status.status === 'connected' && '✓ Connected! Starting match setup...'}
              {status.status === 'error' && `✗ ${status.msg}`}
            </div>
            <button className="arcade-btn" style={styles.joinGoBtn} onClick={handleJoin} onMouseEnter={playHoverTick}>
              JOIN
            </button>
            <button className="arcade-link" style={styles.backBtn} onClick={() => { disconnect(); setView('menu') }} onMouseEnter={playHoverTick}>
              CANCEL
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%', height: '100%',
    background: 'linear-gradient(180deg, #060814 0%, #0c1028 30%, #111840 60%, #0a0e22 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    color: 'white', position: 'relative', overflow: 'hidden',
  },
  vignette: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'linear-gradient(180deg, rgba(16,20,45,0.95) 0%, rgba(10,13,30,0.98) 100%)',
    border: '2px solid rgba(255,215,64,0.35)',
    borderRadius: '18px', padding: '32px 48px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)', position: 'relative', zIndex: 1,
    minWidth: '440px', maxWidth: '500px', animation: 'fadeIn 0.5s ease-out',
  },
  title: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '28px', fontWeight: '900', color: '#FFD740', margin: 0,
    letterSpacing: '4px', textShadow: '0 0 15px rgba(255,215,64,0.3), 0 2px 0 #B8860B',
  },
  titleLine: { width: '160px', height: '2px', background: 'linear-gradient(90deg, transparent, #FFD740, transparent)' },
  options: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' },
  infoText: {
    fontSize: '12px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: '20px',
    padding: '0 8px', marginBottom: '4px',
  },
  createBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px', fontWeight: '700', letterSpacing: '2px', color: 'white',
    padding: '14px 40px', width: '100%',
    background: 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)',
    border: '2px solid #1B5E20', borderRadius: '10px', cursor: 'pointer',
    boxShadow: '0 4px 0 #1B5E20, 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    outline: 'none',
  },
  joinBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '15px', fontWeight: '700', letterSpacing: '2px', color: 'white',
    padding: '14px 40px', width: '100%',
    background: 'linear-gradient(180deg, #42A5F5 0%, #1E88E5 40%, #0D47A1 100%)',
    border: '2px solid #0D47A1', borderRadius: '10px', cursor: 'pointer',
    boxShadow: '0 4px 0 #062a6e, 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    outline: 'none',
  },
  joinGoBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '14px', fontWeight: '700', letterSpacing: '2px', color: 'white',
    padding: '12px 36px',
    background: 'linear-gradient(180deg, #66BB6A 0%, #43A047 40%, #2E7D32 100%)',
    border: '2px solid #1B5E20', borderRadius: '8px', cursor: 'pointer',
    boxShadow: '0 3px 0 #1B5E20, 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
    outline: 'none',
  },
  backBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '11px', fontWeight: '600', letterSpacing: '2px',
    color: 'rgba(255,255,255,0.5)', padding: '8px 24px',
    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px', cursor: 'pointer', outline: 'none', marginTop: '8px',
  },
  codeLabel: {
    fontSize: '10px', letterSpacing: '3px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
  },
  codeDisplay: {
    fontFamily: "var(--font-score, 'Orbitron', monospace)",
    fontSize: '42px', fontWeight: '900', color: '#FFD740', letterSpacing: '8px',
    textShadow: '0 0 20px rgba(255,215,64,0.4)', padding: '4px 0',
  },
  shareRow: {
    display: 'flex', gap: '10px', alignItems: 'center',
  },
  shareBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '12px', fontWeight: '700', letterSpacing: '1px', color: 'white',
    padding: '10px 20px',
    background: 'linear-gradient(180deg, #AB47BC 0%, #8E24AA 40%, #6A1B9A 100%)',
    border: '2px solid #4A148C', borderRadius: '8px', cursor: 'pointer',
    boxShadow: '0 3px 0 #4A148C, 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
    outline: 'none',
  },
  copyBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px', fontWeight: '600', letterSpacing: '1.5px',
    color: 'rgba(255,215,64,0.7)', padding: '8px 16px',
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,64,0.3)',
    borderRadius: '6px', cursor: 'pointer', outline: 'none',
  },
  codeHint: {
    fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px',
  },
  teamInfo: {
    fontSize: '13px', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px',
    padding: '6px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  codeInput: {
    fontFamily: "var(--font-score, 'Orbitron', monospace)",
    fontSize: '28px', fontWeight: '700', color: '#FFD740', letterSpacing: '6px',
    background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,215,64,0.3)',
    borderRadius: '10px', padding: '12px 20px', textAlign: 'center',
    outline: 'none', width: '220px',
  },
  statusText: {
    fontSize: '12px', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px', textAlign: 'center',
  },
  errorText: {
    fontSize: '11px', color: '#FF5722', letterSpacing: '0.5px',
  },
}
