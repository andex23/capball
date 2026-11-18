/**
 * The bell's "What's new": game updates, achievements earned, today's daily
 * challenge and the next career match, newest first. Pure: the store passes
 * in what it knows and which items have been seen.
 */
import { UPDATES } from '../data/updates'
import { ACHIEVEMENTS } from './achievements'

/**
 * @param {object} p
 * @param {Array} [p.updates]       game updates (UPDATES)
 * @param {object} [p.earned]       achievement id → ISO date earned
 * @param {object} [p.daily]        { ready, streak, day } when there's a challenge to play today
 * @param {object} [p.career]       { key, text, date } for the next career match
 * @param {Set|string[]} [p.seen]   item ids already seen
 * @param {string} [p.since]        only updates on or after this date (when the player first played)
 */
export function inboxItems({ updates = UPDATES, earned = {}, daily = null, career = null, seen = [], since = null } = {}) {
  const read = seen instanceof Set ? seen : new Set(seen)
  const items = []
  for (const u of updates) {
    if (since && u.date < since) continue
    items.push({ id: `update:${u.id}`, kind: 'update', icon: u.icon, title: u.title, text: u.text, date: u.date })
  }
  for (const a of ACHIEVEMENTS) {
    if (!earned[a.id]) continue
    items.push({ id: `badge:${a.id}`, kind: 'achievement', icon: a.icon, title: a.name, text: a.desc, date: String(earned[a.id]).slice(0, 10) })
  }
  if (daily?.ready) {
    items.push({ id: `daily:${daily.day}`, kind: 'daily', icon: 'check', title: 'Today’s challenge is ready', text: daily.streak ? `Keep your streak going: ${daily.streak} day${daily.streak === 1 ? '' : 's'} so far.` : 'A new puzzle, the same for everyone.', date: daily.day })
  }
  if (career?.key) {
    items.push({ id: `career:${career.key}`, kind: 'career', icon: 'trophy', title: 'Your next career match', text: career.text, date: career.date || '' })
  }
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return items.map((it) => ({ ...it, unread: !read.has(it.id) }))
}

export const unreadCount = (items) => items.filter((i) => i.unread).length

/** "Today", "Yesterday", "3 days ago", or the date, for a YYYY-MM-DD. */
export function whenLabel(date, today = new Date().toISOString().slice(0, 10)) {
  if (!date) return ''
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'Last week'
  return new Date(Date.parse(date)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
