import { loadSdk } from './sdk'
import { switchSaveTo } from './ownership'
import { applySave, collectSave, hasSaveItems, getSaveStorage } from '../utils/playerSave'
import { CAREER_KEY, mergeIntoPhone } from './keepCareer'

/** Every call to the game server uses the current Lagos Life session. */
export async function lagosRequest(sdk, body, signal) {
  const { session } = await sdk.session()
  const payload = JSON.stringify({ ...body, session })
  const keepalive = body.action === 'putSave' && new TextEncoder().encode(payload).length <= 60_000
  const res = await fetch('/api/lagos', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: payload, signal, keepalive,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Couldn’t reach the game server. Try again.'), { code: data?.error || 'server' })
  return data
}

export async function readCloudSave(sdk, playerId, waitMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), waitMs)
  try {
    const { data } = await lagosRequest(sdk, { action: 'loadSave', expectedPlayerId: playerId }, controller.signal)
    if (data === null) return null
    if (data?.v !== 1 || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) throw new Error('Unreadable save')
    return hasSaveItems(data) ? data : null
  } finally { clearTimeout(timeout) }
}

/** Select the player's progress before importing stores that read and write it on startup. */
export async function prepareLagosLaunch() {
  try {
    const sdk = await loadSdk()
    const launch = await sdk.init()
    if (!launch?.player?.id) throw new Error('Missing Lagos Life player')
    switchSaveTo(launch.player.id)
    const localAtLaunch = collectSave()
    let cloudBaseline = null
    let keptCareer = false
    const backupKey = `counterball:lagos:career-backup:${launch.player.id}`
    const store = getSaveStorage()
    // A slow connection (or a server waking up) gets a second, longer try before the game opens
    for (const waitMs of [10_000, 15_000]) {
      try {
        const data = await readCloudSave(sdk, launch.player.id, waitMs)
        if (data) {
          // The cloud save comes in, but never at the cost of a career that got further on this phone
          let backup = null
          try { backup = store?.getItem(backupKey) ?? null } catch { /* none */ }
          const merged = mergeIntoPhone(localAtLaunch, data, backup)
          keptCareer = merged.kept
          applySave(merged.save)
        }
        // What the cloud holds: if a career was kept from this phone, the next save sends it up
        cloudBaseline = data ? (keptCareer ? JSON.stringify(data) : JSON.stringify(collectSave())) : ''
        break
      } catch { /* try again, then keep playing locally until we can confirm which cloud save belongs here */ }
    }
    // Keep a copy of the career this phone opens with, in case a save ever goes missing again
    try {
      const now = collectSave().items[CAREER_KEY]
      if (now) store?.setItem(backupKey, now)
    } catch { /* storage full or blocked */ }
    return { sdk, launch, cloudBaseline, localAtLaunch, keptCareer }
  } catch (error) {
    return { error }
  }
}
