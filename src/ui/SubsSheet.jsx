import { useState } from 'react'
import { create } from 'zustand'
import { useTournamentStore } from '../state/tournamentStore'
import { useCareerStore } from '../state/careerStore'
import { useMatchStore } from '../state/MatchStore'
import { ROLE_LABEL, MAX_SUBS, ovrAt } from '../game/squad'
import { CAP_ROLES } from '../data/TeamOptions'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'

/** The pause menu opens straight on substitutions when the corner button paused the match. */
export const useSubsShortcut = create(() => ({ open: false }))

/** Can this match make substitutions (a career match on this phone)? */
export const canSub = (playing) => !!playing?.lineup && !playing.lan

/** Career matches: how many changes are left; tapping pauses and opens substitutions. */
export function SubsButton() {
  const playing = useTournamentStore((s) => s.playing)
  if (!canSub(playing)) return null
  const left = MAX_SUBS - (playing.subs?.length || 0)
  return (
    <button className="icon-btn subs-btn" onClick={() => { playButtonSelect(); useSubsShortcut.setState({ open: true }); useMatchStore.getState().setPaused(true) }} aria-label={`Substitutions, ${left} left`} title="Substitutions">
      <Icon name="users" size={18} /><span className="subs-left">{left}</span>
    </button>
  )
}

/** Pick who comes off, then who comes on (shown from the pause menu, so the match waits). */
export default function SubsSheet({ onClose }) {
  const playing = useTournamentStore((s) => s.playing)
  const career = useCareerStore((s) => s.career)
  const [off, setOff] = useState(null)
  const [error, setError] = useState(null)
  const close = () => onClose()
  if (!playing?.lineup || !career) return null
  const left = MAX_SUBS - (playing.subs?.length || 0)
  const everyone = [...Object.values(career.squad), ...(career.bench || [])]
  const byId = (id) => everyone.find((p) => p.id === id)
  const usedOff = new Set((playing.subs || []).map((s) => s.outId))
  const onPitch = new Set(Object.values(playing.lineup))
  const available = (career.bench || []).filter((p) => !onPitch.has(p.id) && !usedOff.has(p.id))

  const bringOn = (p) => {
    const why = useTournamentStore.getState().substitute(off, p.id)
    if (why) { setError(why === 'keeper-for-keeper' ? 'Only a keeper can replace the keeper.' : why === 'no-subs-left' ? 'You’ve made all three changes.' : 'He can’t come on.'); return }
    playConfirm()
    close()
  }

  return (
    <Modal title={`Substitutions · ${left} left`} onClose={close}>
      <div className="subs-sheet">
        {left <= 0 ? <p className="muted">You’ve made all three changes.</p> : !off ? (
          <>
            <p className="muted t-note">Who comes off?</p>
            <ul className="squad-list">
              {CAP_ROLES.map((role) => {
                const p = byId(playing.lineup[role])
                return (
                  <li key={role}>
                    <span className="squad-role">{ROLE_LABEL[role]}</span>
                    <span className="squad-name"><span className="squad-name-main">{p?.name}</span></span>
                    <b className="squad-rating">{p ? ovrAt(p, role) : ''}</b>
                    <button className="btn btn-secondary squad-buy" onClick={() => { playButtonSelect(); setError(null); setOff(role) }}>Off</button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="muted t-note">{byId(playing.lineup[off])?.name} ({ROLE_LABEL[off]}) comes off. Who comes on?</p>
            {available.length === 0 && <p className="muted">Nobody left on the bench.</p>}
            <ul className="squad-list">
              {available.map((p) => {
                const fits = (off === 'gk') === (p.pos === 'GK')
                return (
                  <li key={p.id}>
                    <span className="squad-role">{p.pos}</span>
                    <span className="squad-name"><span className="squad-name-main">{p.name}</span>{fits && p.pos !== ROLE_LABEL[off] && <small className="squad-stats">plays {ROLE_LABEL[off]} at {ovrAt(p, off)}</small>}</span>
                    <b className="squad-rating">{fits ? ovrAt(p, off) : p.rating}</b>
                    <button className="btn btn-gold squad-buy" disabled={!fits} onClick={() => bringOn(p)}>On</button>
                  </li>
                )
              })}
            </ul>
            <button className="btn btn-ghost btn-block" onClick={() => { playButtonSelect(); setOff(null) }}><Icon name="back" size={16} /> Pick someone else</button>
          </>
        )}
        {error && <p className="t-warn" role="alert">{error}</p>}
        <p className="muted t-note">Three changes a match. A player taken off can’t come back on.</p>
      </div>
    </Modal>
  )
}
