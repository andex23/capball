import { useState } from 'react'
import { useAccountStore } from '../state/accountStore'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Icon from './Icon'
import SavedGames from './SavedGames'

function timeAgo(iso) {
  if (!iso) return null
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

/** Sign up / sign in with just a username and password, or see who's signed in. */
/** `formOnly`: just the sign-in / create-account form (no saved games list) when signed out. */
export default function AccountPanel({ formOnly = false }) {
  const { username, busy, error, savedAt, saving } = useAccountStore()
  const { signIn, signUp, signOut, save } = useAccountStore.getState()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)

  if (username) {
    return (
      <div className="account">
        <div className="account-who">
          <span className="account-avatar" aria-hidden>{username.slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{username}</b>
            <small className="muted">{saving ? 'Saving…' : savedAt ? `Saved ${timeAgo(savedAt)}` : 'Signed in'}</small>
          </div>
        </div>
        <p className="muted account-note">Everything below is backed up to your account — sign in with the same username on another phone to carry on there.</p>
        <SavedGames />
        {error && <p className="t-warn" role="alert">{error}</p>}
        <div className="account-actions">
          <button className="btn btn-primary" onClick={() => { playButtonSelect(); save({ force: true }) }} disabled={saving}><Icon name="check" size={18} /> Save now</button>
          <button className="btn btn-secondary" onClick={() => { playButtonSelect(); signOut() }}><Icon name="exit" size={18} /> Sign out</button>
        </div>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const ok = await (mode === 'signup' ? signUp(name, pass) : signIn(name, pass))
    if (ok) playConfirm()
  }

  return (
    <div className="account">
    {!formOnly && <SavedGames />}
    <form className="account account-form" onSubmit={submit}>
      <h3 className="saved-h">Sign in to track stats and earn rewards</h3>
      <div className="segmented stretch" role="tablist">
        <button type="button" role="tab" aria-pressed={mode === 'signin'} aria-selected={mode === 'signin'} onClick={() => { playButtonSelect(); setMode('signin') }}>Sign in</button>
        <button type="button" role="tab" aria-pressed={mode === 'signup'} aria-selected={mode === 'signup'} onClick={() => { playButtonSelect(); setMode('signup') }}>Create account</button>
      </div>
      <p className="muted account-note">
        {mode === 'signup'
          ? 'Just a username and a password — no email. Your game is saved to it so you can come back on any phone.'
          : 'Sign in to load your saved games, tournaments and results.'}
      </p>
      <label className="eyebrow" htmlFor="acc-name">Username</label>
      <input id="acc-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} placeholder="e.g. dru_10" required />
      <label className="eyebrow" htmlFor="acc-pass">Password</label>
      <div className="account-pass">
        <input id="acc-pass" className="field" type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} maxLength={72} required />
        <button type="button" className="btn btn-ghost" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {mode === 'signup' && <p className="muted account-small">At least 6 characters. There’s no reset without an email, so remember it.</p>}
      {error && <p className="t-warn" role="alert">{error}</p>}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy || !name || pass.length < 6}>
        {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
    </form>
    </div>
  )
}
