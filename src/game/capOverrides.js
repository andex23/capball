/**
 * Changes the admin console makes to the ready-made caps: a new name, new
 * words printed on the cap, or hidden from the list. Read once per visit from
 * the server (supabase/cap-designs.sql), kept for offline, applied on top of
 * CAP_DESIGNS. Built-in values stand wherever nothing is set.
 */
import { create } from 'zustand'
import { rpc } from '../online/supabase'
import { CAP_DESIGNS } from '../data/TeamOptions'
import { setCapLabels } from './capArt'

const CACHE_KEY = 'capball:cap-designs'
const KEY = /^[a-z0-9]{2,20}$/
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')

/** Clean changes: { key: { name?, main?, sub?, hidden? } }. */
export function cleanCapOverrides(input) {
  const out = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [k, v] of Object.entries(input).slice(0, 40)) {
    if (!KEY.test(k) || !v || typeof v !== 'object') continue
    const one = {}
    const name = str(v.name, 20); if (name) one.name = name
    const main = str(v.main, 16); if (main) one.main = main
    const sub = str(v.sub, 22); if (sub) one.sub = sub
    if (v.hidden === true) one.hidden = true
    if (Object.keys(one).length) out[k] = one
  }
  return out
}

/** The ready-made caps with the admin's changes (hidden ones left out unless `all`). */
export function applyCapOverrides(map, { all = false } = {}) {
  return CAP_DESIGNS
    .filter((d) => all || !map[d.key]?.hidden)
    .map((d) => {
      const o = map[d.key]
      if (!o) return d
      return { ...d, name: o.name || d.name, capText: o.main ? o.main.toUpperCase().slice(0, 12) : d.capText, hidden: !!o.hidden }
    })
}

const storage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }
function cached() {
  try { return cleanCapOverrides(JSON.parse(storage()?.getItem(CACHE_KEY) || 'null')) } catch { return {} }
}

export const useCapOverrides = create(() => ({ map: {} }))

function applyMap(map) {
  setCapLabels(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { main: v.main, sub: v.sub }])))
  useCapOverrides.setState({ map })
}

/** On start-up: the last copy straight away, then the server's. */
export function initCapOverrides() {
  applyMap(cached())
  rpc('cb_cap_designs', {}, { timeoutMs: 6000 })
    .then((v) => {
      const map = cleanCapOverrides(v)
      try { if (v) storage()?.setItem(CACHE_KEY, JSON.stringify(map)); else storage()?.removeItem(CACHE_KEY) } catch { /* fine */ }
      applyMap(map)
    })
    .catch(() => { /* offline or not set up: keep what we have */ })
}

/** The ready-made caps to offer, kept current. */
export function useCapDesigns() {
  const map = useCapOverrides((s) => s.map)
  return applyCapOverrides(map)
}
