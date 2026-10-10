/** Keep a live LAN channel through temporary network loss / app suspension.
 * Fresh challenge replies prevent queued packets from resuming a stale link.
 */
export const LAN_GRACE_MS = 120000
export const LAN_SILENCE_MS = 5000

export function createLanRecovery({
  send, onLost, onRestored, onExpired,
  now = () => Date.now(), visible = () => true,
}) {
  let lastReply = now()
  let deadline = 0
  let sequence = 0
  let pending = new Map()
  let stopped = false
  let hidden = !visible()

  function lose() {
    if (stopped || deadline) return
    deadline = now() + LAN_GRACE_MS
    pending.clear()
    onLost(deadline)
  }
  function expire() {
    if (!deadline || now() < deadline) return false
    stopped = true
    pending.clear()
    onExpired()
    return true
  }
  function tick() {
    if (stopped || expire()) return
    if (hidden || now() - lastReply >= LAN_SILENCE_MS) lose()
    if (hidden) return
    for (const [id, at] of pending) if (now() - at >= LAN_SILENCE_MS) pending.delete(id)
    const id = ++sequence
    pending.set(id, now())
    send('lanProbe', { id })
  }
  return {
    tick,
    interrupt: lose,
    visibilityChanged() {
      if (stopped) return
      hidden = !visible()
      pending.clear()
      if (hidden) {
        send('lanAway', {})
        lose()
      } else {
        // The app may have slept without delivering a visibility event.
        lose()
        tick()
      }
    },
    receive(message) {
      if (!['lanProbe', 'lanAck', 'lanAway'].includes(message?.type)) return false
      if (stopped || expire()) return true
      const data = message.data
      if (message.type === 'lanAway') { lose(); return true }
      if (!Number.isSafeInteger(data?.id) || data.id < 1) return true
      if (message.type === 'lanProbe') {
        send('lanAck', { id: data.id, visible: !hidden })
        return true
      }
      const sentAt = pending.get(data.id)
      pending.delete(data.id)
      if (sentAt === undefined || now() - sentAt >= LAN_SILENCE_MS || hidden) return true
      if (data.visible !== true) { lose(); return true }
      lastReply = now()
      if (deadline) { deadline = 0; pending.clear(); onRestored() }
      return true
    },
    stop() { stopped = true; pending.clear() },
  }
}
