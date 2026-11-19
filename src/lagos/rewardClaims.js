import { getSaveStorage } from '../utils/playerSave'

const keyFor = (mode, id) => 'counterball:lagos:pending-daily:' + mode + ':' + id
const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

export function pendingClaims(mode, id) {
  try {
    const days = JSON.parse(getSaveStorage()?.getItem(keyFor(mode, id)) || '[]')
    return Array.isArray(days) ? [...new Set(days.filter(validDay))].sort() : []
  } catch { return [] }
}

// Keep the claim with its player until a server-confirmed save includes it.
export function rememberClaim(mode, id, day) {
  if (!validDay(day)) return
  const days = pendingClaims(mode, id)
  if (!days.includes(day)) getSaveStorage()?.setItem(keyFor(mode, id), JSON.stringify([...days, day]))
}

export function acknowledgeClaims(mode, id, through) {
  if (!validDay(through)) return
  const days = pendingClaims(mode, id)
  if (!days.length) return
  const left = days.filter((day) => day > through)
  const storage = getSaveStorage()
  if (left.length) storage?.setItem(keyFor(mode, id), JSON.stringify(left))
  else storage?.removeItem(keyFor(mode, id))
}
