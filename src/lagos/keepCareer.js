/**
 * Which career to keep when this phone and the cloud disagree. A career must
 * never be lost because another device (with less progress) saved first:
 * the one that has got further wins, unless it was retired or sacked.
 * Pure: takes and returns the saved strings.
 */
export const CAREER_KEY = 'capball:career-mode:v1'
export const HALL_KEY = 'capball:career-hof:v1'

const parse = (raw) => { try { return raw ? JSON.parse(raw) : null } catch { return null } }

/** How far a saved career has got: seasons first, then matches played. */
export function careerProgress(raw) {
  const c = parse(raw)
  if (!c || typeof c !== 'object' || !c.league) return -1
  const played = (t) => (Array.isArray(t?.fixtures) ? t.fixtures.filter((f) => f?.result).length : 0)
  const season = Number.isInteger(c.season) ? c.season : 1
  return season * 1000 + played(c.league) + played(c.cup)
}

/** Was this career ended (retired or sacked) according to the Hall of Fame? */
export function careerEnded(raw, hallRaw) {
  const c = parse(raw)
  const hall = parse(hallRaw)
  if (!c?.club?.name || !Array.isArray(hall)) return false
  return hall.some((h) => h?.club === c.club.name && Number(h.seasons) >= (c.season || 1))
}

/** The longer Hall of Fame (they only ever grow). */
export function bestHall(...halls) {
  return halls.filter(Boolean).sort((a, b) => (parse(b)?.length || 0) - (parse(a)?.length || 0))[0] || null
}

/**
 * The career to keep, from this phone, the cloud and the last backup. Returns
 * the saved string, or null for no career.
 */
export function bestCareer({ local = null, cloud = null, backup = null, hall = null }) {
  const live = [cloud, local, backup].filter((raw) => careerProgress(raw) >= 0 && !careerEnded(raw, hall))
  if (!live.length) return null
  // Cloud first, so a tie keeps what the cloud has
  return live.reduce((best, raw) => (careerProgress(raw) > careerProgress(best) ? raw : best))
}

/**
 * A cloud save to put on this phone, with the further career (and the longer
 * Hall of Fame) kept. Returns { save, kept } where kept says the career came
 * from this phone or the backup rather than the cloud.
 */
export function mergeIntoPhone(local, cloud, backup = null) {
  const hall = bestHall(local?.items?.[HALL_KEY], cloud?.items?.[HALL_KEY])
  const career = bestCareer({ local: local?.items?.[CAREER_KEY], cloud: cloud?.items?.[CAREER_KEY], backup, hall })
  const items = { ...cloud.items }
  if (hall) items[HALL_KEY] = hall
  if (career) items[CAREER_KEY] = career
  else delete items[CAREER_KEY]
  return { save: { ...cloud, items }, kept: items[CAREER_KEY] !== cloud.items[CAREER_KEY] }
}
