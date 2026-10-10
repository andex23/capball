import { useState } from 'react'
import Icon from './Icon'

// Share the public landing page, never a private room, account or LAN link.
const GAME_URL = 'https://capball.vercel.app/'

export default function ShareGame() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false)

  const share = async () => {
    setBusy(true)
    setStatus('')
    setManual(false)
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Counter Ball', text: 'Play Counter Ball with me — flick your caps and score!', url: GAME_URL })
          return
        } catch (error) {
          if (error.name === 'AbortError') return
        }
      }
      try {
        await navigator.clipboard.writeText(GAME_URL)
        setStatus('Game link copied — paste it to share with friends.')
      } catch {
        setManual(true)
        setStatus('Select and copy the link below to share.')
      }
    } finally {
      setBusy(false)
    }
  }

  return <div>
    <button className="btn btn-secondary btn-block" onClick={share} disabled={busy}>
      <Icon name="share" size={18} /> {busy ? 'Sharing…' : 'Share game'}
    </button>
    {status && <p className="muted" role="status" style={{ fontSize: 13, marginBottom: 0 }}>{status}</p>}
    {manual && <input aria-label="Game link" readOnly value={GAME_URL} onFocus={e => e.target.select()}
      style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', marginTop: 10 }} />}
  </div>
}
