import { describe, it, expect } from 'vitest'
import { encodeLanSignal, decodeLanSignal } from '../multiplayer/lan'
import { lanInviteUrl, readLanInvite, automaticLanInvite, isAutomaticLanInvite } from '../multiplayer/lanInvite'
const signal = { type: 'offer', sdp: 'v=0\r\na=candidate:1 1 UDP 2122260223 192.168.1.2 50000 typ host\r\n' }
const code = encodeLanSignal(signal)
const location = { hostname: 'capball.vercel.app', origin: 'https://capball.vercel.app', pathname: '/' }

describe('phone camera LAN invitations', () => {
  it('shares a short automatic pairing link without carrying SDP or needing a reply', () => {
    const code = automaticLanInvite('ABCDEFGHJKLM')
    const link = lanInviteUrl(code, location)
    expect(link).toBe('https://counterball.vercel.app/#lan=join.ABCDEFGHJKLM')
    expect(isAutomaticLanInvite(readLanInvite(link))).toBe(true)
    expect(readLanInvite(link)).toBe(code)
    expect(readLanInvite('https://counterball.vercel.app/#lan=join.short')).toBe('')
  })
  it('opens the game at the canonical address and keeps the pairing payload out of server requests', () => {
    const link = lanInviteUrl(code, location)
    const url = new URL(link)
    expect(url.origin).toBe('https://counterball.vercel.app')
    expect(url.search).toBe('')
    expect(url.hash).toMatch(/^#lan=[A-Za-z0-9_-]+$/)
    expect(decodeLanSignal(readLanInvite(link), 'offer')).toEqual(signal)
  })
  it('keeps localhost development links local', () => {
    expect(lanInviteUrl(code, { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/' })).toMatch(/^http:\/\/localhost:5173\/#lan=/)
  })
  it('rejects damaged invites, unrelated QR URLs, and reply codes in host links', () => {
    for (const value of ['hello', 'https://counterball.vercel.app', 'https://counterball.vercel.app/#lan=broken', 'javascript:alert(1)#lan=hello']) expect(readLanInvite(value)).toBe('')
    expect(() => lanInviteUrl(encodeLanSignal({ ...signal, type: 'answer' }), location)).toThrow()
  })
})
