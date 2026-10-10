import { createServer } from 'node:http'
import handler from '../api/anytime.js'
// Local equivalent of the Vercel function. Vite proxies /api/anytime here.
createServer(async (req, res) => {
  res.status = code => { res.statusCode = code; return res }
  res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 16000) { res.status(413).json({ error: 'request-too-large' }); return }
  }
  req.body = body
  await handler(req, res)
}).listen(3001, '127.0.0.1', () => console.log('Saved-match API listening on 127.0.0.1:3001'))
