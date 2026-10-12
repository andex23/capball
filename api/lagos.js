import { handleLagos, ERRORS } from '../server/lagos.js'

// POST /api/lagos — friend-match results for Lagos Life (see server/lagos.js)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (JSON.stringify(input || {}).length > 8000) return res.status(413).json({ error: 'request-too-large' })
    return res.status(200).json(await handleLagos(input))
  } catch (error) {
    const known = Object.hasOwn(ERRORS, error.message)
    const status = error.message === 'not-configured' ? 503 : error.message === 'bad-session' ? 401 : known ? 400 : 502
    return res.status(status).json({ error: known ? error.message : 'server-unavailable', message: known ? ERRORS[error.message] : 'Couldn’t reach Lagos Life. Try again.' })
  }
}
