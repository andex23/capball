import { useState } from 'react'
import { useAccountStore } from '../state/accountStore'
import { playButtonSelect, playConfirm } from '../audio/SoundManager'
import Modal from './Modal'
import Icon from './Icon'

/**
 * A new recovery code, shown once: on sign-up, after using a code, or when the
 * player makes a new one. Stays up (even through a reload) until they say
 * they've saved it.
 */
export default function RecoveryCodePrompt() {
  const code = useAccountStore((s) => s.recoveryCode)
  const username = useAccountStore((s) => s.username)
  const [copied, setCopied] = useState(false)
  const [sure, setSure] = useState(false)
  if (!code) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Counterball recovery code for ${username || 'my account'}: ${code}`); setCopied(true); playConfirm() } catch { setCopied(false) }
  }
  const done = () => { playButtonSelect(); setSure(false); setCopied(false); useAccountStore.getState().recoverySaved() }
  return (
    <Modal title="Your recovery code">
      <p>If you ever forget your password, this code and your username get you back in. Screenshot it or copy it somewhere safe. We can’t show it again.</p>
      <div className="recovery-code" aria-label={`Recovery code ${code.split('').join(' ')}`}>
        {code.split('-').map((part) => <span key={part}>{part}</span>)}
      </div>
      {username && <p className="muted account-small">For username <b>{username}</b>. Each code works once; you’ll get a new one when you use it.</p>}
      <div className="account-actions">
        <button className="btn btn-secondary" onClick={copy}><Icon name="check" size={18} /> {copied ? 'Copied' : 'Copy code'}</button>
        {sure
          ? <button className="btn btn-gold" onClick={done}>Yes, I’ve saved it</button>
          : <button className="btn btn-primary" onClick={() => setSure(true)}>I’ve saved it</button>}
      </div>
      {sure && <p className="muted account-small">Sure? Once you close this, the code can’t be shown again.</p>}
    </Modal>
  )
}
