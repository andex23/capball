/**
 * Player accounts: a username and a password, nothing else (see
 * supabase/accounts.sql). Signed in, the game keeps the player's save — kits,
 * settings, records, tournaments — on the server, so they can pick it up on
 * another phone.
 *
 * The save is simply the game's own localStorage entries, copied up as they
 * are. Signing in on a phone that has an online save loads that save and
 * reloads the page, so every store starts from it cleanly.
 */
import { create } from 'zustand'
import { rpc, ApiError } from '../online/supabase'
import { STORAGE_KEY } from '../utils/storage'
import { useMatchStore, SCREEN } from './MatchStore'

const SESSION_KEY = 'capball:account'
// Everything that makes up a player's save (the device key lets online
// tournament seats follow the player to a new phone)
const SAVE_KEYS = [STORAGE_KEY, 'capball:tournaments:v1', 'capball:savedMatch:v1', 'capball:history:v1', 'capball:career:v1', 'capball:career-mode:v1', 'capball:career-hof:v1', 'capball:unlocks-seen:v1', 'capball:daily:v1', 'capball:achievements:v1', 'capball:rivals:v1', 'capball.tutorialDone', 'capball.coached', 'capball.device']
// Progress that belongs to the account: cleared from the phone on sign out (it stays on the server)
export const PROGRESS_KEYS = ['capball:tournaments:v1', 'capball.device', 'capball:savedMatch:v1', 'capball:history:v1', 'capball:career:v1', 'capball:career-mode:v1', 'capball:career-hof:v1', 'capball:unlocks-seen:v1', 'capball:daily:v1', 'capball:achievements:v1', 'capball:rivals:v1']

/** Is a player signed in on this phone? (Stats, streaks and rewards only count when they are.) */
export const isSignedIn = () => !!useAccountStore.getState().username
const AUTOSAVE_MS = 45_000
const RECOVERY_KEY = 'capball:new-recovery-code'
function readRecoveryCode() {
  try { const v = sessionStorage.getItem(RECOVERY_KEY); return /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(v || '') ? v : null } catch { return null }
}
/** Recovery calls on a database that hasn't had recovery.sql yet get a plain message. */
const recoveryError = (e) => (/cb_account_recover|cb_help_request|cb_account_recovery|PGRST202|http-404/i.test(`${e?.code} ${e?.message}`) ? new ApiError('recovery-unavailable').message : e?.message)

const storage = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

function readSession() {
  try {
    const raw = storage()?.getItem(SESSION_KEY)
    const s = raw ? JSON.parse(raw) : null
    return s && typeof s.token === 'string' && typeof s.username === 'string' ? s : null
  } catch { return null }
}

function writeSession(s) {
  try {
    if (s) storage()?.setItem(SESSION_KEY, JSON.stringify(s))
    else storage()?.removeItem(SESSION_KEY)
  } catch { /* storage blocked: signed in for this visit only */ }
}

/** The player's save as it is on this phone right now. */
export function collectSave() {
  const data = { v: 1, items: {} }
  for (const key of SAVE_KEYS) {
    try {
      const v = storage()?.getItem(key)
      if (typeof v === 'string') data.items[key] = v
    } catch { /* skip */ }
  }
  return data
}

/** Put a save from the server onto this phone. Returns true if anything changed. */
export function applySave(data) {
  if (!data || data.v !== 1 || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) return false
  let changed = false
  for (const key of SAVE_KEYS) {
    const v = data.items[key]
    try {
      if (typeof v === 'string') {
        if (storage()?.getItem(key) !== v) { storage()?.setItem(key, v); changed = true }
      } else if (!Object.hasOwn(data.items, key) && storage()?.getItem(key) != null) {
        storage()?.removeItem(key)
        changed = true
      }
    } catch { /* storage full or blocked */ }
  }
  return changed
}

const hasItems = (data) => !!data?.items && Object.keys(data.items).some((k) => k !== 'capball.device')

let timer = null
let lastSent = ''
let saveTask = null

export const useAccountStore = create((set, get) => ({
  username: readSession()?.username || null,
  token: readSession()?.token || null,
  busy: false,
  error: null,
  savedAt: null,
  saving: false,

  async signUp(username, password) {
    return get().enter('cb_account_signup', username, password)
  },

  async signIn(username, password) {
    return get().enter('cb_account_login', username, password)
  },

  /** Sign up or sign in, then bring the save across (or upload this phone's). */
  async enter(fn, username, password) {
    set({ busy: true, error: null })
    try {
      const res = await rpc(fn, { p_username: username, p_password: password })
      if (res?.error) throw new ApiError(res.error)
      // A new account gets its recovery code straight away (shown once)
      if (fn === 'cb_account_signup' && typeof res?.token === 'string') {
        try { const r = await rpc('cb_account_recovery_new', { p_token: res.token }); if (r?.code) get().showRecoveryCode(r.code) } catch { /* not switched on yet */ }
      }
      return await get().begin(res)
    } catch (e) {
      set({ error: e.message })
      return false
    } finally {
      set({ busy: false })
    }
  },

  /** Forgot password: username + recovery code + a new password. Signs in and issues a fresh code. */
  async recover(username, code, password) {
    set({ busy: true, error: null })
    try {
      const res = await rpc('cb_account_recover', { p_username: username, p_code: code, p_password: password })
      if (res?.error) throw new ApiError(res.error)
      if (res?.code) get().showRecoveryCode(res.code)
      return await get().begin(res)
    } catch (e) {
      set({ error: recoveryError(e) })
      return false
    } finally {
      set({ busy: false })
    }
  },

  /** Forgot password, no code: ask an admin for help. */
  async askHelp(username, contact, note) {
    set({ busy: true, error: null })
    try {
      await rpc('cb_help_request', { p_username: username, p_contact: contact, p_note: note || '' })
      return true
    } catch (e) {
      set({ error: recoveryError(e) })
      return false
    } finally {
      set({ busy: false })
    }
  },

  /** The recovery code to show (once), kept through a reload until the player says it's saved. */
  recoveryCode: readRecoveryCode(),
  /** Does the signed-in account have a recovery code? (null: not checked) */
  hasRecovery: null,
  showRecoveryCode(code) {
    try { sessionStorage.setItem(RECOVERY_KEY, code) } catch { /* fine */ }
    set({ recoveryCode: code, hasRecovery: true })
  },
  recoverySaved() {
    try { sessionStorage.removeItem(RECOVERY_KEY) } catch { /* fine */ }
    set({ recoveryCode: null })
  },
  async checkRecovery() {
    const { token } = get()
    if (!token) return
    try { const r = await rpc('cb_account_recovery_status', { p_token: token }); set({ hasRecovery: !!r?.has }) } catch { /* not switched on yet: say nothing */ }
  },
  async newRecoveryCode() {
    const { token } = get()
    if (!token) return false
    try {
      const r = await rpc('cb_account_recovery_new', { p_token: token })
      if (!r?.code) return false
      get().showRecoveryCode(r.code)
      return true
    } catch (e) {
      set({ error: recoveryError(e) })
      return false
    }
  },

  /** Signed in (by password or recovery code): bring the save across, or upload this phone's. */
  async begin(res) {
    if (typeof res?.token !== 'string' || !res.token || typeof res?.username !== 'string') throw new Error('The server did not return an account session.')
    const cloud = await rpc('cb_account_load', { p_token: res.token })
    writeSession({ token: res.token, username: res.username })
    lastSent = ''
    set({ token: res.token, username: res.username, savedAt: null })
    if (hasItems(cloud?.data)) {
      // Their save is on the server: load it and restart from it
      if (applySave(cloud.data) && typeof window !== 'undefined') {
        window.location.reload()
        return true
      }
      set({ savedAt: cloud.savedAt })
    } else {
      if (!await get().save({ force: true })) return false
    }
    get().startAutosave()
    return true
  },

  /** Upload this phone's save (skipped when nothing changed since the last upload). */
  async save({ force = false } = {}) {
    // Wait for an earlier upload, then collect again: career changes made
    // during that request must not be dropped or acknowledged too early.
    if (saveTask) {
      await saveTask
      return get().save({ force })
    }
    const { token } = get()
    if (!token) return false
    const data = collectSave()
    const json = JSON.stringify(data)
    if (!force && json === lastSent) return true
    set({ saving: true })
    const task = (async () => {
      try {
        const res = await rpc('cb_account_save', { p_token: token, p_data: data })
        if (!res?.ok) throw new Error('The server did not confirm that your progress was saved.')
        if (get().token !== token) return false
        lastSent = json
        set({ savedAt: res.savedAt || new Date().toISOString(), error: null })
        return true
      } catch (e) {
        if (get().token === token) {
          if (e.code === 'signed-out') get().forget()
          set({ error: e.message })
        }
        return false
      }
    })()
    saveTask = task
    try { return await task }
    finally {
      if (saveTask === task) saveTask = null
      set({ saving: false })
    }
  },

  /** Save, sign out, and take this account's progress off the phone (it stays on the server). */
  async signOut() {
    const { token } = get()
    if (token && !await get().save({ force: true })) return false
    rpc('cb_account_logout', { p_token: token }).catch(() => {})
    get().forget()
    for (const key of PROGRESS_KEYS) { try { storage()?.removeItem(key) } catch { /* blocked */ } }
    if (typeof window !== 'undefined') window.location.reload()
  },

  /** Drop the session on this phone (the save stays on the server). */
  forget() {
    writeSession(null)
    lastSent = ''
    if (timer) { clearInterval(timer); timer = null }
    set({ token: null, username: null, savedAt: null, hasRecovery: null })
  },

  /** Keep the server copy fresh: every so often, and when the game is put away. */
  startAutosave() {
    if (timer || typeof window === 'undefined') return
    timer = setInterval(() => get().save(), AUTOSAVE_MS)
    const flush = () => { if (document.visibilityState === 'hidden') get().save() }
    document.addEventListener('visibilitychange', flush)
  },
}))

/** On start-up: if this phone is signed in, keep its save backed up. */
export function initAccount() {
  const s = useAccountStore.getState()
  if (s.token) s.startAutosave()
  // Back up right after each match (records and tournament results just changed)
  useMatchStore.subscribe((m, prev) => {
    if (m.screen === SCREEN.MATCH_END && prev.screen !== SCREEN.MATCH_END) {
      setTimeout(() => {
        useAccountStore.getState().save()
        // and onto the leaderboard (signed in only)
        import('./boardStore').then((m) => m.postMine()).catch(() => {})
      }, 3000)
    }
  })
}
