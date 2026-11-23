/**
 * Player feedback (Options → Feedback): a face, what it's about, and an optional
 * suggestion. Kept one document a day through the saves function, under a reserved
 * name no player id can take. No names: who sent it is a short one-way hash, only
 * to stop one phone filling the day.
 */
import { createHash } from 'node:crypto'
import { dayOf } from './lagos.js'

export const MOODS = ['love', 'ok', 'meh']
export const ABOUT = ['too_hard', 'controls', 'crash', 'slow', 'boring', 'idea', 'other']
export const MAX_TEXT = 500
const PER_SENDER = 5 // a day
const PER_DAY = 500
const key = (day) => `__feedback__:${day}`
const cleanDay = (d) => (d && d.v === 1 && Array.isArray(d.items) && d.senders && typeof d.senders === 'object' ? d : { v: 1, items: [], senders: {} })

/** A clean copy of what was sent, or null if it isn't feedback. */
export function cleanFeedback(input) {
  if (!input || !MOODS.includes(input.mood)) return null
  const about = Array.isArray(input.about) ? [...new Set(input.about.filter((a) => ABOUT.includes(a)))] : []
  const text = typeof input.text === 'string' ? [...input.text].filter((ch) => { const c = ch.codePointAt(0); return c === 10 || (c >= 32 && c !== 127) }).join('').trim().slice(0, MAX_TEXT) : ''
  return { mood: input.mood, about, text, from: input.from === 'lagos' ? 'lagos' : 'web' }
}

/** Store one piece of feedback. Returns false when that sender has sent enough today. */
export async function saveFeedback(saves, input, sender, now = Date.now()) {
  const item = cleanFeedback(input)
  if (!saves || !item) return null
  const day = dayOf(now)
  const doc = cleanDay((await saves('get', 'live', key(day)))?.data)
  const who = createHash('sha256').update(`fb:${day}:${sender || 'unknown'}`).digest('hex').slice(0, 12)
  if ((doc.senders[who] || 0) >= PER_SENDER || doc.items.length >= PER_DAY) return false
  doc.senders[who] = (doc.senders[who] || 0) + 1
  doc.items.push({ ...item, at: now })
  await saves('put', 'live', key(day), doc)
  return true
}

/** The last `days` days of feedback, newest first: [{ mood, about, text, from, at }]. */
export async function readFeedback(saves, days = 14, now = Date.now()) {
  if (!saves) return []
  const out = []
  for (let i = 0; i < Math.min(60, Math.max(1, days)); i++) {
    try {
      const d = (await saves('get', 'live', key(dayOf(now - i * 86400000))))?.data
      if (d) out.push(...cleanDay(d).items)
    } catch { /* skip a day that can't be read */ }
  }
  return out.sort((a, b) => b.at - a.at)
}
