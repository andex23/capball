import { useMatchStore, SCREEN } from '../state/MatchStore'
import { playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

/** Top of the play-a-friend screens: back, the title, and Online / Same Wi-Fi. */
export function FriendTop({ mode, onBack }) {
  const go = (screen) => { playButtonSelect(); useMatchStore.getState().goToScreen(screen) }
  return (
    <>
      <header className="friend-top">
        <button className="tour-back" onClick={onBack} aria-label="Back"><Icon name="back" size={18} /></button>
        <div>
          <h1 className="display tour-title">Play a friend</h1>
          <div className="tour-sub">{mode === 'lan' ? 'Both phones on the same Wi-Fi or hotspot' : 'Online, from anywhere'}</div>
        </div>
      </header>
      <div className="segmented stretch friend-switch" role="group" aria-label="How you connect">
        <button aria-pressed={mode === 'online'} onClick={() => mode !== 'online' && go(SCREEN.ONLINE)}><Icon name="globe" size={14} /> Online</button>
        <button aria-pressed={mode === 'lan'} onClick={() => mode !== 'lan' && go(SCREEN.LAN)}><Icon name="wifi" size={14} /> Same Wi-Fi</button>
      </div>
    </>
  )
}

/** The match ticket: a stub and a body (the code boxes, or the scan button). */
export function FriendTicket({ stub, children, ...rest }) {
  return (
    <form className="friend-ticket" {...rest}>
      <span className="friend-ticket-stub" aria-hidden>{stub}</span>
      <div className="friend-ticket-body">{children}</div>
    </form>
  )
}

/** Six boxes for a room code; one real input sits over them. */
export function CodeBoxes({ value, length, onChange, disabled, label = 'Room code' }) {
  return (
    <label className="code-boxes">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length))}
        maxLength={length}
        aria-label={label}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        disabled={disabled}
      />
      {Array.from({ length }, (_, i) => (
        <i key={i} data-filled={value[i] ? 'true' : undefined} data-next={i === value.length ? 'true' : undefined} aria-hidden>{value[i] || ''}</i>
      ))}
    </label>
  )
}

/** The other ways to play a friend, as a short list. */
export function FriendLinks({ items }) {
  return (
    <nav className="friend-links" aria-label="More ways to play a friend">
      {items.map((it) => (
        <button key={it.title} onClick={() => { playButtonSelect(); it.onClick() }}>
          <span><b>{it.title}</b><small>{it.line}</small></span>
          <Icon name="next" size={16} />
        </button>
      ))}
    </nav>
  )
}
