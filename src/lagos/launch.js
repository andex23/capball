import { loadSdk } from './sdk'
import { switchSaveTo } from './ownership'
import { applySave, collectSave, hasSaveItems } from '../utils/playerSave'

/** Every call to the game server uses the current Lagos Life session. */
export async function lagosRequest(sdk, body, signal) {
  const { session } = await sdk.session()
  const res = await fetch('/api/lagos', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, session }), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Couldn’t reach the game server. Try again.'), { code: data?.error || 'server' })
  return data
}

/** Select the player's progress before importing stores that read and write it on startup. */
export async function prepareLagosLaunch() {
  try {
    const sdk = await loadSdk()
    const launch = await sdk.init()
    if (!launch?.player?.id) throw new Error('Missing Lagos Life player')
    switchSaveTo(launch.player.id)
    let cloudBaseline = null
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await lagosRequest(sdk, { action: 'loadSave' }, controller.signal)
      if (response.data === null) cloudBaseline = ''
      else if (response.data?.v === 1 && response.data.items && typeof response.data.items === 'object' && !Array.isArray(response.data.items)) {
        if (hasSaveItems(response.data)) {
          applySave(response.data)
          cloudBaseline = JSON.stringify(collectSave())
        } else cloudBaseline = ''
      }
    } catch { /* Use this player's local save. Only upload after a successful cloud read. */ }
    finally { clearTimeout(timeout) }
    return { sdk, launch, cloudBaseline }
  } catch (error) {
    return { error }
  }
}
