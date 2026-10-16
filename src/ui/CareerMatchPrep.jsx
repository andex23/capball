import { useState } from 'react'
import { useCareerStore } from '../state/careerStore'
import { useTournamentStore } from '../state/tournamentStore'
import { useMatchStore, MATCH_DURATIONS } from '../state/MatchStore'
import { formatClock } from '../game/rules'
import { ROLE_LABEL, ovrAt, migratePlayer } from '../game/squad'
import { fitnessOf } from '../game/clubLife'
import { CAP_ROLES } from '../data/TeamOptions'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import { Rating } from './PlayerBits'
import Modal from './Modal'

/**
 * Career, right before kick-off: the time per half and the computer's
 * level (both saved for the rest of the career) and who starts. Formations are picked below these.
 */
export function CareerTimeCard({ disabled = false, withLevel = false }) {
  const matchDuration = useMatchStore((s) => s.matchDuration)
  const aiDifficulty = useMatchStore((s) => s.aiDifficulty)
  const level = useCareerStore((s) => s.career?.difficulty || 'auto')
  const pick = (d) => {
    playButtonSelect()
    useMatchStore.getState().setMatchDuration(d)
    useCareerStore.getState().setSettings({ matchDuration: d })
  }
  const pickLevel = (k) => {
    playButtonSelect()
    useCareerStore.getState().setSettings({ difficulty: k })
    // Rebuild this match with the new level (the formations and lineup stay)
    useTournamentStore.getState().refreshCareerMatch()
  }
  return (
    <div className="card card-pad match-length-card">
      <div className="eyebrow" style={{ marginBottom: 8 }}>Time per half</div>
      <div className="segmented stretch" role="group" aria-label="Time per half">
        {MATCH_DURATIONS.map((d) => (
          <button key={d} aria-pressed={matchDuration === d} disabled={disabled} onClick={() => pick(d)}>{formatClock(d)}</button>
        ))}
      </div>
      {withLevel && (
        <>
          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Computer difficulty</div>
          <div className="segmented stretch" role="group" aria-label="Computer difficulty">
            {LEVELS.map(([k, label]) => (
              <button key={k} aria-pressed={level === k} disabled={disabled} onClick={() => pickLevel(k)}>{label}</button>
            ))}
          </div>
        </>
      )}
      <p className="muted match-length-note">
        Two halves of {formatClock(matchDuration)}{withLevel ? `, the computer on ${aiDifficulty}${level === 'auto' ? ' (set by the division)' : ''}` : ''}. Your career keeps these for the next matches too.
      </p>
    </div>
  )
}

const LEVELS = [['auto', 'By division'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]

/** Your starting six: Change brings someone in from the bench instead. */
export function CareerLineupCard() {
  const career = useCareerStore((s) => s.career)
  const [role, setRole] = useState(null)
  if (!career) return null
  const bench = career.bench || []
  return (
    <section className="card card-pad squad-card" aria-label="Starting six">
      <div className="eyebrow" style={{ marginBottom: 4 }}>Starting six</div>
      <p className="muted t-note" style={{ marginTop: 0 }}>Tap Change to start someone from the bench instead.</p>
      <ul className="squad-list squad-simple lineup-list">
        {CAP_ROLES.map((r) => {
          const p = migratePlayer(career.squad[r], r)
          const fit = fitnessOf(p)
          return (
            <li key={r}>
              <span className="squad-role">{ROLE_LABEL[r]}</span>
              <span className="squad-name">{p.name}{fit < 85 ? <small className="squad-stats"> · tired ({fit}%)</small> : null}</span>
              <Rating value={ovrAt(p, r)} />
              <button className="btn btn-secondary squad-buy" disabled={!bench.some((b) => (b.pos === 'GK') === (r === 'gk'))} onClick={() => { playButtonSelect(); setRole(r) }}>Change</button>
            </li>
          )
        })}
      </ul>
      {role && <BenchPicker career={career} role={role} onDone={() => setRole(null)} />}
    </section>
  )
}

function BenchPicker({ career, role, onDone }) {
  const out = migratePlayer(career.squad[role], role)
  const options = (career.bench || []).map((p, i) => ({ p, i })).filter(({ p }) => (p.pos === 'GK') === (role === 'gk'))
  const swap = (i) => {
    if (!useCareerStore.getState().swap(i, role)) return
    playConfirm()
    useTournamentStore.getState().refreshCareerMatch()
    onDone()
  }
  return (
    <Modal title={`${ROLE_LABEL[role]}: replace ${out.name}`} onClose={onDone}>
      <p className="muted t-note">{out.name} plays {ROLE_LABEL[role]} at OVR {ovrAt(out, role)} and drops to the bench.</p>
      <ul className="squad-list squad-simple lineup-list">
        {options.map(({ p, i }) => (
          <li key={p.id}>
            <span className="squad-role">{p.pos}</span>
            <span className="squad-name">{p.name}{fitnessOf(p) < 85 ? <small className="squad-stats"> · tired ({fitnessOf(p)}%)</small> : null}</span>
            <span><Rating value={ovrAt(p, role)} /> here</span>
            <button className="btn btn-gold squad-buy" onClick={() => swap(i)}>Start</button>
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost btn-block" onClick={onDone}>Cancel</button>
    </Modal>
  )
}
