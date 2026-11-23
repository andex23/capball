import { saveFeedback } from '../server/feedback.js'
import { makeSaveDb } from '../server/lagos.js'

// POST /api/feedback — Options → Feedback, from the website and Lagos Life
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (JSON.stringify(input || {}).length > 4000) return res.status(413).json({ error: 'request-too-large' })
    const sender = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || ''
    const ok = await saveFeedback(makeSaveDb(), input, sender)
    if (ok === null) return res.status(400).json({ error: 'bad-request' })
    if (ok === false) return res.status(429).json({ error: 'too-many' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(502).json({ error: 'server-unavailable' })
  }
}
