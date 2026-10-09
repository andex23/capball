/** Shared pieces of the 16-bit look: the night-stadium backdrop and the logo. */
export function RetroBackdrop() {
  return (
    <>
      <div className="iss-sky" aria-hidden="true" />
      <div className="iss-pitch" aria-hidden="true" />
      <div className="iss-scan" aria-hidden="true" />
    </>
  )
}

export function RetroLogo({ ribbon = 'Tabletop Football', as: Tag = 'h1' }) {
  return (
    <header className="iss-brand">
      <Tag className="iss-logo" aria-label="Capball">
        <span className="iss-logo-depth" aria-hidden="true">CAPBALL</span>
        <span className="iss-logo-word">CAPBALL</span>
      </Tag>
      {ribbon && <div className="iss-ribbon">{ribbon}</div>}
    </header>
  )
}
