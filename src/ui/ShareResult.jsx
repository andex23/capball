import { useState } from 'react'
import { useMatchStore } from '../state/MatchStore'
import { useSavedStore } from '../state/savedMatch'
import { shareResultCard } from '../game/shareCard'
import { playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

/** "Share result": a picture of the full-time score for WhatsApp Status, Instagram… */
export function ShareResult() {
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const share = async () => {
    playButtonSelect()
    setBusy(true)
    const s = useMatchStore.getState()
    const how = await shareResultCard({
      teamConfig: s.teamConfig, score: s.matchResult?.score || s.score, penaltyScore: s.matchResult?.penaltyScore || null,
      goalLog: s.goalLog, matchEvents: s.matchEvents, stadium: s.stadium,
    }).catch(() => 'failed')
    setBusy(false)
    setNote(how === 'downloaded' ? 'Saved to your downloads — post it anywhere.' : how === 'shared' ? 'Shared!' : how === 'failed' ? 'Couldn’t make the picture on this device.' : null)
  }
  return (
    <div className="share-result">
      <button className="btn btn-gold btn-block" onClick={share} disabled={busy}><Icon name="share" size={18} /> {busy ? 'Making your picture…' : 'Share result'}</button>
      {note && <p className="muted t-note" role="status">{note}</p>}
    </div>
  )
}

/** "You lead Royal Crowns 3–1–1": your record against this opponent. */
export function HeadToHead() {
  const rivals = useSavedStore((s) => s.rivals)
  const teamConfig = useMatchStore((s) => s.teamConfig)
  const mode = useMatchStore((s) => s.gameMode)
  const aiTeam = useMatchStore((s) => s.aiTeam)
  const myTeam = useMatchStore((s) => s.onlineMyTeam)
  const me = mode === 'online' ? myTeam : mode === 'ai' ? (aiTeam === 'team1' ? 'team2' : 'team1') : null
  if (!me) return null
  const opp = teamConfig[me === 'team1' ? 'team2' : 'team1']?.name
  const r = opp && rivals[opp]
  if (!r || r.w + r.d + r.l < 2) return null
  const lead = r.w > r.l ? `You lead ${opp}` : r.l > r.w ? `${opp} lead you` : `All square with ${opp}`
  return (
    <p className="h2h" role="status">
      <Icon name="users" size={16} /> {lead} — <b>{r.w}</b> won · <b>{r.d}</b> drawn · <b>{r.l}</b> lost
    </p>
  )
}

/** Your most-played opponents, for My games. */
export function RivalsList() {
  const rivals = useSavedStore((s) => s.rivals)
  const list = Object.entries(rivals).sort((a, b) => (b[1].w + b[1].d + b[1].l) - (a[1].w + a[1].d + a[1].l)).slice(0, 6)
  if (!list.length) return null
  return (
    <section>
      <h3 className="saved-h">Rivals</h3>
      <ul className="rivals">
        {list.map(([name, r]) => (
          <li key={name}>
            <i className="rival-dot" style={{ background: r.primary }} />
            <span className="rival-name">{name}{r.online && <small> · online</small>}</span>
            <span className="rival-rec"><b className="good">{r.w}</b>–<b>{r.d}</b>–<b className="bad">{r.l}</b></span>
          </li>
        ))}
      </ul>
      <p className="muted t-note">Won–drawn–lost against each team.</p>
    </section>
  )
}
