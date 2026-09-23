import { useEffect, useRef } from 'react'
import Icon from './Icon'

/** Centered dialog with backdrop. Closes on Escape and backdrop click. */
export default function Modal({ title, onClose, children, footer }) {
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      <div className="card sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2 className="display" style={{ fontSize: 30 }}>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  )
}
