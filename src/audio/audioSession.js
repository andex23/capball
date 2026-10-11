// WebKit refuses getUserMedia audio while an explicit playback-only category is
// selected. Coordinate game sound and opt-in capture without creating a context
// or awaiting anything before the user-gesture microphone request.
const captures = new WeakMap()
const currentSession = () => globalThis.navigator?.audioSession

export function setPlaybackAudioSession() {
  try {
    const session = currentSession()
    if (session && !captures.has(session)) session.type = 'playback'
  } catch { /* Optional API; unsupported browsers retain their default routing. */ }
}

export function acquireCaptureAudioSession() {
  const session = currentSession()
  if (!session) return () => {}
  let owner = captures.get(session)
  if (!owner) {
    const previous = session.type
    session.type = 'play-and-record'
    owner = { previous, count: 0 }
    captures.set(session, owner)
  }
  owner.count++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--owner.count) return
    captures.delete(session)
    try {
      if (session.type === 'play-and-record') session.type = owner.previous
    } catch { /* A disappearing page/session must not prevent track cleanup. */ }
  }
}
