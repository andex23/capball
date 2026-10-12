/**
 * Turning a Lagos Life friend match into a Counterball room: both phones
 * work out the same room code from the match, and the same player hosts.
 */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function fnv(text, seed) {
  let h = seed >>> 0
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/** The room both phones meet in for this match. */
export function roomCodeFor(matchId) {
  let code = 'LL'
  let h = fnv(matchId, 2166136261)
  for (let i = 0; i < 10; i++) {
    if (i === 5) h = fnv(`${matchId}:2`, 2166136261)
    code += CHARS[h % CHARS.length]
    h = Math.floor(h / CHARS.length)
  }
  return code
}

/** Whoever's id sorts first hosts (plays the home team), so both phones agree. */
export function isHostFor(match, myId) {
  const ids = (match?.players || []).map((p) => p.id).filter(Boolean).sort()
  return ids.length === 2 && ids[0] === myId
}

export const opponentOf = (match, myId) => (match?.players || []).find((p) => p.id !== myId) || null
