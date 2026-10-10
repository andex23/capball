import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { isLanSignal } from '../multiplayer/lan'
import { useTournamentStore } from '../state/tournamentStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { createLanRoom, joinLanRoom, finishLanPairing, disconnect, getIsHost } from '../multiplayer/MultiplayerManager'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import './lan.css'

function PairingCode({ value, reply }) {
  const [image, setImage] = useState('')
  const container = useRef(null)
  const [width, setWidth] = useState(260)
  const [grid, setGrid] = useState(0)
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const [copied, setCopied] = useState(false)
  const [qrError, setQrError] = useState(false)
  useEffect(() => {
    let active = true
    setImage('')
    setQrError(false)
    try { setGrid(QRCode.create(value, { errorCorrectionLevel: 'L' }).modules.size + 8) } catch { setGrid(0) }
    QRCode.toDataURL(value, { scale: 6, margin: 4, errorCorrectionLevel: 'L' })
      .then(url => { if (active) setImage(url) }).catch(() => { if (active) setQrError(true) })
    return () => { active = false }
  }, [value])
  return <div className="lan-code" ref={container}>
    <p>{reply ? 'Show this reply to the host. The host scans it to finish pairing.' : 'On your friend’s device: LAN Match → Join LAN match → Scan host’s invite.'}</p>
    <p className="muted">Scan inside Counterball, not your phone’s Camera app. Update the game on both devices before pairing.</p>
    {qrError && <p role="alert">This connection is too large for a QR code. Use the complete copy-and-paste code below.</p>}
    {image && <img src={image} style={{ width: grid ? Math.max(1, Math.floor(Math.min(width, 360) / grid)) * grid : 260 }} width="260" height="260" alt={reply ? 'LAN reply QR code' : 'LAN invite QR code'} />}
    <details><summary>Copy pairing code instead</summary>
      <textarea className="field" readOnly value={value} aria-label="Your pairing code" onFocus={e => e.target.select()} />
      <button className="btn btn-secondary btn-block" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true) } catch { setCopied(false) } }}>{copied ? 'Copied' : 'Copy code'}</button>
      <p className="muted">Transfer the complete code to the other device and paste it there.</p>
    </details>
  </div>
}

function Scanner({ onRead, onClose }) {
  const video = useRef(null)
  const read = useRef(onRead)
  read.current = onRead
  const [error, setError] = useState('')
  const [hint, setHint] = useState('Hold the whole QR code in view. Move closer if it is small.')
  useEffect(() => {
    let stream, timer, ended = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const scan = () => {
      const v = video.current
      if (ended || !v) return
      if (v.readyState >= 2 && v.videoWidth) {
        canvas.width = Math.min(v.videoWidth, 1600)
        canvas.height = canvas.width * v.videoHeight / v.videoWidth
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(frame.data, frame.width, frame.height)
        if (isLanSignal(code?.data)) { read.current(code.data); return }
        if (code?.data) setHint('That is not a LAN pairing code. Scan the invite or reply shown inside LAN Match.')
      }
      timer = setTimeout(scan, 180)
    }
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable. Use the copy-and-paste pairing option.')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (ended) { stream.getTracks().forEach(t => t.stop()); return }
        video.current.srcObject = stream
        await video.current.play()
        scan()
      } catch { if (!ended) setError('Camera unavailable. Allow camera access or use the copy-and-paste option.') }
    }
    start()
    return () => { ended = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()) }
  }, [])
  return <Modal title="Scan pairing code" onClose={onClose}>
    {error ? <p role="alert">{error}</p> : <video className="lan-camera" ref={video} muted playsInline autoPlay />}
    <p className="muted" role="status">{hint}</p>
  </Modal>
}

export default function LanScreen() {
  const fixture = useTournamentStore(s => s.playing)
  const hostingFixture = fixture?.lan && fixture.kind !== 'lanGuest'
  const status = useMatchStore(s => s.onlineStatus)
  const [step, setStep] = useState('choose')
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [scan, setScan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    if (status.status !== 'connected') return
    // Only the host advances screens; the guest waits for the authoritative snapshot.
    if (!getIsHost()) return
    const timer = setTimeout(() => {
      const p = useTournamentStore.getState().playing
      useMatchStore.getState().goToScreen(p?.kind === 'career' ? SCREEN.FORMATION : SCREEN.TEAM_SELECT)
    }, 500)
    return () => clearTimeout(timer)
  }, [status.status])
  const perform = async (action, nextStep) => {
    const version = ++generation.current
    setBusy(true); setError('')
    try {
      const result = await action()
      if (generation.current === version) {
        if (result) setCode(result)
        if (nextStep) setStep(nextStep)
      }
    } catch (e) { if (generation.current === version) setError(e.message || 'Pairing failed. Try again.') }
    finally { if (generation.current === version) setBusy(false) }
  }
  const receive = value => {
    setScan(false); setInput(value)
    if (step === 'host') perform(() => finishLanPairing(value))
    else perform(() => joinLanRoom(value), 'reply')
  }
  const back = () => {
    generation.current++; disconnect(); setBusy(false); setCode(''); setInput(''); setError('')
    if (step === 'choose') {
      if (hostingFixture) useTournamentStore.getState().backToHub()
      else useMatchStore.getState().goToScreen(SCREEN.MENU)
    }
    else setStep('choose')
  }
  return <div className="screen online-screen lan-screen">
    <section className="card lan-panel">
      <div className="sheet-head"><div><div className="eyebrow">Same Wi-Fi · No internet needed</div><h1 className="display">{hostingFixture ? 'LAN fixture' : 'LAN Match'}</h1></div></div>
      <div className="sheet-body">
        {step === 'choose' ? <>
          <p>Connect both devices to the same Wi-Fi or phone hotspot. One player hosts; the other joins.</p>
          <p className="muted">Load or install Counterball on both devices before going offline. Brief interruptions pause the match for up to two minutes. Return to the game to resume; do not close or reload it.</p>
          <button className="btn btn-gold btn-block" onClick={() => { setStep('host'); perform(createLanRoom) }}>Host LAN match</button>
          {!hostingFixture && <button className="btn btn-blue btn-block" onClick={() => setStep('join')}>Join LAN match</button>}
          {hostingFixture ? <p className="muted">You control {useMatchStore.getState().teamConfig.team1.name}. Your friend controls {useMatchStore.getState().teamConfig.team2.name}. Progress is saved on this host device.</p> : <>
            <button className="btn btn-secondary btn-block" onClick={() => { useTournamentStore.getState().setLocalTransport('lan'); useMatchStore.getState().goToScreen(SCREEN.TOURNAMENT_HOME) }}>LAN cups &amp; leagues</button>
            <button className="btn btn-secondary btn-block" onClick={() => useMatchStore.getState().goToScreen(SCREEN.CAREER)}>Career · play a friend over LAN</button>
            <p className="muted">For cups, leagues and career, the host opens a fixture and chooses LAN. The other player joins here.</p>
          </>}
        </> : <>
          <h2 className="eyebrow">{step === 'host' ? '1. Share invite · 2. Scan reply' : step === 'reply' ? 'Let the host scan your reply' : 'Scan the host’s invite'}</h2>
          {code && <PairingCode value={code} reply={step === 'reply'} />}
          {step !== 'reply' && (!busy || code) && <>
            <button className="btn btn-blue btn-block" disabled={busy} onClick={() => setScan(true)}>{step === 'host' ? 'Scan guest’s reply' : 'Scan host’s invite'}</button>
            <details><summary>Paste a pairing code instead</summary>
              <textarea className="field" value={input} onChange={e => setInput(e.target.value)} maxLength={48000} aria-label={step === 'host' ? 'Guest reply code' : 'Host invite code'} spellCheck={false} autoCapitalize="off" />
              <button className="btn btn-secondary btn-block" disabled={busy || !input.trim()} onClick={() => receive(input)}>Connect</button>
            </details>
          </>}
          {busy && <p role="status">Preparing local connection…</p>}
          {step === 'reply' && <p role="status">Waiting for the host to scan your reply…</p>}
        </>}
        {status.status === 'connected' && <p role="status">Connected over LAN. Opening match setup…</p>}
        {(error || ['error', 'disconnected'].includes(status.status)) && <p role="alert">{error || status.msg}</p>}
        <button className="btn btn-ghost btn-block" onClick={back}><Icon name="back" size={16} /> Back</button>
      </div>
    </section>
    {scan && <Scanner onRead={receive} onClose={() => setScan(false)} />}
  </div>
}
