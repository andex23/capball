import { loadSdk } from './sdk'
import { switchSaveTo } from './ownership'
import { applySave, collectSave, hasSaveItems } from '../utils/playerSave'

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

export async function readCloudSave(sdk, playerId) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
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
    try {
      const data = await readCloudSave(sdk, launch.player.id)
      if (data) applySave(data)
      cloudBaseline = data ? JSON.stringify(collectSave()) : ''
    } catch { /* Keep playing locally until we can confirm which cloud save belongs here. */ }
    return { sdk, launch, cloudBaseline, localAtLaunch }
  } catch (error) {
    return { error }
  }
}
