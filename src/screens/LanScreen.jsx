import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { createLanRoom, joinLanRoom, finishLanPairing, disconnect } from '../multiplayer/MultiplayerManager'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import './lan.css'

function PairingCode({ value, reply }) {
  const [image, setImage] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let active = true
    setImage('')
    QRCode.toDataURL(value, { scale: 6, margin: 4, errorCorrectionLevel: 'L' })
      .then(url => { if (active) setImage(url) }).catch(() => {})
    return () => { active = false }
  }, [value])
  return <div className="lan-code">
    <p>{reply ? 'Show this reply to the host. The host scans it to finish pairing.' : 'Your friend scans this invite on their device.'}</p>
    {image && <img src={image} width="260" height="260" alt={reply ? 'LAN reply QR code' : 'LAN invite QR code'} />}
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
  useEffect(() => {
    let stream, timer, ended = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const scan = () => {
      const v = video.current
      if (ended || !v) return
      if (v.readyState >= 2 && v.videoWidth) {
        canvas.width = Math.min(v.videoWidth, 800)
        canvas.height = canvas.width * v.videoHeight / v.videoWidth
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(frame.data, frame.width, frame.height)
        if (code?.data?.startsWith('CAPBALL-LAN1:')) { read.current(code.data); return }
      }
      timer = setTimeout(scan, 180)
    }
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable. Use the copy-and-paste pairing option.')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
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
    <p className="muted">Point at the code on the other device.</p>
  </Modal>
}

export default function LanScreen() {
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
    const timer = setTimeout(() => useMatchStore.getState().goToScreen(SCREEN.TEAM_SELECT), 500)
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
    if (step === 'choose') useMatchStore.getState().goToScreen(SCREEN.MENU)
    else setStep('choose')
  }
  return <div className="screen online-screen lan-screen">
    <section className="card lan-panel">
      <div className="sheet-head"><div><div className="eyebrow">Same Wi-Fi · No internet needed</div><h1 className="display">LAN Match</h1></div></div>
      <div className="sheet-body">
        {step === 'choose' ? <>
          <p>Connect both devices to the same Wi-Fi or phone hotspot. One player hosts; the other joins.</p>
          <p className="muted">Load or install CapBall on both devices before going offline. Keep both games open while playing.</p>
          <button className="btn btn-gold btn-block" onClick={() => { setStep('host'); perform(createLanRoom) }}>Host LAN match</button>
          <button className="btn btn-blue btn-block" onClick={() => setStep('join')}>Join LAN match</button>
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
        {status.status === 'connected' && <p role="status">Connected over LAN. Opening team selection…</p>}
        {(error || ['error', 'disconnected'].includes(status.status)) && <p role="alert">{error || status.msg}</p>}
        <button className="btn btn-ghost btn-block" onClick={back}><Icon name="back" size={16} /> Back</button>
      </div>
    </section>
    {scan && <Scanner onRead={receive} onClose={() => setScan(false)} />}
  </div>
}
