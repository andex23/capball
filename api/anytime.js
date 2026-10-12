import { handleAnytime, ERRORS } from '../server/anytime.js'

export function createAnytimeHandler(db) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
    try {
      const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (JSON.stringify(input || {}).length > 16000) return res.status(413).json({ error: 'request-too-large' })
      return res.status(200).json(await handleAnytime(input, db))
    } catch (error) {
      const known = Object.hasOwn(ERRORS, error.message)
      const unavailable = ['not-configured', 'migration-needed'].includes(error.message)
      return res.status(unavailable ? 503 : known ? 400 : 502).json({
        error: known ? error.message : 'server-unavailable',
        message: known ? ERRORS[error.message] : 'Could not reach the match server. Your last confirmed turn is saved. Try again.',
      })
    }
  }
}

export default createAnytimeHandler()
