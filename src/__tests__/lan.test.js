import { describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { createLanPeer, encodeLanSignal, decodeLanSignal } from '../multiplayer/lan'

const sdp = 'v=0\r\na=candidate:1 1 UDP 2122260223 192.168.1.2 50000 typ host\r\n'
describe('offline LAN pairing', () => {
  it('roundtrips an invite and rejects the wrong pairing step', () => {
    const code = encodeLanSignal({ type: 'offer', sdp })
    expect(decodeLanSignal(code, 'offer')).toEqual({ type: 'offer', sdp })
    expect(() => decodeLanSignal(code, 'answer')).toThrow('reply')
  })
  it('rejects malformed and non-local signals', () => {
    for (const code of ['hello', 'CAPBALL-LAN1:broken', encodeLanSignal({ type: 'offer', sdp: sdp.replace('typ host', 'typ relay') })]) {
      expect(() => decodeLanSignal(code, 'offer')).toThrow()
    }
  })
  it('does not configure internet ICE servers and closes its connection', () => {
    const close = vi.fn()
    const PeerConnection = vi.fn(function () { this.addEventListener = vi.fn(); this.close = close })
    const peer = createLanPeer({ PeerConnection })
    expect(PeerConnection).toHaveBeenCalledWith({ iceServers: [] })
    peer.destroy()
    expect(close).toHaveBeenCalledOnce()
    expect(peer.destroyed).toBe(true)
  })
  it('produces a scannable QR for a complete SDP-sized pairing code', async () => {
    const code = encodeLanSignal({ type: 'offer', sdp: sdp + 'a=fingerprint:sha-256 ' + 'AB:'.repeat(31) + 'AB\r\n' + 'a=ice-ufrag:local\r\n'.repeat(35) })
    const url = await QRCode.toDataURL(code, { scale: 6, margin: 4, errorCorrectionLevel: 'L' })
    const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'))
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(code)
  })
})
