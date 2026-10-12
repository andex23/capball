import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { isLanSignal } from '../multiplayer/lan'
import { lanInviteUrl, readLanInvite, isAutomaticLanInvite } from '../multiplayer/lanInvite'
import { useTournamentStore } from '../state/tournamentStore'
import { useMatchStore, SCREEN } from '../state/MatchStore'
import { createLanRoom, joinLanRoom, createAutomaticLanRoom, joinAutomaticLanRoom, finishLanPairing, disconnect, getIsHost } from '../multiplayer/MultiplayerManager'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import './lan.css'

function PairingCode({ value, reply }) {
  const qrValue = reply ? value : lanInviteUrl(value)
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
    try { setGrid(QRCode.create(qrValue, { errorCorrectionLevel: 'L' }).modules.size + 8) } catch { setGrid(0) }
    QRCode.toDataURL(qrValue, { scale: 6, margin: 4, errorCorrectionLevel: 'L' })
      .then(url => { if (active) setImage(url) }).catch(() => { if (active) setQrError(true) })
    return () => { active = false }
  }, [qrValue])
  return <div className="lan-code" ref={container}>
    <p>{reply ? 'Show this reply to the host. The host scans it to finish pairing.' : 'Your friend can scan this invite with their phone’s Camera app to open Counterball and join.'}</p>
    <p className="muted">{reply ? "Host: use Scan guest’s reply inside the game. Keep your host session open." : isAutomaticLanInvite(value) ? "Keep this screen open. Internet is needed only until pairing finishes; the match then stays local." : "The in-game scanner works too. Both devices must use the same Wi-Fi or hotspot. Load the game before going offline."}</p>
    {qrError && <p role="alert">This connection is too large for a QR code. Use the complete copy-and-paste code below.</p>}
    {image && <img src={image} style={{ width: grid ? Math.max(1, Math.floor(Math.min(width, 360) / grid)) * grid : 260 }} width="260" height="260" alt={reply ? 'LAN reply QR code' : 'LAN invite QR code'} />}
    <details><summary>{reply ? 'Copy pairing code instead' : 'Copy invite link instead'}</summary>
      <textarea className="field" readOnly value={qrValue} aria-label="Your pairing code" onFocus={e => e.target.select()} />
      <button className="btn btn-secondary btn-block" onClick={async () => { try { await navigator.clipboard.writeText(qrValue); setCopied(true) } catch { setCopied(false) } }}>{copied ? 'Copied' : reply ? 'Copy code' : 'Copy invite link'}</button>
      <p className="muted">{reply ? 'Transfer the complete reply to the host and paste it there.' : 'Open this link on your friend’s phone, or paste it into Join LAN match.'}</p>
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
        const signal = isLanSignal(code?.data) || isAutomaticLanInvite(code?.data) ? code.data : readLanInvite(code?.data)
        if (signal) { read.current(signal); return }
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
  const [invite] = useState(() => readLanInvite(window.location.href))
  const [step, setStep] = useState(() => window.location.hash.startsWith('#lan=') ? 'join' : 'choose')
  const [manual, setManual] = useState(() => !!invite && !isAutomaticLanInvite(invite))
  const [code, setCode] = useState('')
  const [input, setInput] = useState(invite)
  const [scan, setScan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => window.location.hash.startsWith('#lan=') && !invite ? 'This LAN invite is incomplete. Ask the host to generate a new invite.' : '')
  useEffect(() => {
    if (window.location.hash.startsWith('#lan=')) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])
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
    value = readLanInvite(value) || value
    setScan(false); setInput(value)
    if (step === 'host' && manual) perform(() => finishLanPairing(value))
    else if (isAutomaticLanInvite(value)) {
      setManual(false)
      perform(() => joinAutomaticLanRoom(value), 'connecting')
    } else {
      setManual(true)
      perform(() => joinLanRoom(value), 'reply')
    }
  }
  const host = offline => {
    setManual(offline); setCode(''); setInput(''); setStep('host')
    perform(offline ? createLanRoom : createAutomaticLanRoom)
  }
  const back = () => {
    generation.current++; disconnect(); setBusy(false); setCode(''); setInput(''); setError('')
    if (step === 'choose') {
      if (hostingFixture) useTournamentStore.getState().backToHub()
      else useMatchStore.getState().goToScreen(SCREEN.MENU)
    }
    else { setStep('choose'); setManual(false) }
  }
  return <div className="screen online-screen lan-screen">
    <section className="card lan-panel">
      <div className="sheet-head"><div><div className="eyebrow">{manual ? 'Same Wi-Fi · Offline pairing' : 'Same Wi-Fi · Scan once to join'}</div><h1 className="display">{hostingFixture ? 'LAN fixture' : 'LAN Match'}</h1></div></div>
      <div className="sheet-body">
        {step === 'choose' ? <>
          <p>Connect both devices to the same Wi-Fi or phone hotspot. Your friend scans your invite and joins — no reply scan.</p>
          <p className="muted">Automatic pairing needs internet briefly. Once connected, play stays on your local network and can continue without internet. Keep the game open on both devices.</p>
          <button className="btn btn-gold btn-block" onClick={() => host(false)}>Host LAN match</button>
          {!hostingFixture && <button className="btn btn-blue btn-block" onClick={() => setStep('join')}>Join LAN match</button>}
          <details><summary>No internet? Offline pairing</summary><p className="muted">Load the game on both devices before going offline. With no internet at all, exchange an invite and reply inside the game.</p><button className="btn btn-secondary btn-block" onClick={() => host(true)}>Host offline match</button></details>
          {hostingFixture ? <p className="muted">You control {useMatchStore.getState().teamConfig.team1.name}. Your friend controls {useMatchStore.getState().teamConfig.team2.name}. Progress is saved on this host device.</p> : <>
            <button className="btn btn-secondary btn-block" onClick={() => { useTournamentStore.getState().setLocalTransport('lan'); useMatchStore.getState().goToScreen(SCREEN.TOURNAMENT_HOME) }}>LAN cups &amp; leagues</button>
            <button className="btn btn-secondary btn-block" onClick={() => useMatchStore.getState().goToScreen(SCREEN.CAREER)}>Career · play a friend over LAN</button>
            <p className="muted">For cups, leagues and career, the host opens a fixture and chooses LAN. The other player joins here.</p>
          </>}
        </> : <>
          <h2 className="eyebrow">{step === 'host' ? manual ? 'Offline: share invite · scan reply' : 'Your friend scans once · connects automatically' : step === 'reply' ? 'Let the host scan your reply' : invite ? 'Host invite loaded' : 'Scan the host’s invite'}</h2>
          {step === 'join' && invite && <div className="lan-invite-ready"><p>Host invite loaded. Keep the host’s game open and connect both devices to the same Wi-Fi or hotspot.</p>{isAutomaticLanInvite(invite) && <p className="muted">Keep internet available until pairing finishes. You will connect automatically — no reply scan.</p>}<button className="btn btn-gold btn-block" disabled={busy} onClick={() => receive(invite)}>Join this host</button></div>}
          {code && <PairingCode value={code} reply={step === 'reply'} />}
          {step !== 'reply' && step !== 'connecting' && (step !== 'host' || manual) && (!busy || code) && <>
            <button className="btn btn-blue btn-block" disabled={busy} onClick={() => setScan(true)}>{step === 'host' ? 'Scan guest’s reply' : 'Scan host’s invite'}</button>
            <details><summary>Paste a pairing code instead</summary>
              <textarea className="field" value={input} onChange={e => setInput(e.target.value)} maxLength={48000} aria-label={step === 'host' ? 'Guest reply code' : 'Host invite code'} spellCheck={false} autoCapitalize="off" />
              <button className="btn btn-secondary btn-block" disabled={busy || !input.trim()} onClick={() => receive(input)}>Connect</button>
            </details>
          </>}
          {busy && <p role="status">{manual ? 'Preparing local connection…' : step === 'host' ? 'Preparing your invite…' : status.msg || 'Connecting to the host automatically…'}</p>}
          {step === 'host' && !manual && code && <p role="status">Waiting for your friend to join. Keep this screen open — there is nothing else to scan.</p>}
          {step === 'host' && !manual && !busy && <button className="btn btn-ghost btn-block" onClick={() => host(true)}>Use offline pairing instead</button>}
          {step === 'connecting' && <p role="status">Opening match setup…</p>}
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
