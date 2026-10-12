import { webhookSigned, handleWebhook } from '../server/lagos.js'

// The signature covers the exact bytes Lagos Life sent, so read the body raw
export const config = { api: { bodyParser: false } }

async function rawBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > 64_000) throw new Error('too-large')
    chunks.push(c)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// POST /api/lagos-webhook — Lagos Life's signed purchase.paid (see server/lagos.js)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' })
  let raw
  try { raw = await rawBody(req) } catch { return res.status(413).json({ error: 'request-too-large' }) }
  if (!webhookSigned(raw, req.headers['x-vatar-signature'], process.env.VATAR_WEBHOOK_SECRET)) return res.status(401).json({ error: 'bad-signature' })
  let event
  try { event = JSON.parse(raw) } catch { return res.status(400).json({ error: 'bad-request' }) }
  try {
    return res.status(200).json(await handleWebhook(event))
  } catch (e) {
    console.error('[lagos] webhook could not finish:', e?.message)
    // A non-2xx makes Lagos Life retry later (1 min, 10 min, 1 h, 6 h)
    return res.status(e.message === 'bad-request' ? 400 : 503).json({ error: e.message === 'bad-request' ? 'bad-request' : 'try-again' })
  }
}
