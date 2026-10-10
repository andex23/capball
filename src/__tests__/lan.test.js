import { describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { createLanPeer, encodeLanSignal, decodeLanSignal, isLanSignal } from '../multiplayer/lan'

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
  it('continues to read invites from the previous game version', () => {
    const signal = { type: 'offer', sdp }
    const legacy = 'CAPBALL-LAN1:' + btoa(JSON.stringify(signal))
    expect(isLanSignal(legacy)).toBe(true)
    expect(decodeLanSignal(legacy, 'offer')).toEqual(signal)
    expect(isLanSignal(encodeLanSignal(signal))).toBe(true)
    expect(isLanSignal('https://example.com')).toBe(false)
  })
  it('rejects malformed compact codes and oversized decompressed signals', () => {
    for (const code of ['COUNTERBALL-LAN2:A', 'COUNTERBALL-LAN2:ZZZ', encodeLanSignal({ type: 'offer', sdp: sdp + 'a=x'.repeat(20000) })]) {
      expect(() => decodeLanSignal(code, 'offer')).toThrow()
    }
  })
  it('renders compact codes on a narrow phone using whole QR pixels', () => {
    const payload = sdp + 'a=fingerprint:sha-256 ' + 'AB:'.repeat(31) + 'AB\r\n' + 'a=ice-ufrag:local\r\n'.repeat(35)
    const code = encodeLanSignal({ type: 'offer', sdp: payload })
    const qr = QRCode.create(code, { errorCorrectionLevel: 'L' })
    const grid = qr.modules.size + 8
    const scale = Math.floor(240 / grid), size = grid * scale
    expect(scale).toBeGreaterThanOrEqual(2)
    const rgba = new Uint8ClampedArray(size * size * 4)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - 4, my = Math.floor(y / scale) - 4
      const shade = mx >= 0 && my >= 0 && mx < qr.modules.size && my < qr.modules.size && qr.modules.get(my, mx) ? 0 : 255
      const i = (y * size + x) * 4
      rgba[i] = rgba[i + 1] = rgba[i + 2] = shade; rgba[i + 3] = 255
    }
    expect(jsQR(rgba, size, size)?.data).toBe(code)
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
