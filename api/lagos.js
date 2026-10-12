import { handleLagos, ERRORS, lagosConfigured } from '../server/lagos.js'

// POST /api/lagos — friend-match results for Lagos Life (see server/lagos.js)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  // GET: which server settings are present (yes/no only, never the values)
  if (req.method === 'GET') return res.status(200).json({ ok: true, configured: lagosConfigured() })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (JSON.stringify(input || {}).length > (input?.action === 'putSave' ? 400000 : 8000)) return res.status(413).json({ error: 'request-too-large' })
    return res.status(200).json(await handleLagos(input))
  } catch (error) {
    const known = Object.hasOwn(ERRORS, error.message)
    const status = ['not-configured', 'shop-not-configured', 'migration-needed'].includes(error.message) ? 503 : error.message === 'bad-session' ? 401 : known ? 400 : 502
    return res.status(status).json({ error: known ? error.message : 'server-unavailable', message: known ? ERRORS[error.message] : 'Couldn’t reach Lagos Life. Try again.' })
  }
}
