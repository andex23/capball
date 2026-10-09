/**
 * Match commentary: a short line for each moment, picked to fit the
 * situation (an opener, an equaliser, a late winner, a hat-trick...). Lines
 * are chosen from a seed, so the same moment always reads the same line.
 *
 * Pure: everything comes in through `ctx`.
 */
import { playerNames, CAP_ROLES } from '../data/TeamOptions'

export function hash(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
const pick = (list, seed) => list[hash(seed) % list.length]
const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

/** "#9 Okafor" for a cap id like "team1_atk1", from the team's kit. */
export function playerOf(teamConfig, capId) {
  if (!capId || typeof capId !== 'string') return null
  const i = capId.indexOf('_')
  const team = capId.slice(0, i)
  const role = capId.slice(i + 1)
  const kit = teamConfig?.[team]
  if (!kit || !CAP_ROLES.includes(role)) return null
  const number = Number.isInteger(kit.numbers?.[role]) ? kit.numbers[role] : null
  const name = playerNames(kit)[role]
  return { team, role, number, name, label: number != null ? `#${number} ${name}` : name }
}

const GOAL = {
  opener: [
    '{p} breaks the deadlock!',
    '{p} opens the scoring for {team}!',
    'First blood to {team} — {p} with the finish!',
    '{p} gets {team} off the mark!',
  ],
  equaliser: [
    'All square! {p} levels it at {score}.',
    '{p} drags {team} level!',
    'Game on — {p} with the equaliser!',
    '{p} answers straight back. {score}!',
  ],
  ahead: [
    '{p} puts {team} in front!',
    '{team} lead! {p} with the strike.',
    '{p} turns it around for {team}!',
  ],
  extend: [
    '{p} makes it {score}. {team} are rolling!',
    'Another one! {p} adds to the lead.',
    '{p} punishes them again — {score}!',
    '{team} are running away with it. {p}!',
  ],
  pullBack: [
    '{p} pulls one back for {team}!',
    'Is this a comeback? {p} makes it {score}.',
    '{p} gives {team} a lifeline!',
  ],
  brace: [
    'That’s two for {p}!',
    '{p} again! A brace for the {num}.',
  ],
  hattrick: [
    'HAT-TRICK! {p} takes the match ball home!',
    'Three for {p}! What a performance!',
  ],
  late: [
    'Late drama! {p} strikes with time running out!',
    'Right at the death — {p}!',
    '{p} with a goal in the dying seconds!',
  ],
  winner: [
    '{p} wins it for {team}!',
    'That’s the winner! {p} seals it.',
  ],
  penalty: [
    '{p} sends the keeper the wrong way!',
    'Cool as you like from {p}.',
    '{p} buries the penalty!',
    'No mistake from {p} from the spot.',
  ],
  own: [
    'Oh dear! {p} turns it into their own net.',
    'Disaster for {other} — {p} puts through their own goal!',
    '{p} won’t want to see that again. Own goal!',
  ],
}

/** The line for a goal. */
export function goalLine(ctx) {
  const { teamConfig, scorerTeam, cap, own, shootout, score, goalLog = [], late, winner, seed } = ctx
  const p = playerOf(teamConfig, cap)
  const other = scorerTeam === 'team1' ? 'team2' : 'team1'
  const vars = {
    p: p?.label || teamConfig?.[own ? other : scorerTeam]?.name || 'They',
    team: teamConfig?.[scorerTeam]?.name || '',
    other: teamConfig?.[other]?.name || '',
    num: p?.number != null ? `number ${p.number}` : 'striker',
    score: score ? `${Math.max(score.team1, score.team2)}–${Math.min(score.team1, score.team2)}` : '',
  }
  let kind
  if (shootout) kind = 'penalty'
  else if (own) kind = 'own'
  else {
    const mine = cap ? goalLog.filter((g) => g.cap === cap && !g.own && !g.shootout).length : 0
    const total = score ? score.team1 + score.team2 : 0
    const us = score?.[scorerTeam] ?? 0
    const them = score?.[other] ?? 0
    if (mine === 3) kind = 'hattrick'
    else if (winner) kind = 'winner'
    else if (late) kind = 'late'
    else if (mine === 2) kind = 'brace'
    else if (total === 1) kind = 'opener'
    else if (us === them) kind = 'equaliser'
    else if (us === them + 1) kind = 'ahead'
    else if (us > them) kind = 'extend'
    else kind = 'pullBack'
    if (kind === 'equaliser') vars.score = `${us}–${them}`
  }
  return { kind, line: fill(pick(GOAL[kind], `${seed}:${kind}`), vars), player: p }
}

const LINES = {
  kickoff: ['We’re under way at the {venue}!', 'And we’re off! {team} get us started.', 'The whistle goes — {team} kick off.'],
  secondHalf: ['The second half is under way.', 'Back out for the second half — {team} restart.', 'Here we go again. {team} get the second half going.'],
  restartAfterGoal: ['{team} restart. Can they hit back?', 'Back to the centre — {team} to go again.'],
  foul: ['{p} clips an opponent — free kick to {team}.', 'That’s a foul by {p}. {team} have a free kick.', 'The referee spots it. Free kick to {team}.'],
  foulBox: ['{p} brings them down in the box! Penalty to {team}!', 'PENALTY! {p} gives it away — huge chance for {team}.'],
  freeKick: ['{team} line it up. The wall is set.', 'Free kick in a dangerous spot for {team}…', 'Can {team} find a way round the wall?'],
  corner: ['{team} win a corner.', 'Corner to {team} — swing it in!', 'Pressure building. Corner kick for {team}.'],
  goalKick: ['Goal kick to {team}.', '{team} restart from the back.', 'It’s gone out — {team} take the goal kick.'],
  bank: ['In off the wall — that doesn’t count! Goal kick to {team}.', 'Off the cushion and in… but no goal. {team} restart.'],
  penalty: ['{team} step up. Who’s taking it?', 'The crowd holds its breath. Penalty to {team}.'],
  shootout: ['It’s going to penalties!', 'Nothing in it — penalties to decide!'],
  nextKick: ['{team} to shoot.', 'Next up: {team}.', 'Pressure on {team} now.'],
  saved: ['Saved! The keeper guessed right!', 'What a stop! {p} is denied.', 'Kept out! Big moment for {other}.'],
  penTimeUp: ['Too slow — the chance is gone!', 'Time’s up before the shot. Missed!'],
  timeout: ['Too slow! Over to {other}.', 'The shot clock runs out — {other}’s ball.'],
  fullTimeWin: ['It’s all over! {winner} win {score}.', 'Full time — {winner} take it {score}.', 'That’s it! {winner} come out on top, {score}.'],
  fullTimeDraw: ['Full time. Honours even at {score}.', 'All square at the final whistle — {score}.', 'Nothing to separate them. {score}.'],
  shootoutOver: ['{winner} win it on penalties!', 'The shootout goes to {winner}!'],
}

/** A line for any other moment. `kind` is a key of LINES. */
export function line(kind, ctx = {}) {
  const list = LINES[kind]
  if (!list) return ''
  const { teamConfig, team, cap, venue, score, winner, seed } = ctx
  const other = team === 'team1' ? 'team2' : 'team1'
  const p = playerOf(teamConfig, cap)
  const vars = {
    team: teamConfig?.[team]?.name || '',
    other: teamConfig?.[other]?.name || '',
    p: p?.label || 'They',
    venue: venue || 'table',
    winner: winner ? teamConfig?.[winner]?.name || '' : '',
    score: score ? `${Math.max(score.team1, score.team2)}–${Math.min(score.team1, score.team2)}` : '',
  }
  return fill(pick(list, `${seed}:${kind}`), vars)
}
