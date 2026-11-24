import { isLagos } from '../platform'

export const STORAGE_KEY = 'capball:v1'
// Everything that makes up a player's save (the device key lets online
// tournament seats follow the player to a new phone)
const SAVE_KEYS = [STORAGE_KEY, 'capball:tournaments:v1', 'capball:savedMatch:v1', 'capball:history:v1', 'capball:career:v1', 'capball:career-mode:v1', 'capball:career-hof:v1', 'capball:unlocks-seen:v1', 'capball:daily:v1', 'capball:achievements:v1', 'capball:rivals:v1', 'capball:inbox-seen:v1', 'capball:rewards:v1', 'capball:training:v1', 'capball.tutorialDone', 'capball.coached', 'capball.chipTip', 'capball.device']

function deviceStorage() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

// Some embedded browsers deny third-party storage. Keep this game's writes
// for the life of the frame so a verified player's cloud save still works.
let frameStorage
export function getSaveStorage() {
  if (!isLagos()) return deviceStorage()
  if (frameStorage) return frameStorage
  const disk = deviceStorage()
  const temporary = new Map()
  frameStorage = {
    getItem(key) {
      if (temporary.has(key)) return temporary.get(key)
      try { return disk?.getItem(key) ?? null } catch { return null }
    },
    setItem(key, value) {
      if (disk) {
        try { disk.setItem(key, value); temporary.delete(key); return } catch { /* keep it in this frame */ }
      }
      temporary.set(key, String(value))
    },
    removeItem(key) {
      if (disk) {
        try { disk.removeItem(key); temporary.delete(key); return } catch { /* mask the disk entry */ }
      }
      temporary.set(key, null)
    },
  }
  return frameStorage
}

/** The player's save as it is on this phone right now. */
export function collectSave() {
  const data = { v: 1, items: {} }
  for (const key of SAVE_KEYS) {
    try {
      const v = getSaveStorage()?.getItem(key)
      if (typeof v === 'string') data.items[key] = v
    } catch { /* skip */ }
  }
  return data
}

/** Put a save from the server onto this phone. Returns true if anything changed. */
export function applySave(data) {
  if (!data || data.v !== 1 || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) return false
  const storage = getSaveStorage()
  if (!storage) return false
  let changed = false
  for (const key of SAVE_KEYS) {
    const v = data.items[key]
    try {
      if (typeof v === 'string') {
        if (storage.getItem(key) !== v) { storage.setItem(key, v); changed = true }
      } else if (!Object.hasOwn(data.items, key) && storage.getItem(key) != null) {
        storage.removeItem(key)
        changed = true
      }
    } catch { /* storage full or blocked */ }
  }
  return changed
}

export const hasSaveItems = (data) => !!data?.items && Object.keys(data.items).some((k) => k !== 'capball.device')
