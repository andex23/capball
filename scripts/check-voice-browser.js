import assert from 'node:assert/strict'
const { chromium } = await import(process.env.VOICE_PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.VOICE_TEST_ORIGIN || 'http://127.0.0.1:5175'
const requireConnection = process.env.VOICE_REQUIRE_RTC_CONNECTION !== '0'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'] })
const contexts = [], pages = [], errors = []
try {
  for (let seat = 0; seat < 2; seat++) {
    const context = await browser.newContext()
    contexts.push(context)
    const page = await context.newPage()
    pages.push(page)
    page.on('pageerror', error => errors.push(error.message))
    await page.route(`${origin}/voice-browser-check`, route => route.fulfill({ contentType: 'text/html', body: '<button id="join">Join voice</button><button id="leave">Leave voice</button><button id="hear">Hear opponent</button>' }))
    await page.exposeFunction('sendVoiceMessage', async data => {
      const other = pages[1 - seat]
      if (other) await other.evaluate(data => window.voiceModule?.receiveVoice(data), data)
    })
    await page.goto(`${origin}/voice-browser-check`)
    await page.evaluate(async seat => {
      // Two players represent separate devices. Chromium's one window would
      // otherwise background one tab when the test clicks the other player's UI.
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      const audioSession = { type: 'auto' }
      Object.defineProperty(navigator, 'audioSession', { value: audioSession })
      window.captured = []; window.captureCalls = 0; window.captureFailure = false
      const nativeCapture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async constraints => {
        window.captureCalls++
        // Reproduce WebKit's category check, but capture only Chromium's fake mic.
        if (audioSession.type !== 'play-and-record') throw new DOMException('AudioSession category is not compatible with audio capture.', 'InvalidStateError')
        if (window.captureFailure) { window.captureFailure = false; throw new DOMException('Synthetic denial', 'NotAllowedError') }
        const stream = await nativeCapture(constraints)
        window.captured.push(stream)
        return stream
      }
      const { initAudioUnlock } = await import('/src/audio/SoundManager.js')
      initAudioUnlock()
      window.voiceModule = await import('/src/multiplayer/voiceStore.js')
      window.receivedTracks = 0
      window.peers = []
      class Peer extends RTCPeerConnection { constructor(options) { super(options); window.peers.push(this) } }
      window.voiceModule.connectVoice({ isHost: seat === 0, PeerConnection: Peer, send: data => window.sendVoiceMessage(data), createAudio: () => {
        const audio = new Audio()
        const setter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject').set
        Object.defineProperty(audio, 'srcObject', { set(stream) { if (stream) window.receivedTracks += stream.getAudioTracks().length; setter.call(this, stream) }, get() { return Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject').get.call(this) } })
        return audio
      } })
      document.querySelector('#join').onclick = window.voiceModule.joinVoice
      document.querySelector('#leave').onclick = window.voiceModule.leaveVoice
      document.querySelector('#hear').onclick = window.voiceModule.playVoice
    }, seat)
    assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback')
  }
  await pages[0].evaluate(() => { window.captureFailure = true })
  await pages[0].click('#join')
  await pages[0].waitForFunction(() => window.voiceModule.useVoiceStore.getState().error.includes('[MIC_PERMISSION]'))
  assert.equal(await pages[0].evaluate(() => navigator.audioSession.type), 'playback')
  await pages[0].click('#join')
  await pages[0].waitForFunction(() => window.voiceModule.useVoiceStore.getState().enabled)
  await pages[0].click('#join')
  assert.equal(await pages[0].evaluate(() => window.captureCalls), 2)
  await pages[1].click('#join')
  for (const page of pages) {
    if (requireConnection) await page.waitForFunction(() => window.voiceModule.useVoiceStore.getState().status === 'connected', null, { timeout: 20000 })
    else await page.waitForFunction(() => window.receivedTracks > 0 && window.peers[0]?.signalingState === 'stable')
    assert.equal(await page.evaluate(() => window.receivedTracks > 0), true)
    await page.click('#hear')
  }
  // Simulated visibility events exercise app cleanup, not an actual iOS suspension.
  await pages[0].evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  assert.equal(await pages[0].evaluate(() => window.captured.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))), true)
  assert.equal(await pages[0].evaluate(() => navigator.audioSession.type), 'playback')
  await pages[0].evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pageshow'))
  })
  assert.equal(await pages[0].evaluate(() => window.captureCalls), 2)
  assert.equal(await pages[0].evaluate(() => window.voiceModule.useVoiceStore.getState().enabled), false)
  await pages[0].click('#join')
  for (const page of pages) {
    if (requireConnection) await page.waitForFunction(() => window.voiceModule.useVoiceStore.getState().status === 'connected', null, { timeout: 20000 })
    else await page.waitForFunction(() => window.peers.length === 2 && window.peers[1]?.signalingState === 'stable')
  }
  await pages[0].evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await pages[1].evaluate(() => window.voiceModule.disconnectVoice())
  for (const page of pages) {
    assert.equal(await page.evaluate(() => window.captured.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))), true)
    assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback')
  }
  assert.deepEqual(errors, [])
  process.stdout.write(`PASS: WebKit category rule, initial join, denial/retry, repeated clicks, real WebRTC SDP/remote track setup with synthetic microphones, simulated background/foreground and teardown. ${requireConnection ? 'Media connections established.' : 'Connection requirement explicitly disabled: RTP delivery and audible playback are NOT verified.'} No real microphone or iOS device used.\n`)
} catch (error) {
  for (const page of pages) process.stderr.write(JSON.stringify(await page.evaluate(() => ({ state: window.voiceModule?.useVoiceStore.getState(), captureCalls: window.captureCalls, receivedTracks: window.receivedTracks, peers: window.peers?.map(pc => ({ connection: pc.connectionState, ice: pc.iceConnectionState, gathering: pc.iceGatheringState, signalling: pc.signalingState, candidates: pc.localDescription?.sdp.match(/a=candidate:/g)?.length || 0, transceivers: pc.getTransceivers().map(t => ({ direction: t.currentDirection, localTrack: t.sender.track?.readyState, remoteTrack: t.receiver.track?.readyState })) })) }))) + '\n')
  throw error
} finally { for (const context of contexts) await context.close(); await browser.close() }
