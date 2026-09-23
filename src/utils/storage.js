/**
 * Saved preferences and records in localStorage — pure helpers.
 *
 * Everything lives under one versioned key. Anything read back is treated
 * as untrusted: each field is validated against the real option lists and
 * dropped if it doesn't fit, and every storage call is wrapped so private
 * mode, a full quota or disabled storage just means "nothing saved".
 */

import { sanitizeTeamConfig, SYNC_KEYS } from '../multiplayer/protocol'
import { DEFAULT_TEAM_CONFIG, MATCH_DURATIONS } from '../state/MatchStore'
import { STADIUMS } from '../data/StadiumData'
import { FORMATIONS } from '../data/TeamData'
import { AI_DIFFICULTIES, emptyRecords, sanitizeRecords } from '../game/records'

export const STORAGE_KEY = 'capball:v1'
const VERSION = 1
const MAX_BYTES = 200_000

export const PREF_KEYS = [
  'teamConfig', 'ballColor', 'stadium', 'formations', 'matchDuration', 'chosenTeam1Side',
  'aiDifficulty', 'masterVolume', 'sfxVolume', 'musicVolume', 'muted',
]
/**
 * Settings other features may add to the store. Saved only if the store
 * actually has them, and only as a boolean or a small number.
 */
export const OPTIONAL_PREF_KEYS = ['shotClock', 'vibration', 'haptics']

/** Prefs the online host mirrors onto the guest's store (so not the guest's own). */
export const isSyncedPref = (key) => SYNC_KEYS.includes(key)

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const unit = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined)

/** localStorage, or null when the browser won't give us one. */
export function getStorage() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

function sanitizeTeam(team, input) {
  const clean = sanitizeTeamConfig(input)
  const base = DEFAULT_TEAM_CONFIG[team]
  return { ...base, ...clean, numbers: { ...base.numbers, ...clean.numbers } }
}

/**
 * Keep only valid preferences. `defaults` (usually the store's current state)
 * says which optional keys exist and what type they are.
 */
export function sanitizePrefs(input, defaults = {}) {
  if (!isObj(input)) return {}
  const out = {}

  if (isObj(input.teamConfig)) {
    const teamConfig = {}
    for (const team of ['team1', 'team2']) {
      if (isObj(input.teamConfig[team])) teamConfig[team] = sanitizeTeam(team, input.teamConfig[team])
    }
    if (Object.keys(teamConfig).length) out.teamConfig = { ...DEFAULT_TEAM_CONFIG, ...teamConfig }
  }
  if (typeof input.ballColor === 'string' && HEX_COLOR.test(input.ballColor)) out.ballColor = input.ballColor
  if (typeof input.stadium === 'string' && Object.hasOwn(STADIUMS, input.stadium)) out.stadium = input.stadium
  if (isObj(input.formations)) {
    const formations = {}
    for (const team of ['team1', 'team2']) {
      const f = input.formations[team]
      if (typeof f === 'string' && Object.hasOwn(FORMATIONS, f)) formations[team] = f
    }
    if (Object.keys(formations).length) out.formations = { team1: 'default', team2: 'default', ...formations }
  }
  if (MATCH_DURATIONS.includes(input.matchDuration)) out.matchDuration = input.matchDuration
  if (input.chosenTeam1Side === 'left' || input.chosenTeam1Side === 'right') out.chosenTeam1Side = input.chosenTeam1Side
  if (AI_DIFFICULTIES.includes(input.aiDifficulty)) out.aiDifficulty = input.aiDifficulty
  for (const key of ['masterVolume', 'sfxVolume', 'musicVolume']) {
    const v = unit(input[key])
    if (v !== undefined) out[key] = v
  }
  if (typeof input.muted === 'boolean') out.muted = input.muted

  for (const key of OPTIONAL_PREF_KEYS) {
    if (!Object.hasOwn(defaults, key) || !Object.hasOwn(input, key)) continue
    const v = input[key]
    if (typeof defaults[key] === 'boolean' && typeof v === 'boolean') out[key] = v
    else if (typeof defaults[key] === 'number' && Number.isFinite(v) && v >= 0 && v <= 3600) out[key] = v
  }
  return out
}

/**
 * Snapshot of the preferences in a store state. `localOnly` leaves out the
 * ones an online host overwrites, which aren't this player's choices.
 */
export function pickPrefs(state, { localOnly = false } = {}) {
  const out = {}
  for (const key of PREF_KEYS) if (state[key] !== undefined) out[key] = state[key]
  for (const key of OPTIONAL_PREF_KEYS) {
    if (typeof state[key] === 'boolean' || typeof state[key] === 'number') out[key] = state[key]
  }
  if (localOnly) for (const key of Object.keys(out)) if (isSyncedPref(key)) delete out[key]
  return out
}

/** Only the prefs an online host overwrites. */
export function syncedPrefs(prefs) {
  const out = {}
  for (const key of Object.keys(prefs)) if (isSyncedPref(key)) out[key] = prefs[key]
  return out
}

/** Store fields to set from saved prefs (the current side follows the chosen one). */
export function prefsToState(prefs) {
  const out = { ...prefs }
  if (prefs.chosenTeam1Side) out.team1Side = prefs.chosenTeam1Side
  return out
}

/** Read and validate everything saved. Never throws. */
export function loadSaved(storage = getStorage(), defaults = {}) {
  const empty = { prefs: {}, records: emptyRecords() }
  if (!storage) return empty
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) return empty
    const data = JSON.parse(raw)
    if (!isObj(data) || data.v !== VERSION) return empty
    return { prefs: sanitizePrefs(data.prefs, defaults), records: sanitizeRecords(data.records) }
  } catch {
    return empty
  }
}

/** Serialise what we'd write, so callers can skip identical writes. */
export function serialize({ prefs, records }) {
  return JSON.stringify({ v: VERSION, prefs, records })
}

/** Write a serialised payload. Returns false if storage refused it. */
export function writeRaw(storage, json) {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, json)
    return true
  } catch {
    return false
  }
}
