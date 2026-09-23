/**
 * Remembers the player's setup, settings and records across reloads.
 *
 * initPersistence() hydrates the match store once from localStorage, then
 * watches it: preference changes are saved (debounced) and each finished
 * match updates the records exactly once.
 *
 * Online, the host mirrors the match setup (teams, stadium, …) onto the
 * guest's store. Those values aren't the guest's choices, so while online
 * only this device's own settings are saved, and leaving an online session
 * puts the player's saved setup back.
 */

import { create } from 'zustand'
import { useMatchStore } from './MatchStore'
import { getStorage, loadSaved, pickPrefs, prefsToState, syncedPrefs, serialize, writeRaw, PREF_KEYS, OPTIONAL_PREF_KEYS } from '../utils/storage'
import { emptyRecords, matchEntry, applyMatch, resetRecords as clearRecords } from '../game/records'

/** Records for the UI. lastUpdate: { matchKey, newBests } of the latest recorded match. */
export const useRecordsStore = create(() => ({ records: emptyRecords(), lastUpdate: null }))

const WATCHED_KEYS = [...PREF_KEYS, ...OPTIONAL_PREF_KEYS]

let active = null

/**
 * Start persistence. Safe to call more than once (later calls are no-ops).
 * Returns a function that stops it (flushing any pending save) — for tests.
 */
export function initPersistence({ storage = getStorage(), debounceMs = 300 } = {}) {
  if (active) return active.stop

  // Match ids must be unique across reloads (matchKey restarts at 0) and
  // across online opponents (a guest sees each host's own matchKey).
  const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  let epoch = 0
  const idFor = (matchKey) => `${session}.${epoch}.${matchKey}`

  const saved = loadSaved(storage, useMatchStore.getState())
  try {
    useMatchStore.setState(prefsToState(saved.prefs))
  } catch {
    // A bad value must never stop the game from starting
  }
  useRecordsStore.setState({ records: saved.records, lastUpdate: null })

  // Full picture of the player's own prefs (defaults included)
  let savedPrefs = pickPrefs(useMatchStore.getState())
  let lastWritten = null
  let timer = null

  const isOnline = (s) => s.gameMode === 'online'

  function flush() {
    if (timer) { clearTimeout(timer); timer = null }
    const state = useMatchStore.getState()
    savedPrefs = isOnline(state) ? { ...savedPrefs, ...pickPrefs(state, { localOnly: true }) } : pickPrefs(state)
    const json = serialize({ prefs: savedPrefs, records: useRecordsStore.getState().records })
    if (json === lastWritten) return
    if (writeRaw(storage, json)) lastWritten = json
  }

  function scheduleSave() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }

  const unsubscribe = useMatchStore.subscribe((state, prev) => {
    try {
      if (state.onlineMyTeam !== prev.onlineMyTeam) epoch += 1

      if (state.matchResult !== prev.matchResult) {
        if (!state.matchResult) {
          useRecordsStore.setState({ lastUpdate: null })
        } else {
          const entry = matchEntry(state, idFor)
          const result = entry && applyMatch(useRecordsStore.getState().records, entry)
          if (result?.changed) {
            useRecordsStore.setState({ records: result.records, lastUpdate: { matchKey: state.matchKey, newBests: result.newBests } })
            flush()
          }
        }
      }

      if (isOnline(prev) && !isOnline(state)) {
        // Back to the player's own teams, stadium, … after an online session
        useMatchStore.setState(prefsToState(syncedPrefs(savedPrefs)))
        return
      }

      if (WATCHED_KEYS.some((k) => state[k] !== prev[k])) scheduleSave()
    } catch (err) {
      console.error('CAPBALL: could not save progress', err)
    }
  })

  const onHide = () => { if (timer) flush() }
  const win = typeof window !== 'undefined' ? window : null
  win?.addEventListener('pagehide', onHide)

  const stop = () => {
    unsubscribe()
    win?.removeEventListener('pagehide', onHide)
    if (timer) flush()
    active = null
  }
  active = { stop, flush }
  return stop
}

/** Wipe all records (asks for confirmation in the UI first). */
export function resetRecords() {
  useRecordsStore.setState((s) => ({ records: clearRecords(s.records), lastUpdate: null }))
  active?.flush()
}
