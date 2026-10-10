import { describe, expect, it, vi } from 'vitest'
import { createLanRecovery, LAN_GRACE_MS, LAN_SILENCE_MS } from '../multiplayer/lanRecovery'

function setup() {
  let time = 0, visible = true
  const send = vi.fn(), onLost = vi.fn(), onRestored = vi.fn(), onExpired = vi.fn()
  const recovery = createLanRecovery({ send, onLost, onRestored, onExpired, now: () => time, visible: () => visible })
  return { recovery, send, onLost, onRestored, onExpired,
    advance(ms) { time += ms },
    hide() { visible = false; recovery.visibilityChanged() },
    show() { visible = true; recovery.visibilityChanged() },
    ack(visible = true) { recovery.receive({ type: 'lanAck', data: { id: send.mock.lastCall[1].id, visible } }) },
  }
}
describe('LAN recovery', () => {
  it('notifies the other phone when a silent link is detected', () => {
    const t = setup()
    t.advance(LAN_SILENCE_MS)
    t.recovery.tick()
    expect(t.send).toHaveBeenCalledWith('lanAway', {})
    t.recovery.tick()
    expect(t.send.mock.calls.filter(([type]) => type === 'lanAway')).toHaveLength(1)
  })
  it('ignores duplicate visibility events and tolerates a brief phone scheduling delay', () => {
    const t = setup()
    t.show()
    expect(t.onLost).not.toHaveBeenCalled()
    t.recovery.tick()
    t.advance(5500)
    t.ack()
    t.recovery.tick()
    expect(t.onLost).not.toHaveBeenCalled()
  })

  it('waits through lost packets and requires a fresh reply before resuming', () => {
    const t = setup()
    t.recovery.tick()
    const oldId = t.send.mock.lastCall[1].id
    t.advance(LAN_SILENCE_MS)
    t.recovery.tick()
    expect(t.onLost).toHaveBeenCalledOnce()
    t.recovery.receive({ type: 'lanAck', data: { id: oldId, visible: true } })
    expect(t.onRestored).not.toHaveBeenCalled()
    t.ack()
    expect(t.onRestored).toHaveBeenCalledOnce()
  })
  it('pauses immediately on backgrounding and waits for a foreground round trip', () => {
    const t = setup()
    t.hide()
    expect(t.send).toHaveBeenCalledWith('lanAway', {})
    expect(t.onLost).toHaveBeenCalledOnce()
    t.recovery.receive({ type: 'lanProbe', data: { id: 7 } })
    expect(t.send).toHaveBeenLastCalledWith('lanAck', { id: 7, visible: false })
    t.show()
    t.ack(false)
    expect(t.onRestored).not.toHaveBeenCalled()
    t.recovery.tick(); t.ack()
    expect(t.onRestored).toHaveBeenCalledOnce()
  })
  it('does not extend the recovery deadline for repeated interruptions', () => {
    const t = setup()
    t.hide()
    t.advance(LAN_GRACE_MS - 1)
    t.recovery.interrupt()
    t.show()
    expect(t.onLost).toHaveBeenCalledTimes(1)
    t.advance(1)
    t.ack()
    expect(t.onExpired).toHaveBeenCalledOnce()
    expect(t.onRestored).not.toHaveBeenCalled()
    t.recovery.tick()
    expect(t.onExpired).toHaveBeenCalledOnce()
  })
  it('ignores unsolicited, malformed, and late acknowledgements', () => {
    const t = setup()
    t.recovery.interrupt()
    for (const id of [1, '1', -1, null]) t.recovery.receive({ type: 'lanAck', data: { id, visible: true } })
    expect(t.onRestored).not.toHaveBeenCalled()
    t.recovery.tick()
    t.advance(LAN_SILENCE_MS)
    t.ack()
    expect(t.onRestored).not.toHaveBeenCalled()
  })
  it('allows repeated recovery cycles, then stops completely on deliberate leave', () => {
    const t = setup()
    for (let i = 0; i < 2; i++) { t.recovery.interrupt(); t.recovery.tick(); t.ack() }
    expect(t.onRestored).toHaveBeenCalledTimes(2)
    t.recovery.stop()
    t.hide(); t.advance(LAN_GRACE_MS); t.recovery.tick()
    expect(t.onLost).toHaveBeenCalledTimes(2)
    expect(t.onExpired).not.toHaveBeenCalled()
  })
})
