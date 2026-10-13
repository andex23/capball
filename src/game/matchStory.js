/**
 * A written match report for career mode: the kick-off, every goal with its
 * minute (the match clock shown as 90 football minutes), a few of the big
 * chances, and the final whistle. Text only (no audio). Pure.
 */
import { goalLine, line } from './commentary'

const clean = (s, n = 140) => String(s || '').slice(0, n)

/** The football minute (1–90, 91–120 in extra time) for a moment `t` seconds left in `half`, with halves `dur` seconds long. */
export function footballMinute(half, t, dur) {
  const d = dur > 0 ? dur : 120
  const into = Math.max(0, Math.min(1, 1 - (Number.isFinite(t) ? t : d) / d))
  if (half === 3) return Math.min(120, 90 + Math.max(1, Math.round(into * 30))) // extra time
  return Math.max(1, Math.min(90, Math.round(((half === 2 ? 1 : 0) + into) * 45)))
}

/**
 * Build the report. `teamConfig` is the match's team1/team2 kits, `score`
 * the final { team1, team2 } (plus pens when a shootout decided it).
 * Returns [{ min (number or null), kind, text }].
 */
export function buildStory({ goalLog = [], matchEvents = [], teamConfig, score, matchDuration = 120, seed = 'match', venue = 'table', pens = null, extraTime = false }) {
  const out = [{ min: 1, kind: 'kickoff', text: line('kickoff', { teamConfig, team: 'team1', venue, seed }) }]
  const running = { team1: 0, team2: 0 }
  const goals = goalLog.filter((g) => !g.shootout)
  goals.forEach((g, i) => {
    running[g.team] += 1
    const min = footballMinute(g.half, g.t, matchDuration)
    const last = i === goals.length - 1
    const winner = last && running.team1 !== running.team2 && Math.abs(running.team1 - running.team2) === 1 && min >= 80
    const { line: text } = goalLine({ teamConfig, scorerTeam: g.team, cap: g.cap, own: g.own, score: { ...running }, goalLog: goals.slice(0, i + 1), late: min >= 80, winner, seed: `${seed}:${i}` })
    out.push({ min, kind: 'goal', team: g.team, text })
  })
  // A few of the chances that didn't go in
  const chances = matchEvents.filter((e) => ['save', 'post', 'block', 'wide'].includes(e.type)).slice(0, 3)
  chances.forEach((e, i) => {
    const team = String(e.cap || '').startsWith('team2') ? 'team2' : 'team1'
    out.push({ min: null, kind: e.type, team, text: line(e.type, { teamConfig, team, cap: e.cap, by: e.by, seed: `${seed}:c${i}` }) })
  })
  const winnerTeam = score.team1 > score.team2 ? 'team1' : score.team2 > score.team1 ? 'team2' : null
  out.push({ min: extraTime ? 120 : 90, kind: 'fulltime', text: line(winnerTeam ? 'fullTimeWin' : 'fullTimeDraw', { teamConfig, winner: winnerTeam, score, seed }) })
  if (pens && pens.team1 !== pens.team2) {
    out.push({ min: null, kind: 'pens', text: line('shootoutOver', { teamConfig, winner: pens.team1 > pens.team2 ? 'team1' : 'team2', seed }) })
  }
  return out.map((x) => ({ ...x, text: clean(x.text) }))
}

/** Clean a saved story. */
export function sanitizeStory(input) {
  if (!Array.isArray(input)) return []
  return input.filter((x) => x && typeof x.text === 'string').slice(0, 40).map((x) => ({
    min: Number.isInteger(x.min) && x.min >= 1 && x.min <= 120 ? x.min : null,
    kind: typeof x.kind === 'string' ? x.kind.slice(0, 12) : 'note',
    ...(x.team === 'team1' || x.team === 'team2' ? { team: x.team } : {}),
    text: clean(x.text),
  }))
}
