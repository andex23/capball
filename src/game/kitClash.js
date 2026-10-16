/**
 * Two sides that look the same can't be told apart on the pitch. Play
 * anytime brings each player's own kit, and everyone's starts as the same red
 * "Team 1", so the away side changes into a contrasting kit (for display
 * only: the saved match keeps what each player chose).
 */

const rgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Are two colours too close to tell apart at a glance? */
export function similarColours(a, b, within = 90) {
  const x = rgb(a), y = rgb(b)
  if (!x || !y) return false
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < within
}

const AWAY = [
  { primary: '#1565C0', edge: '#FFFFFF' },
  { primary: '#F5F5F5', edge: '#212121' },
  { primary: '#212121', edge: '#FFD700' },
]

/** The two kits, with the away side changed if it would look like the home side. */
export function kitsApart(teams) {
  const home = teams?.team1, away = teams?.team2
  if (!home || !away) return teams
  const looksSame = (home.art && home.art === away.art) || (!away.art && !home.art && similarColours(home.primary, away.primary))
  const sameName = typeof home.name === 'string' && typeof away.name === 'string' && home.name.trim().toLowerCase() === away.name.trim().toLowerCase()
  if (!looksSame && !sameName) return teams
  let next = { ...away }
  if (looksSame) {
    const kit = AWAY.find((k) => !similarColours(k.primary, home.primary)) || AWAY[0]
    next = { ...next, ...kit, art: '', pattern: 'none', textColor: '', skirtColor: '' }
  }
  if (sameName) next.name = /^team 1$/i.test(away.name.trim()) ? 'Team 2' : `${away.name.trim().slice(0, 11)} Away`
  return { ...teams, team2: next }
}
