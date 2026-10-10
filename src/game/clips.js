/**
 * Goal clips: the slow-motion goal replay is recorded straight off the 3D
 * canvas while it plays, so the player can share or save it afterwards.
 * Clips live in memory for the current match only.
 */
import { create } from 'zustand'
import { playerOf } from './commentary'
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
let generation = 0

function start(s) {
  const canvas = getCanvas()
  const type = pickType()
  if (!canvas?.captureStream || !type || recorder) return
  try {
    const stream = canvas.captureStream(30)
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3_000_000 })
    const chunks = []
    const matchGeneration = generation
    const name = (t) => s.teamConfig[t]?.name || t
    const title = `${name('team1')} ${s.score.team1}–${s.score.team2} ${name('team2')}`
    const who = playerOf(s.teamConfig, s.lastGoalCap)
    const scorer = who && !s.lastGoalOwn ? `${who.label} (${name(who.team)})` : s.lastScorer ? name(s.lastScorer) : ''
    const r = recorder
    r.onstop = () => {
      r.stream?.getTracks?.().forEach((t) => t.stop())
      if (matchGeneration !== generation || !chunks.length) return
      const type = (r.mimeType || 'video/webm').split(';')[0]
      const blob = new Blob(chunks, { type })
      const clip = { url: URL.createObjectURL(blob), blob, type, title, scorer, outcome: 'goal' }
      const clips = [clip, ...useClipStore.getState().clips]
      clips.slice(MAX_CLIPS).forEach((c) => URL.revokeObjectURL(c.url))
      useClipStore.setState({ clips: clips.slice(0, MAX_CLIPS) })
    }
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
  try { r.stop() } catch { /* already stopped */ }
}

/** Share a clip with the phone's share sheet, or download it where sharing files isn't possible. */
export async function shareClip(clip) {
  const ext = clip.type.includes('mp4') ? 'mp4' : 'webm'
  const file = new File([clip.blob], `counterball-goal.${ext}`, { type: clip.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Counterball goal', text: `${clip.scorer ? `${clip.scorer} score! ` : ''}${clip.title} — counterball.vercel.app` })
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
  return useMatchStore.subscribe((m, prev) => {
    if (m.matchKey !== prev.matchKey) {
      generation++
      stop()
      useClipStore.getState().clips.forEach((c) => URL.revokeObjectURL(c.url))
      useClipStore.setState({ clips: [] })
    }
    // Decision replays also include disallowed goals. Only confirmed goals
    // belong in the scored-goal gallery or its share/download actions.
    if (m.replaying && !prev.replaying && m.replayDecision?.outcome === 'goal') start(m)
    else if (!m.replaying && prev.replaying) stop()

  })
}
