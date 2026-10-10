/** Audio-only WebRTC. Signalling travels over the already authenticated match channel. */
export function createVoiceChat({ send, isHost, iceServers = [], onState = () => {},
  getUserMedia = constraints => navigator.mediaDevices.getUserMedia(constraints),
  PeerConnection = globalThis.RTCPeerConnection, createAudio = () => new Audio(),
  makeId = () => crypto.randomUUID(), gatherTimeout = 12000,
}) {
  let stream = null, pc = null, audio = null, localId = null, remoteId = null
  let generation = 0, disposed = false, pending = false, muted = false
  let cancelGather = null, connectTimer = null
  const publish = patch => { if (!disposed) onState(patch) }
  const transmit = data => {
    if (disposed) return
    try { send(data) } catch { /* Match reconnection owns a lost signalling channel. */ }
  }

  function closePeer() {
    clearTimeout(connectTimer)
    cancelGather?.()
    cancelGather = null
    if (pc) { pc.ontrack = null; pc.onconnectionstatechange = null; pc.close(); pc = null }
    if (audio) { audio.pause(); audio.srcObject = null; audio = null }
  }

  function leave(error = '') {
    generation++
    pending = false
    const id = localId
    localId = null
    closePeer()
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    muted = false
    if (id) transmit({ kind: 'leave', id })
    publish({ enabled: false, muted: false, status: 'off', error, needsPlayback: false })
  }

  function fail(error) { leave(error || 'Voice could not connect. You can keep playing and try voice again.') }

  async function playAudio() {
    const current = audio
    if (!current) return
    try { await current.play(); if (audio === current) publish({ needsPlayback: false }) }
    catch { if (audio === current) publish({ needsPlayback: true }) }
  }

  function openPeer() {
    const current = new PeerConnection({ iceServers })
    pc = current
    audio = createAudio()
    audio.autoplay = true
    audio.playsInline = true
    current.ontrack = event => {
      if (pc !== current || !event.streams?.[0]) return
      audio.srcObject = event.streams[0]
      void playAudio()
    }
    current.onconnectionstatechange = () => {
      if (pc !== current) return
      if (current.connectionState === 'connected') {
        clearTimeout(connectTimer)
        publish({ status: 'connected' })
      } else if (current.connectionState === 'failed') fail()
      else if (current.connectionState === 'disconnected') {
        publish({ status: 'connecting' })
        clearTimeout(connectTimer)
        connectTimer = setTimeout(() => { if (pc === current) fail() }, 15000)
      }
    }
    for (const track of stream.getAudioTracks()) current.addTrack(track, stream)
    connectTimer = setTimeout(() => { if (pc === current) fail() }, 30000)
    publish({ status: 'connecting' })
    return current
  }

  // Complete SDP avoids candidate ordering races and stays local-only for LAN.
  function gathered(current) {
    if (current.iceGatheringState === 'complete') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const done = error => {
        clearTimeout(timer)
        current.removeEventListener('icegatheringstatechange', change)
        if (cancelGather === cancel) cancelGather = null
        if (error) reject(error); else resolve()
      }
      const change = () => { if (current.iceGatheringState === 'complete') done() }
      const cancel = () => done(new Error('cancelled'))
      const timer = setTimeout(() => done(new Error('Voice connection timed out. Try again.')), gatherTimeout)
      cancelGather = cancel
      current.addEventListener('icegatheringstatechange', change)
      change()
    })
  }

  async function offer() {
    if (!isHost || !stream || !remoteId || pc) return
    const token = generation, from = localId, to = remoteId
    try {
      const current = openPeer()
      await current.setLocalDescription(await current.createOffer())
      await gathered(current)
      if (generation !== token || pc !== current) return
      transmit({ kind: 'sdp', from, to, description: { type: 'offer', sdp: current.localDescription.sdp } })
    } catch { if (generation === token) fail() }
  }

  async function enable() {
    if (disposed || stream || pending) return
    pending = true
    const token = ++generation
    publish({ status: 'permission', error: '' })
    try {
      if (!PeerConnection) throw new Error('unsupported')
      const result = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      if (disposed || generation !== token) { result.getTracks().forEach(track => track.stop()); return }
      if (!result.getAudioTracks().length) { result.getTracks().forEach(track => track.stop()); throw new Error('no-mic') }
      stream = result
      localId = makeId()
      for (const track of stream.getAudioTracks()) track.onended = () => { if (stream === result) leave('Microphone disconnected. Join voice again to reconnect it.') }
      publish({ enabled: true, muted: false, status: 'waiting', error: '' })
      transmit({ kind: 'ready', id: localId })
      await offer()
    } catch (error) {
      if (generation === token) fail(error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it in your browser settings, then try again.'
        : 'Microphone unavailable. Use HTTPS and a browser that supports microphone access.')
    } finally { if (generation === token) pending = false }
  }

  const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 80
  async function receive(data) {
    if (disposed || !data || typeof data !== 'object') return
    if (data.kind === 'ready' && validId(data.id)) {
      if (remoteId === data.id) return
      remoteId = data.id
      if (pc) generation++
      closePeer()
      publish({ remoteReady: true, ...(stream ? { status: 'waiting' } : {}) })
      if (stream) {
        transmit({ kind: 'ready', id: localId })
        await offer()
      }
      return
    }
    if (data.kind === 'leave' && data.id === remoteId) {
      if (pc) generation++
      remoteId = null
      closePeer()
      publish({ remoteReady: false, needsPlayback: false, ...(stream ? { status: 'waiting' } : {}) })
      return
    }
    if (data.kind !== 'sdp' || !stream || data.from !== remoteId || data.to !== localId) return
    const d = data.description
    if (!d || typeof d.sdp !== 'string' || d.sdp.length > 60000 || !d.sdp.startsWith('v=0')) return
    if (isHost ? d.type !== 'answer' || !pc || pc.signalingState !== 'have-local-offer' : d.type !== 'offer' || pc) return
    const token = generation
    try {
      const current = pc || openPeer()
      await current.setRemoteDescription({ type: d.type, sdp: d.sdp })
      if (generation !== token || pc !== current) return
      if (!isHost) {
        await current.setLocalDescription(await current.createAnswer())
        await gathered(current)
        if (generation !== token || pc !== current) return
        transmit({ kind: 'sdp', from: localId, to: remoteId, description: { type: 'answer', sdp: current.localDescription.sdp } })
      }
    } catch { if (generation === token) fail() }
  }

  return {
    enable, receive, leave, playAudio,
    toggleMute() {
      if (!stream) return
      muted = !muted
      stream.getAudioTracks().forEach(track => { track.enabled = !muted })
      publish({ muted })
    },
    dispose() { leave(); disposed = true; remoteId = null },
  }
}
