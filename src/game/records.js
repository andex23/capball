/**
 * Player records — pure logic, no storage or store access.
 *
 * Buckets: vs CPU per difficulty and online track W/D/L plus goals; local
 * matches only count games played (there's no "you" in hot-seat play).
 * Each finished match is applied once, keyed by a match id. A penalty
 * shootout follows a drawn match (and gets its own matchKey), so when the
 * last thing recorded was that draw, the shootout turns it into a W or L.
 */

export const AI_DIFFICULTIES = ['easy', 'medium', 'hard']

const COUNT_MAX = 1e9
const ID_MAX = 80
const OUTCOMES = ['W', 'D', 'L']

const emptyWdl = () => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0 })

export function emptyRecords() {
  return {
    cpu: Object.fromEntries(AI_DIFFICULTIES.map((d) => [d, emptyWdl()])),
    online: emptyWdl(),
    local: { played: 0 },
    bests: { biggestWin: 0, mostGoals: 0, shootoutsWon: 0 },
    last: null, // { id, bucket, outcome } of the most recent recorded match
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const count = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, COUNT_MAX) : 0)

function isBucket(b) {
  return b === 'online' || b === 'local' || (typeof b === 'string' && b.startsWith('cpu:') && AI_DIFFICULTIES.includes(b.slice(4)))
}

function sanitizeWdl(input) {
  const src = isObj(input) ? input : {}
  const out = emptyWdl()
  for (const k of Object.keys(out)) out[k] = count(src[k])
  return out
}

/** Rebuild records from untrusted input, keeping only well-formed counts. */
export function sanitizeRecords(input) {
  const out = emptyRecords()
  if (!isObj(input)) return out
  const cpu = isObj(input.cpu) ? input.cpu : {}
  for (const d of AI_DIFFICULTIES) out.cpu[d] = sanitizeWdl(Object.hasOwn(cpu, d) ? cpu[d] : null)
  out.online = sanitizeWdl(input.online)
  out.local.played = count(isObj(input.local) ? input.local.played : 0)
  const bests = isObj(input.bests) ? input.bests : {}
  for (const k of Object.keys(out.bests)) out.bests[k] = count(bests[k])
  const last = input.last
  if (isObj(last) && typeof last.id === 'string' && last.id.length <= ID_MAX && isBucket(last.bucket) && OUTCOMES.includes(last.outcome)) {
    out.last = { id: last.id, bucket: last.bucket, outcome: last.outcome }
  }
  return out
}

/**
 * Describe a finished match from the player's point of view, or null when
 * there's nothing to record. `idFor(matchKey)` makes the unique match id.
 */
export function matchEntry(state, idFor) {
  const r = state.matchResult
  if (!isObj(r) || !isObj(r.score)) return null
  // Only a result for the match on screen — a guest can be sent a stale
  // result from the host's previous game while still in setup.
  if (state.screen !== 'PLAYING' && state.screen !== 'MATCH_END') return null
  if (!Number.isInteger(state.matchKey)) return null

  let bucket
  let me = null
  if (state.gameMode === 'ai') {
    if (!AI_DIFFICULTIES.includes(state.aiDifficulty)) return null
    bucket = `cpu:${state.aiDifficulty}`
    me = state.aiTeam === 'team1' ? 'team2' : 'team1'
  } else if (state.gameMode === 'online') {
    if (state.onlineMyTeam !== 'team1' && state.onlineMyTeam !== 'team2') return null
    bucket = 'online'
    me = state.onlineMyTeam
  } else if (state.gameMode === 'local') {
    bucket = 'local'
  } else {
    return null
  }

  const opp = me === 'team1' ? 'team2' : 'team1'
  const shootout = isObj(r.penaltyScore)
  let outcome = 'D'
  if (me && r.winner === me) outcome = 'W'
  else if (me && r.winner === opp) outcome = 'L'
  else if (!me && r.winner) outcome = 'W' // local: someone won; only "played" is counted

  return {
    id: idFor(state.matchKey),
    prevId: idFor(state.matchKey - 1),
    bucket,
    outcome,
    gf: me ? count(r.score[me]) : 0,
    ga: me ? count(r.score[opp]) : 0,
    shootout,
  }
}

function wdlOf(records, bucket) {
  if (bucket === 'online') return records.online
  if (bucket.startsWith('cpu:')) return records.cpu[bucket.slice(4)]
  return null
}

const OUTCOME_KEY = { W: 'w', D: 'd', L: 'l' }

/**
 * Apply one finished match. Returns { records, changed, newBests } and never
 * mutates the input. Applying the same entry id twice is a no-op.
 */
export function applyMatch(input, entry) {
  const records = sanitizeRecords(input)
  if (!entry || typeof entry.id !== 'string' || !isBucket(entry.bucket) || !OUTCOMES.includes(entry.outcome)) {
    return { records, changed: false, newBests: [] }
  }
  if (records.last?.id === entry.id) return { records, changed: false, newBests: [] }

  const newBests = []
  const wdl = wdlOf(records, entry.bucket)
  const last = records.last
  const settlesDraw = entry.shootout && entry.outcome !== 'D' && last
    && last.id === entry.prevId && last.bucket === entry.bucket && last.outcome === 'D'
    && (!wdl || wdl.d > 0)

  if (entry.bucket === 'local') {
    if (!settlesDraw) records.local.played = count(records.local.played + 1)
  } else if (settlesDraw) {
    // Same match, decided on penalties: move it from D to W/L. Goals were
    // already counted with the draw.
    wdl.d -= 1
    wdl[OUTCOME_KEY[entry.outcome]] += 1
  } else {
    wdl[OUTCOME_KEY[entry.outcome]] += 1
    wdl.gf = count(wdl.gf + entry.gf)
    wdl.ga = count(wdl.ga + entry.ga)
  }

  if (entry.bucket !== 'local') {
    const b = records.bests
    if (entry.shootout && entry.outcome === 'W') {
      b.shootoutsWon += 1
      newBests.push('shootoutWon')
    }
    if (!settlesDraw) {
      const margin = entry.gf - entry.ga
      if (entry.outcome === 'W' && margin > b.biggestWin) {
        b.biggestWin = margin
        newBests.push('biggestWin')
      }
      if (entry.gf > b.mostGoals) {
        b.mostGoals = entry.gf
        newBests.push('mostGoals')
      }
    }
  }

  records.last = { id: entry.id, bucket: entry.bucket, outcome: entry.outcome }
  return { records, changed: true, newBests }
}

/** Clear all stats but remember the last match so it can't be recounted. */
export function resetRecords(input) {
  const out = emptyRecords()
  out.last = sanitizeRecords(input).last
  return out
}

export function formatWdl({ w, d, l }, { hideZeroDraws = false } = {}) {
  return hideZeroDraws && !d ? `${w}W ${l}L` : `${w}W ${d}D ${l}L`
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** One-line record for the match-end screen. */
export function recordLine(records, state) {
  const r = sanitizeRecords(records)
  if (state.gameMode === 'ai' && AI_DIFFICULTIES.includes(state.aiDifficulty)) {
    return `Your record vs ${cap(state.aiDifficulty)} CPU: ${formatWdl(r.cpu[state.aiDifficulty])}`
  }
  if (state.gameMode === 'online') return `Online: ${formatWdl(r.online, { hideZeroDraws: true })}`
  if (state.gameMode === 'local') return `Local matches played: ${r.local.played}`
  return null
}

export const BEST_LABELS = {
  biggestWin: 'New best: biggest win!',
  mostGoals: 'New best: most goals in a match!',
  shootoutWon: 'Shootout won!',
}
