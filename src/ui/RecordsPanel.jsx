import { useState } from 'react'
import { useRecordsStore, resetRecords } from '../state/persistence'
import { AI_DIFFICULTIES } from '../game/records'
import { playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function Row({ label, r }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
      <td className="records-goals">{r.gf}–{r.ga}</td>
    </tr>
  )
}

function Stat({ label, value }) {
  return (
    <div className="records-stat">
      <div className="display tabular">{value}</div>
      <div className="eyebrow">{label}</div>
    </div>
  )
}

/** Records dialog body: W/D/L per mode, bests, and a guarded reset. */
export default function RecordsPanel() {
  const records = useRecordsStore((s) => s.records)
  const [confirming, setConfirming] = useState(false)
  const { bests } = records

  return (
    <>
      <table className="records-table tabular">
        <thead>
          <tr><th scope="col">Mode</th><th scope="col">W</th><th scope="col">D</th><th scope="col">L</th><th scope="col" className="records-goals">Goals</th></tr>
        </thead>
        <tbody>
          {AI_DIFFICULTIES.map((d) => <Row key={d} label={`${cap(d)} CPU`} r={records.cpu[d]} />)}
          <Row label="Online" r={records.online} />
        </tbody>
      </table>

      <div className="records-stats">
        <Stat label="Local played" value={records.local.played} />
        <Stat label="Biggest win" value={bests.biggestWin ? `+${bests.biggestWin}` : '–'} />
        <Stat label="Most goals" value={bests.mostGoals || '–'} />
        <Stat label="Shootouts won" value={bests.shootoutsWon} />
      </div>

      {confirming ? (
        <div className="records-confirm">
          <p className="muted">Clear every record? This can’t be undone.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" onClick={() => { playButtonSelect(); resetRecords(); setConfirming(false) }}>Yes, reset</button>
            <button className="btn btn-secondary" onClick={() => { playButtonSelect(); setConfirming(false) }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => { playButtonSelect(); setConfirming(true) }}>
          <Icon name="restart" size={18} /> Reset records
        </button>
      )}
    </>
  )
}
