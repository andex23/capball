import { readFeedback } from '../server/feedback.js'
import { leagueSummary } from '../server/league.js'
import { handleLagos, ERRORS, lagosConfigured, databaseCheck, statsAllowed, readStats, makeSaveDb } from '../server/lagos.js'

// POST /api/lagos — friend-match results for Lagos Life (see server/lagos.js)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  // GET: which server settings are present (yes/no only, never the values)
  // GET ?stats=N with the owner's key: usage counts for the last N days
  if (req.method === 'GET' && req.query?.stats) {
    if (!statsAllowed(req.headers['x-stats-key'])) return res.status(404).json({ error: 'not-found' })
    const saves = makeSaveDb()
    const days = Number(req.query.stats) || 14
    return res.status(200).json({ ok: true, live: await readStats(saves, 'live', days), test: await readStats(saves, 'test', days), feedback: await readFeedback(saves, days), league: saves ? await leagueSummary(saves) : null })
  }
  if (req.method === 'GET') return res.status(200).json({ ok: true, configured: lagosConfigured(), database: await databaseCheck() })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (JSON.stringify(input || {}).length > (input?.action === 'putSave' ? 400000 : 8000)) return res.status(413).json({ error: 'request-too-large' })
    return res.status(200).json(await handleLagos(input))
  } catch (error) {
    if (!Object.hasOwn(ERRORS, error.message) && error.message !== 'upstream') console.error('[lagos] unexpected:', error?.message)
    const known = Object.hasOwn(ERRORS, error.message)
    const status = ['not-configured', 'shop-not-configured', 'migration-needed'].includes(error.message) ? 503 : error.message === 'bad-session' ? 401 : known ? 400 : 502
    return res.status(status).json({ error: known ? error.message : 'server-unavailable', message: known ? ERRORS[error.message] : 'Couldn’t reach Lagos Life. Try again.' })
  }
}
