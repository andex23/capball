/**
 * Bought and earned caps and bands belong to the Lagos Life player who got
 * them, and only they can use them.
 *
 * - Each player's save (kits, career, records, unlocks) is kept apart on a
 *   phone shared by several Lagos Life players.
 * - A kit may only wear what this player owns: bought (from our server) or
 *   earned (from their own progress). Anything else comes off.
 */
import { collectSave, applySave, getSaveStorage as store } from '../utils/playerSave'
import { CAP_DESIGNS, RARE_DESIGNS, isUnlocked } from '../data/TeamOptions'
import { SHOP_DESIGNS, productIdFor } from '../data/shop'
import { isFreeBandPart, ownBand } from '../game/bandStyle'

const OWNER_KEY = 'counterball:lagos:owner'
const saveKey = (id) => `counterball:lagos:save:${id}`

/**
 * Make this phone's save the given player's. If someone else played here
 * last, their save is put away and this player's own comes back (empty for a
 * first visit). Returns true when the selected progress changed.
 */
export function switchSaveTo(playerId) {
  const ls = store()
  if (!ls || !playerId) return false
  const owner = ls.getItem(OWNER_KEY)
  if (owner === playerId) return false
  try {
    if (owner) ls.setItem(saveKey(owner), JSON.stringify(collectSave()))
    let mine = null
    try { mine = JSON.parse(ls.getItem(saveKey(playerId)) || 'null') } catch { mine = null }
    // No owner yet: the save already on this phone becomes this player's
    const changed = owner ? applySave(mine?.v === 1 ? mine : { v: 1, items: {} }) : false
    ls.setItem(OWNER_KEY, playerId)
    return changed
  } catch {
    return false
  }
}

const STARTERS = new Set(CAP_DESIGNS.map((d) => d.key))
const RARE = new Map(RARE_DESIGNS.map((d) => [d.key, d]))
const EXCLUSIVE = new Set(SHOP_DESIGNS.map((d) => d.key))

/** May this player put this cap artwork on a kit? */
export function canUseArt(art, { owned, progress }) {
  if (!art || STARTERS.has(art)) return true
  if (RARE.has(art)) return isUnlocked(RARE.get(art), progress) || owned.includes(productIdFor(art))
  if (EXCLUSIVE.has(art)) return owned.includes(productIdFor(art))
  return true
}

/**
 * May this player use this Band Studio extra (a pattern or finish)? Free ones
 * always; paid ones once bought from the wallet. Anyone who bought one of the
 * old single-colour bands in Lagos Life keeps every extra.
 */
export function canUseBand(key, { owned = [], bandParts = [] }) {
  return isFreeBandPart(key) || bandParts.includes(key) || owned.some((p) => typeof p === 'string' && p.startsWith('band_'))
}

/**
 * A kit with anything this player doesn't own taken off: a cap they don't
 * own goes back to the plain team colours; a band extra they haven't bought goes
 * back to a free one.
 * Returns null when the kit is fine as it is.
 */
export function ownKit(config, fallback, who) {
  if (!config) return null
  let next = null
  if (config.art && !canUseArt(config.art, who)) {
    next = { ...config, art: '', primary: fallback.primary, edge: fallback.edge, pattern: fallback.pattern, badge: fallback.badge, finish: fallback.finish, capText: fallback.capText, textColor: '', skirtColor: '' }
  }
  const banded = ownBand(next || config, (k) => canUseBand(k, who))
  return banded || next
}
