function voiceError(code) { return Object.assign(new Error(code), { name: code }) }

export function requestMicrophone(constraints) {
  if (globalThis.isSecureContext === false) throw voiceError('InsecureContext')
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) throw voiceError('MediaUnsupported')
  return navigator.mediaDevices.getUserMedia(constraints)
}

// Voice IDs correlate messages on an already authenticated channel. Use the widely
// supported Web Crypto API rather than requiring the newer randomUUID method.
export function voiceSessionId() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function microphoneErrorMessage(error, stage = 'capture') {
  switch (error?.name) {
    case 'NotAllowedError': case 'PermissionDeniedError': case 'SecurityError':
      return 'Microphone access was denied. On iPhone, open Safari’s website settings and set Microphone to Allow, then join voice again. [MIC_PERMISSION]'
    case 'NotReadableError': case 'TrackStartError': case 'AbortError':
      return 'Your phone could not start the microphone. End any phone or voice call, close other apps using the microphone, then try again. [MIC_BUSY]'
    case 'NotFoundError': case 'DevicesNotFoundError': case 'NoMicrophone':
      return 'No microphone was found. Check your headset or use the phone’s built-in microphone, then try again. [MIC_MISSING]'
    case 'OverconstrainedError': case 'ConstraintNotSatisfiedError':
      return 'Your microphone could not use these audio settings. Try the phone’s built-in microphone. [MIC_SETTINGS]'
    case 'InsecureContext':
      return 'Microphone access needs a secure connection. Open the game using its HTTPS address. [MIC_HTTPS]'
    case 'MediaUnsupported': case 'VoiceUnsupported':
      return 'This browser does not provide voice access. Open the game directly in Safari or Chrome and join the match there. [MIC_BROWSER]'
    default: {
      // Report only a bounded browser error category, never device names, SDP or raw messages.
      const category = ['TypeError', 'UnknownError', 'InvalidStateError', 'NotSupportedError', 'Error'].includes(error?.name) ? error.name : 'Other'
      const step = stage === 'session' ? 'SESSION' : stage === 'tracks' ? 'TRACKS' : 'CAPTURE'
      return `Voice could not start ${stage === 'capture' ? 'the microphone' : 'the voice session'}. Try joining again. If it fails, share this code: [VOICE_${step}_${category}]`
    }
  }
}

/** Audio-only WebRTC. Signalling travels over the already authenticated match channel. */
export function createVoiceChat({ send, isHost, iceServers = [], onState = () => {},
  getUserMedia = requestMicrophone,
  PeerConnection = globalThis.RTCPeerConnection, createAudio = () => new Audio(),
  makeId = voiceSessionId, gatherTimeout = 12000,
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
    let stage = 'capture'
    try {
      if (!PeerConnection) throw voiceError('VoiceUnsupported')
      let result
      try {
        result = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      } catch (error) {
        if (disposed || generation !== token) return
        if (!['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(error?.name)) throw error
        // Some phone/headset combinations reject processing settings. Keep capture audio-only.
        result = await getUserMedia({ audio: true, video: false })
      }
      if (disposed || generation !== token) { result.getTracks().forEach(track => track.stop()); return }
      stage = 'tracks'
      if (!result.getAudioTracks().length) { result.getTracks().forEach(track => track.stop()); throw voiceError('NoMicrophone') }
      stream = result
      stage = 'session'
      localId = makeId()
      for (const track of stream.getAudioTracks()) track.onended = () => { if (stream === result) leave('Microphone disconnected. Join voice again to reconnect it.') }
      publish({ enabled: true, muted: false, status: 'waiting', error: '' })
      transmit({ kind: 'ready', id: localId })
      await offer()
    } catch (error) {
      if (generation === token) fail(microphoneErrorMessage(error, stage))
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
