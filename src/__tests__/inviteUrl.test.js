import { describe, it, expect } from 'vitest'
import { inviteUrl } from '../utils/inviteUrl'

const location = href => new URL(href)

describe('shared invite addresses', () => {
  it.each(['counterball.vercel.app', 'capball.vercel.app', 'capball-drus-projects-68c924fa.vercel.app'])('uses the canonical address from %s without carrying private query data', host => {
    const from = location(`https://${host}/?room=OLD123&account=private#menu`)
    expect(inviteUrl('room', 'ABC123', from)).toBe('https://counterball.vercel.app/?room=ABC123')
    expect(inviteUrl('tournament', 'QWER78', from)).toBe('https://counterball.vercel.app/?tournament=QWER78')
  })

  it.each(['http://localhost:5173/', 'https://capball-preview.vercel.app/game'])('keeps local and preview rooms on %s', href => {
    expect(inviteUrl('room', 'ABC123', location(href))).toBe(`${href}?room=ABC123`)
  })
})
