/**
 * Goal clips: the slow-motion goal replay is recorded straight off the 3D
 * canvas while it plays, so the player can share or save it afterwards.
 * Clips live in memory for the current match only.
 */
import { create } from 'zustand'
import { useMatchStore } from '../state/MatchStore'
import { getCanvas } from '../scene/camera'

const MAX_CLIPS = 5

export const useClipStore = create(() => ({ clips: [] })) // [{ url, blob, type, title }]

function pickType() {
  if (typeof MediaRecorder === 'undefined') return null
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return types.find((t) => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } }) || null
}

/** Can this phone record clips at all? */
export const canRecord = () => !!pickType() && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream

let recorder = null
let chunks = []

function start() {
  const canvas = getCanvas()
  const type = pickType()
  if (!canvas?.captureStream || !type || recorder) return
  try {
    const stream = canvas.captureStream(30)
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3_000_000 })
    chunks = []
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    recorder.start(250)
  } catch {
    recorder = null
  }
}

function stop() {
  const r = recorder
  recorder = null
  if (!r) return
  const s = useMatchStore.getState()
  const name = (t) => s.teamConfig[t]?.name || t
  const title = `${name('team1')} ${s.score.team1}–${s.score.team2} ${name('team2')}`
  const scorer = s.lastScorer ? name(s.lastScorer) : ''
  r.onstop = () => {
    r.stream?.getTracks?.().forEach((t) => t.stop())
    const type = (r.mimeType || 'video/webm').split(';')[0]
    if (!chunks.length) return
    const blob = new Blob(chunks, { type })
    chunks = []
    const clip = { url: URL.createObjectURL(blob), blob, type, title, scorer }
    const clips = [clip, ...useClipStore.getState().clips]
    clips.slice(MAX_CLIPS).forEach((c) => URL.revokeObjectURL(c.url))
    useClipStore.setState({ clips: clips.slice(0, MAX_CLIPS) })
  }
  try { r.stop() } catch { /* already stopped */ }
}

/** Share a clip with the phone's share sheet, or download it where sharing files isn't possible. */
export async function shareClip(clip) {
  const ext = clip.type.includes('mp4') ? 'mp4' : 'webm'
  const file = new File([clip.blob], `capball-goal.${ext}`, { type: clip.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'CapBall goal', text: `${clip.scorer ? `${clip.scorer} score! ` : ''}${clip.title} — capball.vercel.app` })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = clip.url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  return 'downloaded'
}

/** Record every goal replay; forget the clips when a new match starts. */
export function initClips() {
  useMatchStore.subscribe((m, prev) => {
    if (m.replaying && !prev.replaying) start()
    else if (!m.replaying && prev.replaying) stop()
    if (m.matchKey !== prev.matchKey && !m.penaltyShootout && !m.challenge) {
      useClipStore.getState().clips.forEach((c) => URL.revokeObjectURL(c.url))
      useClipStore.setState({ clips: [] })
    }
  })
}
