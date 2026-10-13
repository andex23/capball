import { useEffect, useState } from 'react'
import { useAccountStore } from '../state/accountStore'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Icon from './Icon'
import SavedGames from './SavedGames'
import { isLagos } from '../platform'
import { LagosAccount } from '../lagos/LagosPanels'

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
export default function AccountPanel(props) {
  // In Lagos Life the player is already signed in there; there's no Counterball account
  return isLagos() ? <LagosAccount {...props} /> : <CounterballAccount {...props} />
}

function CounterballAccount({ formOnly = false }) {
  const { username, busy, error, savedAt, saving } = useAccountStore()
  const { signIn, signUp, signOut, save } = useAccountStore.getState()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
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
        <RecoverySection />
        <SavedGames />
        {error && <p className="t-warn" role="alert">{error}</p>}
        <div className="account-actions">
          <button className="btn btn-primary" onClick={() => { playButtonSelect(); save({ force: true }) }} disabled={saving}><Icon name="check" size={18} /> Save now</button>
          <button className="btn btn-secondary" onClick={() => { playButtonSelect(); signOut() }}><Icon name="exit" size={18} /> Sign out</button>
        </div>
      </div>
    )
  }

  if (mode === 'forgot') return <ForgotPassword initialName={name} onBack={() => { useAccountStore.setState({ error: null }); setMode('signin') }} />

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
      <input id="acc-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} placeholder="e.g. capking_9" required />
      <label className="eyebrow" htmlFor="acc-pass">Password</label>
      <div className="account-pass">
        <input id="acc-pass" className="field" type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} maxLength={72} required />
        <button type="button" className="btn btn-ghost" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {mode === 'signup' && <p className="muted account-small">At least 6 characters. Next you’ll get a recovery code: keep it, it’s how you get back in if you forget your password.</p>}
      {error && <p className="t-warn" role="alert">{error}</p>}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy || !name || pass.length < 6}>
        {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
      {mode === 'signin' && (
        <button type="button" className="btn btn-ghost account-forgot" onClick={() => { playButtonSelect(); useAccountStore.setState({ error: null }); setMode('forgot') }}>Forgot password?</button>
      )}
    </form>
    </div>
  )
}

/** Signed in: make sure the player has a recovery code, or make a new one. */
function RecoverySection() {
  const has = useAccountStore((s) => s.hasRecovery)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { useAccountStore.getState().checkRecovery() }, [])
  const make = async () => {
    setBusy(true)
    if (await useAccountStore.getState().newRecoveryCode()) playConfirm()
    setBusy(false)
    setConfirm(false)
  }
  if (has === null) return null
  if (!has) {
    return (
      <div className="account-recovery" data-tone="warn">
        <b>Save a recovery code</b>
        <p className="account-small">It’s how you get back in if you forget your password. It takes a second.</p>
        <button className="btn btn-gold" disabled={busy} onClick={make}>{busy ? 'One moment…' : 'Get my recovery code'}</button>
      </div>
    )
  }
  return (
    <div className="account-recovery">
      <p className="account-small muted">You have a recovery code saved. Lost it? Make a new one; the old one stops working.</p>
      {confirm
        ? <button className="btn btn-secondary" disabled={busy} onClick={make}>{busy ? 'One moment…' : 'Yes, make a new code'}</button>
        : <button className="btn btn-ghost" onClick={() => { playButtonSelect(); setConfirm(true) }}>New recovery code</button>}
    </div>
  )
}

/** Signed out, forgot password: use a recovery code, or ask for help. */
function ForgotPassword({ initialName = '', onBack }) {
  const { busy, error } = useAccountStore()
  const [way, setWay] = useState('code') // 'code' | 'help'
  const [name, setName] = useState(initialName)
  const [code, setCode] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const pick = (w) => { playButtonSelect(); useAccountStore.setState({ error: null }); setWay(w) }
  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (way === 'code') {
      if (await useAccountStore.getState().recover(name.trim(), code, pass)) playConfirm()
    } else if (await useAccountStore.getState().askHelp(name.trim(), contact.trim(), note.trim())) {
      playConfirm()
      setSent(true)
    }
  }
  if (sent) {
    return (
      <div className="account account-form">
        <h3 className="saved-h">Request sent</h3>
        <p className="account-note">We’ll check it’s your account and get back to you at <b>{contact.trim()}</b> with a new password. It can take a little while.</p>
        <button className="btn btn-secondary btn-block" onClick={onBack}>Back to sign in</button>
      </div>
    )
  }
  return (
    <form className="account account-form" onSubmit={submit}>
      <h3 className="saved-h">Forgot your password?</h3>
      <div className="segmented stretch" role="tablist">
        <button type="button" role="tab" aria-pressed={way === 'code'} aria-selected={way === 'code'} onClick={() => pick('code')}>I have my code</button>
        <button type="button" role="tab" aria-pressed={way === 'help'} aria-selected={way === 'help'} onClick={() => pick('help')}>I don’t have it</button>
      </div>
      <p className="muted account-note">
        {way === 'code'
          ? 'Enter your username, the recovery code you saved, and a new password.'
          : 'Leave your username and how to reach you. We’ll check it’s really your account and send you a new password.'}
      </p>
      <label className="eyebrow" htmlFor="fp-name">Username</label>
      <input id="fp-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} required />
      {way === 'code' ? (
        <>
          <label className="eyebrow" htmlFor="fp-code">Recovery code</label>
          <input id="fp-code" className="field recovery-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false} maxLength={20} placeholder="XXXX-XXXX-XXXX" required />
          <label className="eyebrow" htmlFor="fp-pass">New password</label>
          <div className="account-pass">
            <input id="fp-pass" className="field" type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" minLength={6} maxLength={72} required />
            <button type="button" className="btn btn-ghost" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </>
      ) : (
        <>
          <label className="eyebrow" htmlFor="fp-contact">How can we reach you?</label>
          <input id="fp-contact" className="field" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="WhatsApp number, Instagram or email" required />
          <label className="eyebrow" htmlFor="fp-note">Anything that shows it’s you (optional)</label>
          <textarea id="fp-note" className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="Your career club’s name, your team name, roughly when you joined" />
        </>
      )}
      {error && <p className="t-warn" role="alert">{error}</p>}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy || !name.trim() || (way === 'code' ? code.replace(/[^A-Z0-9]/gi, '').length < 12 || pass.length < 6 : contact.trim().length < 3)}>
        {busy ? 'One moment…' : way === 'code' ? 'Set new password and sign in' : 'Send request'}
      </button>
      <button type="button" className="btn btn-ghost account-forgot" onClick={onBack}>Back to sign in</button>
    </form>
  )
}
