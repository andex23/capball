import { handleLeagueWeb } from '../server/leagueWeb.js'

const MESSAGES = {
  'not-configured': 'The Weekend League isn’t set up on the server yet.',
  'bad-request': 'That request wasn’t understood.',
  'signed-out': 'Sign in to play the Weekend League.',
  'not-signed-up': 'Sign up for the Weekend League first.',
  'already-played': 'You’ve already played that match.',
}

// POST /api/league — the Weekend League on the website (see server/league.js)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (JSON.stringify(input || {}).length > 4000) return res.status(413).json({ error: 'request-too-large' })
    return res.status(200).json(await handleLeagueWeb(input))
  } catch (error) {
    const known = Object.hasOwn(MESSAGES, error.message)
    if (!known) console.error('[league] unexpected:', error?.message)
    const status = error.message === 'not-configured' ? 503 : error.message === 'signed-out' ? 401 : known ? 400 : 502
    return res.status(status).json({ error: known ? error.message : 'server-unavailable', message: known ? MESSAGES[error.message] : 'Couldn’t reach the server. Try again.' })
  }
}
