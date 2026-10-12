# iOS voice capture InvalidStateError

Prepared locally on `fix/ios-voice-capture`, based on main `a1b5ce8`, 11 October
2026. Not pushed or deployed. The Lagos Life worktree was not modified.

## Diagnosis

The user-provided screenshot text contains `[VOICE_CAPTURE_InvalidStateError]`.
The CAPTURE stage precedes audio-track validation, session-ID generation,
RTCPeerConnection creation and audio playback. The direct default capture call is
`navigator.mediaDevices.getUserMedia(...)`; it preserves the receiver and is
invoked synchronously from the Join voice action before any awaited operation.
Permission denial has a separate `[MIC_PERMISSION]` mapping.

A concrete application conflict was found: `initAudioUnlock()` in SoundManager
sets `navigator.audioSession.type = 'playback'` at startup. That phone-sound change
was introduced in `30c01bf`; the later voice changes `5b3e23d`, `34be42d` and
`79c7d82` never coordinate that category before recording. WebKit's current
[getUserMedia implementation](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/mediastream/MediaDevices.cpp)
rejects audio capture with InvalidStateError when its explicit audio-session
category is neither automatic nor play-and-record. It also independently rejects
a document that is not fully active. The screenshot omits the underlying message,
so it cannot distinguish those two checks by itself. The application's forced
playback category is nevertheless a reproducible defect consistent with the error.

The game AudioContext is separate synthesized game sound. Voice capture does not
construct or resume that context, and playback failures are reported separately as
`needsPlayback`; neither can originate the displayed CAPTURE-stage code. No
permission-denial assumption, device-setting changes or blind capture retry was
used to address this failure.

## Fix

A small audio-session coordinator selects `play-and-record` synchronously before
getUserMedia, then restores the prior category after tracks stop or a request
fails. Capture leases prevent old cancelled/disposed requests from restoring
playback while a newer voice capture is active. A pending browser permission
request cannot be cancelled by JavaScript: its lease is held until it settles,
and any late stream is stopped before that lease is released. Category restoration
is idempotent and does not overwrite an explicit change by another owner.

Sound initialization uses the same coordinator and cannot force playback during
capture. Browsers without the optional Audio Session API retain existing behavior.
Hidden/prerendered pages do not request a microphone; background/pagehide still
stop capture, and foreground/pageshow never silently re-enable it. Already-ended
tracks are rejected; teardown removes ended callbacks before stopping tracks.

Changed runtime files: `src/audio/audioSession.js`, `src/audio/SoundManager.js`,
`src/multiplayer/voice.js`. No signaling protocol, account, deployment or microphone
permission settings were changed. Tests and a standalone browser harness support
review of the runtime changes.

## Verification and limits

A new regression applied WebKit's incompatible-category rule to the real voice
module: before the fix, join stayed disabled with the capture error (15 existing
voice tests passed, the new test failed); after the fix it joins on the first
request and restores playback on leave. Focused tests cover denial/retry,
overlapping cancellation, repeated clicks, late tracks, ended tracks, optional API
absence, game initialization during capture, hidden/prerendered pages and lifecycle
cleanup. The full `npm run check` passed: **547 tests in 50 files**, lint and build.
`git diff --check` passed. Existing Vite deprecation warnings remain unchanged.
No independent typecheck is configured in this JavaScript repository.

Browser commands, with Vite on loopback port 5175:

```sh
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
VOICE_PLAYWRIGHT_MODULE=/tmp/counterball-browser/node_modules/playwright/index.mjs \
  node scripts/check-voice-browser.js
# Explicitly limited capture/signaling run when the executor has no ICE candidates:
VOICE_REQUIRE_RTC_CONNECTION=0 \
VOICE_PLAYWRIGHT_MODULE=/tmp/counterball-browser/node_modules/playwright/index.mjs \
  node scripts/check-voice-browser.js
```

The Chromium harness uses fake devices and a simulated WebKit category check,
not a real microphone. Two contexts represent separate visible devices; controlled
visibility events simulate background/foreground. The limited run **passed**:
initial capture, synthetic denial/retry, repeated clicks, real RTCPeerConnection
SDP exchange and remote-track setup, rejoin, background/pagehide/dispose cleanup,
ended tracks and restoration of playback. Default strict mode **failed** waiting
for the media connection: both peers had stable SDP and live sendrecv tracks,
completed gathering and **zero ICE candidates**, with connection/ICE state `new`.
The harness does not establish why this executor produced no candidates. It does
not prove RTP delivery, audible playback, STUN/TURN or actual two-device networking.
The strict connection assertion remains enabled by default; the limited flag is
explicit and prints this limitation rather than reporting connection success.

Actual iPhone Safari/PWA capture, audio routing, silent-switch/headset behavior,
autoplay and OS suspension remain untested. The exact per-device failure path
requires a real-device check after review/publication approval. No attempt was
made to access the user's microphone or alter permissions, and the supplied
screenshot text was sufficient without another Library transfer attempt.
