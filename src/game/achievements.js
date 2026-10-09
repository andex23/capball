/**
 * Achievements: badges for things worth bragging about. Pure checks over a
 * finished match (or a season / tournament / daily streak) — the store decides
 * what's new and keeps them.
 */
export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Off the Mark', desc: 'Win a match', icon: 'ball' },
  { id: 'clean_sheet', name: 'Shut Out', desc: 'Win without conceding', icon: 'lock' },
  { id: 'hat_trick', name: 'Hat-trick Hero', desc: 'One of your players scores three in a match', icon: 'trophy' },
  { id: 'thrashing', name: 'Demolition', desc: 'Win by four goals or more', icon: 'ball' },
  { id: 'comeback', name: 'Never Say Die', desc: 'Win after going two goals down', icon: 'restart' },
  { id: 'late_winner', name: 'Last Gasp', desc: 'Score the winner in the last 20 seconds', icon: 'ball' },
  { id: 'shootout', name: 'Ice Cold', desc: 'Win a penalty shootout', icon: 'check' },
  { id: 'wall', name: 'The Wall', desc: 'Your keeper makes three saves in one match', icon: 'lock' },
  { id: 'woodwork', name: 'Woodwork', desc: 'Hit the post twice in one match', icon: 'ball' },
  { id: 'hard_win', name: 'Giant Killer', desc: 'Beat the computer on Hard', icon: 'cpu' },
  { id: 'online_win', name: 'Table Champ', desc: 'Win an online match', icon: 'globe' },
  { id: 'streak3', name: 'On Fire', desc: 'Win three matches in a row', icon: 'trophy' },
  { id: 'globetrotter', name: 'Globetrotter', desc: 'Play on all seven tables', icon: 'globe' },
  { id: 'goals100', name: 'Centurion', desc: 'Score 100 goals', icon: 'ball' },
  { id: 'cup', name: 'Silverware', desc: 'Win a cup', icon: 'trophy' },
  { id: 'league', name: 'League Winners', desc: 'Win a league', icon: 'trophy' },
  { id: 'promoted', name: 'Going Up', desc: 'Win promotion in career mode', icon: 'next' },
  { id: 'premier', name: 'Top of the Pyramid', desc: 'Win the Premier Cap League', icon: 'trophy' },
  { id: 'daily7', name: 'Seven Days', desc: 'Beat the daily challenge seven days running', icon: 'check' },
]
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id)

/**
 * Badges earned by one finished match.
 * ctx: { me, result: { score, penaltyScore }, goalLog, matchEvents, stats, gameMode, aiDifficulty,
 *        goalTarget, streak (wins in a row incl. this one), tables (venues played), goalsTotal }
 */
export function matchAchievements(ctx) {
  const { me, result, goalLog = [], matchEvents = [], stats = {}, gameMode, aiDifficulty, goalTarget, streak = 0, tables = [], goalsTotal = 0 } = ctx
  const out = []
  if (!me || !result?.score) return out
  const them = me === 'team1' ? 'team2' : 'team1'
  const gf = result.score[me] ?? 0
  const ga = result.score[them] ?? 0
  const pens = result.penaltyScore
  const won = gf > ga || (gf === ga && !!pens && pens[me] > pens[them])
  if (won) out.push('first_win')
  if (won && ga === 0) out.push('clean_sheet')
  if (gf - ga >= 4) out.push('thrashing')
  if (won && pens && gf === ga) out.push('shootout')
  // Goals in order, from our side
  const regular = goalLog.filter((g) => !g.shootout)
  let diff = 0
  let lowest = 0
  let winnerGoal = null
  for (const g of regular) {
    const before = diff
    diff += g.team === me ? 1 : -1
    lowest = Math.min(lowest, diff)
    if (g.team === me && before <= 0 && diff > 0) winnerGoal = g
    if (g.team !== me && diff <= 0) winnerGoal = null
  }
  if (won && lowest <= -2) out.push('comeback')
  if (won && gf > ga && winnerGoal && (goalTarget || (winnerGoal.half === 2 && winnerGoal.t <= 20))) out.push('late_winner')
  const byCap = {}
  for (const g of regular) if (g.team === me && !g.own && g.cap?.startsWith(me)) byCap[g.cap] = (byCap[g.cap] || 0) + 1
  if (Object.values(byCap).some((n) => n >= 3)) out.push('hat_trick')
  if ((stats[me]?.saves || 0) >= 3) out.push('wall')
  if (matchEvents.filter((e) => e.type === 'post' && e.cap?.startsWith(me)).length >= 2) out.push('woodwork')
  if (won && gameMode === 'ai' && aiDifficulty === 'hard') out.push('hard_win')
  if (won && gameMode === 'online') out.push('online_win')
  if (streak >= 3) out.push('streak3')
  if (tables.length >= 7) out.push('globetrotter')
  if (goalsTotal >= 100) out.push('goals100')
  return out
}
