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
const SAVE_KEYS = [STORAGE_KEY, 'capball:tournaments:v1', 'capball:savedMatch:v1', 'capball:history:v1', 'capball:career:v1', 'capball:career-mode:v1', 'capball:unlocks-seen:v1', 'capball:daily:v1', 'capball:achievements:v1', 'capball:rivals:v1', 'capball.tutorialDone', 'capball.coached', 'capball.device']
// Progress that belongs to the account: cleared from the phone on sign out (it stays on the server)
export const PROGRESS_KEYS = ['capball:savedMatch:v1', 'capball:history:v1', 'capball:career:v1', 'capball:career-mode:v1', 'capball:unlocks-seen:v1', 'capball:daily:v1', 'capball:achievements:v1', 'capball:rivals:v1']

/** Is a player signed in on this phone? (Stats, streaks and rewards only count when they are.) */
export const isSignedIn = () => !!useAccountStore.getState().username
const AUTOSAVE_MS = 45_000

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
  if (!data || typeof data !== 'object' || !data.items || typeof data.items !== 'object') return false
  let changed = false
  for (const key of SAVE_KEYS) {
    const v = data.items[key]
    if (typeof v !== 'string') continue
    try {
      if (storage()?.getItem(key) !== v) { storage()?.setItem(key, v); changed = true }
    } catch { /* storage full or blocked */ }
  }
  return changed
}

const hasItems = (data) => !!data?.items && Object.keys(data.items).some((k) => k !== 'capball.device')

let timer = null
let lastSent = ''

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
      writeSession({ token: res.token, username: res.username })
      set({ token: res.token, username: res.username })
      const cloud = await rpc('cb_account_load', { p_token: res.token })
      if (hasItems(cloud?.data)) {
        // Their save is on the server: load it and restart from it
        if (applySave(cloud.data) && typeof window !== 'undefined') {
          window.location.reload()
          return true
        }
        set({ savedAt: cloud.savedAt })
      } else {
        await get().save({ force: true })
      }
      get().startAutosave()
      return true
    } catch (e) {
      set({ error: e.message })
      return false
    } finally {
      set({ busy: false })
    }
  },

  /** Upload this phone's save (skipped when nothing changed since the last upload). */
  async save({ force = false } = {}) {
    const { token, saving } = get()
    if (!token || saving) return
    const data = collectSave()
    const json = JSON.stringify(data)
    if (!force && json === lastSent) return
    set({ saving: true })
    try {
      const res = await rpc('cb_account_save', { p_token: token, p_data: data })
      lastSent = json
      set({ savedAt: res?.savedAt || new Date().toISOString(), error: null })
    } catch (e) {
      if (e.code === 'signed-out') get().forget()
      set({ error: e.message })
    } finally {
      set({ saving: false })
    }
  },

  /** Save, sign out, and take this account's progress off the phone (it stays on the server). */
  async signOut() {
    const { token } = get()
    await get().save({ force: true })
    rpc('cb_account_logout', { p_token: token }).catch(() => {})
    get().forget()
    for (const key of PROGRESS_KEYS) { try { storage()?.removeItem(key) } catch { /* blocked */ } }
    if (typeof window !== 'undefined') window.location.reload()
  },

  /** Drop the session on this phone (the save stays on the server). */
  forget() {
    writeSession(null)
    if (timer) { clearInterval(timer); timer = null }
    set({ token: null, username: null, savedAt: null })
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
