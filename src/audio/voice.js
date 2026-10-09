/**
 * Spoken commentary with the phone's own text-to-speech voice. Off when the
 * game is muted or the player turns it off; quiet lines never queue up behind
 * each other (a new big moment cuts the old one off).
 */
import { useMatchStore } from '../state/MatchStore'

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)
let voice = null
let lastAt = 0

function pickVoice() {
  const s = synth()
  if (!s) return null
  const voices = s.getVoices() || []
  // A natural English voice if the phone has one; British first, it suits football
  const rank = (v) => (/en-GB/i.test(v.lang) ? 0 : /en-(AU|IE|NG|ZA)/i.test(v.lang) ? 1 : /^en/i.test(v.lang) ? 2 : 9) - (/natural|premium|enhanced|google/i.test(v.name) ? 0.5 : 0)
  return voices.filter((v) => /^en/i.test(v.lang)).sort((a, b) => rank(a) - rank(b))[0] || null
}
if (synth()) synth().addEventListener?.('voiceschanged', () => { voice = pickVoice() })

export const canSpeak = () => !!synth()

/** Read a line out. `big` moments (goals, the final whistle) interrupt whatever is being said. */
export function speak(text, { big = false } = {}) {
  const s = synth()
  const st = useMatchStore.getState()
  if (!s || !text || !st.voiceCommentary || st.muted || st.paused) return
  const volume = Math.max(0, Math.min(1, (st.masterVolume ?? 1) * 1.1))
  if (volume <= 0.02) return
  const now = Date.now()
  if (!big && (s.speaking || now - lastAt < 900)) return
  if (big) s.cancel()
  lastAt = now
  const u = new SpeechSynthesisUtterance(spoken(text))
  voice = voice || pickVoice()
  if (voice) u.voice = voice
  u.lang = voice?.lang || 'en-GB'
  u.rate = big ? 1.12 : 1.05
  u.pitch = big ? 1.1 : 1
  u.volume = volume
  try { s.speak(u) } catch { /* speech blocked */ }
}

export function stopSpeaking() { try { synth()?.cancel() } catch { /* nothing to stop */ } }

/** Text as a commentator would say it: "#9 Okafor" → "Okafor", dashes in scores → "to". */
export function spoken(text) {
  return String(text)
    .replace(/#\d+\s+/g, '')
    .replace(/(\d+)–(\d+)/g, '$1 $2')
    .replace(/—/g, ',')
}
