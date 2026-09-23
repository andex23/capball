import { useState } from 'react'
import Icon from '../ui/Icon'
import { playConfirm, playButtonSelect } from '../audio/SoundManager'
import { useCanInstall, promptInstall, shouldShowIosHint, isStandalone, readHintDismissed, rememberHintDismissed } from './install'

function storage() {
  try { return window.localStorage } catch { return null }
}

function DownloadGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" />
    </svg>
  )
}

/** Main-menu "Install" button (Chromium) or "Add to Home Screen" hint (iOS). Renders nothing otherwise. */
export default function InstallPrompt() {
  const canInstall = useCanInstall()
  const [iosHint, setIosHint] = useState(() => shouldShowIosHint({
    nav: navigator,
    standalone: isStandalone(),
    dismissed: readHintDismissed(storage()),
  }))

  if (canInstall) {
    return (
      <button className="btn btn-gold install-btn" onClick={() => { playConfirm(); promptInstall() }}>
        <DownloadGlyph /> Install app
      </button>
    )
  }

  if (!iosHint) return null
  return (
    <div className="install-hint" role="note">
      <Icon name="share" size={18} />
      <span>Play full screen: tap <b>Share</b>, then <b>Add to Home Screen</b>.</span>
      <button
        className="install-hint-close"
        aria-label="Dismiss install tip"
        onClick={() => { playButtonSelect(); rememberHintDismissed(storage()); setIosHint(false) }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
