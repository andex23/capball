import { create } from 'zustand'
import { otherTeam, shootoutStatus, nextShooter, matchWinner } from '../game/rules'

// App screens
export const SCREEN = {
  SPLASH: 'SPLASH',
  MENU: 'MENU',
  ONLINE: 'ONLINE',
  TEAM_SELECT: 'TEAM_SELECT',
  STADIUM_SELECT: 'STADIUM_SELECT',
  FORMATION: 'FORMATION',
  PLAYING: 'PLAYING',
  MATCH_END: 'MATCH_END',
  TOURNAMENT_HOME: 'TOURNAMENT_HOME',
  TOURNAMENT_SETUP: 'TOURNAMENT_SETUP',
  TOURNAMENT_HUB: 'TOURNAMENT_HUB',
  CAREER: 'CAREER',
}

// Turn phases
export const PHASE = {
  SELECT: 'SELECT',
  AIM: 'AIM',
  RESOLVE: 'RESOLVE',
  GOAL: 'GOAL',
  NO_GOAL: 'NO_GOAL',
  MISSED: 'MISSED',
  KICKOFF: 'KICKOFF',
  FOUL: 'FOUL',
  FREE_KICK_SETUP: 'FREE_KICK_SETUP',
  CORNER_SETUP: 'CORNER_SETUP',
  GOAL_KICK_SETUP: 'GOAL_KICK_SETUP',
  PENALTY_SETUP: 'PENALTY_SETUP',
  KEEPER_PICK: 'KEEPER_PICK',
  CHALLENGE_DONE: 'CHALLENGE_DONE', // the daily challenge is won or lost // before a penalty: the keeper's side secretly picks a dive
  TIMEOUT: 'TIMEOUT',
  MATCH_OVER: 'MATCH_OVER',
}

/** Phases where a player may pick up and flick a cap. */
export const INPUT_PHASES = [PHASE.SELECT, PHASE.AIM]
/** Phases where the match clock runs. */
export const CLOCK_PHASES = [PHASE.SELECT, PHASE.AIM, PHASE.RESOLVE]

// Match duration options (seconds, whole match)
export const MATCH_DURATIONS = [60, 90, 120, 150, 180] // up to 3 minutes: longer games drag
// Or no clock: the first side to this many goals wins
export const GOAL_TARGETS = [3, 5]
// Shot clock options (seconds per turn, 0 = off)
export const SHOT_CLOCKS = [0, 10, 15, 20]

// How long each overlay stays up before play continues (ms)
export const TIMING = {
  kickoff: 2000,
  goal: 8000, // banner + slow-motion replay (see game/replay.js)
  foul: 1200,
  setPiece: 1500,
  noGoal: 8000,
  shootoutResult: 1500,
  fullTime: 1500,
  timeUp: 1200,
}

/* ── Match timers ──
   Every delayed transition goes through later() so leaving or restarting a
   match can cancel them all. Without this, a timer from an abandoned match
   could fire into the next one. */
const pendingTimers = new Set()
let goalTimer = null
let noGoalTimer = null

export function later(fn, ms) {
  const id = setTimeout(() => {
    pendingTimers.delete(id)
    fn()
  }, ms)
  pendingTimers.add(id)
  return id
}

/** Cancel one timer from later() before it fires. */
export function cancelLater(id) {
  clearTimeout(id)
  pendingTimers.delete(id)
}

export function clearMatchTimers() {
  pendingTimers.forEach(clearTimeout)
  pendingTimers.clear()
}

const emptyStats = () => ({
  team1: { goals: 0, shots: 0, fouls: 0, turns: 0, onTarget: 0, saves: 0 },
  team2: { goals: 0, shots: 0, fouls: 0, turns: 0, onTarget: 0, saves: 0 },
})

const clearTurn = {
  selectedCapId: null,
  lastFlickedCapId: null,
  shotCalled: false,
  firstCollisionTracked: false,
  freeKickCapId: null,
  foulData: null,
  dragPower: 0,
  penaltyKick: false,
  keeperDive: null,
}

/** Dive directions for a penalty, in pitch y: -1, 0 (stay) or +1. 'auto' = the computer decides as the ball is struck. */
export const KEEPER_DIVES = [-1, 0, 1]

// The daily challenge's defenders: plain grey caps
const CHALLENGE_DEFENDERS = { name: 'Defenders', primary: '#78909C', edge: '#ECEFF1', badge: 'none', numbers: { gk: 1, def1: 2, def2: 3, mid: 4, atk1: 5, atk2: 6 }, pattern: 'none', finish: 'satin', capText: '', textColor: '', skirtColor: '' }

export const DEFAULT_TEAM_CONFIG = {
  team1: { name: 'Team 1', primary: '#D32F2F', edge: '#FFD700', badge: 'none', numbers: { gk: 1, def1: 4, def2: 5, mid: 8, atk1: 10, atk2: 9 }, pattern: 'none', finish: 'matte', capText: '', textColor: '', skirtColor: '' },
  team2: { name: 'Team 2', primary: '#1565C0', edge: '#FFFFFF', badge: 'none', numbers: { gk: 1, def1: 3, def2: 6, mid: 8, atk1: 7, atk2: 11 }, pattern: 'none', finish: 'matte', capText: '', textColor: '', skirtColor: '' },
}

/** Does this client run physics and rules? Everyone except an online guest. */
export function isAuthority(state) {
  return state.gameMode !== 'online' || state.onlineMyTeam === 'team1'
}

export const useMatchStore = create((set, get) => ({
  // --- App navigation ---
  screen: SCREEN.SPLASH,
  goToScreen: (screen) => set({ screen }),

  // --- Game mode ---
  gameMode: 'local', // 'local', 'ai', or 'online'
  aiTeam: 'team2',
  aiDifficulty: 'medium', // 'easy', 'medium', 'hard'
  setGameMode: (mode) => set({ gameMode: mode }),
  setAiDifficulty: (d) => set({ aiDifficulty: d }),

  // --- Online (local-only, never synced) ---
  onlineMyTeam: null, // 'team1' (host) or 'team2' (guest)
  onlineStatus: { status: 'idle', msg: '' },
  onlineReady: { team1: false, team2: false },
  onlineReconnect: null, // { phase: 'lost' | 'restored', deadline, attempts } while a dropped link is recovered
  setOnlineReady: (team, ready) => set((s) => ({ onlineReady: { ...s.onlineReady, [team]: ready } })),
  resetOnlineReady: () => set({ onlineReady: { team1: false, team2: false } }),

  // --- Team customization ---
  teamConfig: DEFAULT_TEAM_CONFIG,
  setTeamConfig: (team, config) => set((s) => ({
    teamConfig: { ...s.teamConfig, [team]: { ...s.teamConfig[team], ...config } },
  })),

  ballColor: '#EFE6D2', // a white carrom coin
  setBallColor: (color) => set({ ballColor: color }),

  stadium: 'arena',
  setStadium: (id) => set({ stadium: id }),
  // 'table': lines chalked on the table itself (default) · 'grass': a green pitch
  pitchStyle: 'table',
  setPitchStyle: (v) => set({ pitchStyle: v === 'grass' ? 'grass' : 'table' }),

  // Side team1 starts on (chosen in setup) vs. the side it's on right now
  // (flips at half time).
  chosenTeam1Side: 'left',
  team1Side: 'left',
  setTeam1Side: (side) => set({ chosenTeam1Side: side, team1Side: side }),

  formations: { team1: 'default', team2: 'default' },
  setFormation: (team, formation) => set((s) => ({ formations: { ...s.formations, [team]: formation } })),

  // --- Match clock ---
  matchDuration: 180, // whole match, split into two halves
  timeRemaining: 90,
  timerRunning: false,
  paused: false,
  half: 1,
  firstHalfKicker: 'team1',
  setMatchDuration: (d) => set({ matchDuration: d }),
  // 0 = timed match; 3 or 5 = first to that many goals, no clock
  goalTarget: 0,
  setGoalTarget: (n) => set({ goalTarget: GOAL_TARGETS.includes(n) ? n : 0 }),

  // --- Shot clock (per turn; only runs while the active team can act) ---
  shotClock: 15,
  shotClockRemaining: 15,
  setShotClock: (secs) => set({ shotClock: secs, shotClockRemaining: secs }),

  tickShotClock: (dt) => {
    const { shotClock, shotClockRemaining, paused, phase, tutorialHold, challenge } = get()
    if (!shotClock || challenge || paused || tutorialHold || !INPUT_PHASES.includes(phase)) return
    const next = Math.max(0, shotClockRemaining - dt)
    set({ shotClockRemaining: next })
    if (next === 0) get().shotClockExpired()
  },

  /** Out of time: the cap goes down and the turn (or set piece, or penalty) is lost. */
  shotClockExpired: () => {
    if (get().penaltyShootout) {
      get().penaltyAttemptResult(false)
      return
    }
    set({ phase: PHASE.TIMEOUT, selectedCapId: null, dragPower: 0 })
    later(() => get().switchTurn(), TIMING.timeUp)
  },

  // First-match tutorial showing a coach mark — the clock waits for the player
  tutorialHold: false,
  setTutorialHold: (hold) => { if (get().tutorialHold !== hold) set({ tutorialHold: hold }) },

  tickTimer: (dt) => {
    const { timeRemaining, timerRunning, paused, tutorialHold, phase, half, goalTarget } = get()
    if (goalTarget) return // first-to-N matches have no clock
    if (!timerRunning || paused || tutorialHold || !CLOCK_PHASES.includes(phase)) return
    const next = Math.max(0, timeRemaining - dt)
    set({ timeRemaining: next })
    if (next > 0) return
    if (half === 1) get().startSecondHalf()
    else get().endMatch()
  },

  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),

  // Bumped on every new match/shootout so the 3D scene remounts cleanly.
  matchKey: 0,

  // --- Match flow ---
  startGame: () => {
    clearMatchTimers()
    const s = get()
    set({
      ...clearTurn,
      challenge: null,
      screen: SCREEN.PLAYING,
      matchKey: s.matchKey + 1,
      score: { team1: 0, team2: 0 },
      goalLog: [],
      matchEvents: [],
      lastGoalCap: null,
      replayDecision: null,
      pendingNoGoalRestart: null,
      stats: emptyStats(),
      team1Side: s.chosenTeam1Side,
      activeTeam: s.firstHalfKicker,
      phase: PHASE.KICKOFF,
      kickoffGuard: true,
      lastConceded: null,
      lastScorer: null,
      timeRemaining: Math.floor(s.matchDuration / 2),
      timerRunning: false,
      paused: false,
      half: 1,
      matchResult: null,
      penaltyShootout: false,
      penaltyKicks: { team1: 0, team2: 0 },
      penaltyScores: { team1: 0, team2: 0 },
    })
    later(() => get().beginPlay(), TIMING.kickoff)
  },

  /** KICKOFF overlay done — hand control to the kicking team. */
  beginPlay: () => {
    if (get().phase !== PHASE.KICKOFF) return
    if (get().penaltyShootout) { get().startPenaltyKick(); return }
    set({ phase: PHASE.SELECT, timerRunning: true, shotClockRemaining: get().shotClock })
  },

  /**
   * A penalty is about to be taken by activeTeam. The other side's keeper
   * picks a dive first, in secret; a computer keeper decides as the ball is struck.
   */
  startPenaltyKick: () => {
    const s = get()
    const keeperTeam = otherTeam(s.activeTeam)
    const cpuKeeper = s.gameMode === 'ai' && s.aiTeam === keeperTeam
    if (cpuKeeper) {
      set({ phase: PHASE.SELECT, penaltyKick: true, keeperDive: 'auto', timerRunning: !s.penaltyShootout, shotClockRemaining: s.shotClock })
    } else {
      set({ phase: PHASE.KEEPER_PICK, penaltyKick: true, keeperDive: null, timerRunning: false })
    }
  },

  /** The keeper's side has picked (-1, 0 or 1): the kicker may now shoot. */
  pickKeeperDive: (dive) => {
    const s = get()
    if (s.phase !== PHASE.KEEPER_PICK || !KEEPER_DIVES.includes(dive)) return
    set({ phase: PHASE.SELECT, keeperDive: dive, timerRunning: !s.penaltyShootout, shotClockRemaining: s.shotClock })
  },

  startSecondHalf: () => {
    clearMatchTimers()
    const { matchDuration, team1Side, firstHalfKicker } = get()
    set({
      ...clearTurn,
      team1Side: team1Side === 'left' ? 'right' : 'left',
      half: 2,
      timeRemaining: Math.floor(matchDuration / 2),
      timerRunning: false,
      phase: PHASE.KICKOFF,
      kickoffGuard: true,
      activeTeam: otherTeam(firstHalfKicker),
    })
    later(() => get().beginPlay(), TIMING.kickoff)
  },

  endMatch: () => {
    clearMatchTimers()
    const { score, teamConfig, stats } = get()
    const winner = matchWinner(score)
    set({
      ...clearTurn,
      phase: PHASE.MATCH_OVER,
      timerRunning: false,
      matchResult: {
        winner,
        isDraw: !winner,
        score: { ...score },
        stats,
        team1Name: teamConfig.team1.name,
        team2Name: teamConfig.team2.name,
      },
    })
    later(() => set({ screen: SCREEN.MATCH_END }), TIMING.fullTime)
  },

  /** Leave the match (menu / disconnect). Cancels anything still scheduled. */
  quitMatch: (screen = SCREEN.MENU) => {
    if (get().challenge) { get().leaveChallenge(screen); return }
    clearMatchTimers()
    set({ ...clearTurn, screen, timerRunning: false, paused: false, penaltyShootout: false, challenge: null })
  },

  lastGoalOwn: false,
  lastGoalCap: null, // the cap that scored the last goal (its flick put the ball in)
  goalLog: [],       // this match's goals: { team, cap, own, shootout }
  matchEvents: [],   // shots that nearly went in: { type: 'post'|'wide'|'save'|'block', cap, by }
  shotCall: null,    // the latest near-miss call for the HUD: { type, cap, by, key }
  matchResult: null,
  score: { team1: 0, team2: 0 },
  lastScorer: null,
  stats: emptyStats(),

  bumpStat: (team, key) => set((s) => ({
    stats: { ...s.stats, [team]: { ...s.stats[team], [key]: (s.stats[team][key] || 0) + 1 } },
  })),

  /**
   * A shot nearly went in: off the post, just wide, saved or blocked. Once per
   * flick. `cap` is the shooter, `by` the cap that kept it out.
   */
  callShot: (type, cap, by = null) => {
    const s = get()
    if (s.shotCalled || s.challenge || s.penaltyShootout) return
    const team = cap?.split('_')[0]
    const other = team === 'team1' ? 'team2' : 'team1'
    set({
      shotCalled: true,
      matchEvents: [...(s.matchEvents || []), { type, cap, by }],
      shotCall: { type, cap, by, key: (s.shotCall?.key || 0) + 1 },
    })
    if (team && (type === 'save' || type === 'post' || type === 'block')) get().bumpStat(team, 'onTarget')
    if (type === 'save' && other) get().bumpStat(other, 'saves')
  },

  // --- Turn state ---
  activeTeam: 'team1',
  phase: PHASE.SELECT,
  selectedCapId: null,
  lastConceded: null,
  lastFlickedCapId: null,
  firstCollisionTracked: false,
  // True for the flick straight from a kick-off, which may not score.
  kickoffGuard: false,
  // Only this cap may take the current free kick / penalty.
  freeKickCapId: null,
  foulData: null, // { foulSpot: {x, y}, fouledTeam, inPenaltyBox }

  setFirstCollisionTracked: (v) => set({ firstCollisionTracked: v }),

  dragPower: 0,
  setDragPower: (power) => { if (get().dragPower !== power) set({ dragPower: power }) },

  selectCap: (capId) => set({ selectedCapId: capId, phase: PHASE.AIM }),
  // Only while aiming: a late release after the turn has moved on must not rewind it
  cancelAim: () => { if (get().phase === PHASE.AIM) set({ selectedCapId: null, phase: PHASE.SELECT, dragPower: 0 }) },

  /** A flick has been applied to the physics world — watch it play out. */
  commitFlick: (capId) => set({
    selectedCapId: capId,
    lastFlickedCapId: capId,
    phase: PHASE.RESOLVE,
    firstCollisionTracked: false,
    freeKickCapId: null,
    foulData: null,
    dragPower: 0,
  }),

  // --- Daily challenge: your caps only, score within so many flicks ---
  challenge: null, // { id, name, text, flicks, flicksLeft, won }
  startChallenge: (c) => {
    clearMatchTimers()
    set({
      ...clearTurn,
      challenge: { id: c.id, name: c.name, text: c.text, flicks: c.flicks, flicksLeft: c.flicks, won: null, prevTeam2: get().challenge?.prevTeam2 || get().teamConfig.team2 },
      teamConfig: { ...get().teamConfig, team2: CHALLENGE_DEFENDERS },
      screen: SCREEN.PLAYING,
      matchKey: get().matchKey + 1,
      gameMode: 'local',
      penaltyShootout: false,
      score: { team1: 0, team2: 0 },
      goalLog: [],
      matchEvents: [],
      lastGoalCap: null,
      stats: emptyStats(),
      team1Side: 'left',
      activeTeam: 'team1',
      phase: PHASE.SELECT,
      kickoffGuard: false,
      timerRunning: false,
      paused: false,
      matchResult: null,
      shotClockRemaining: 0,
    })
  },
  /** One flick of the challenge used up without a goal. */
  challengeFlickUsed: () => {
    const c = get().challenge
    if (!c) return
    const left = c.flicksLeft - 1
    if (left <= 0) { get().endChallenge(false); return }
    set({ ...clearTurn, challenge: { ...c, flicksLeft: left }, activeTeam: 'team1', phase: PHASE.SELECT, kickoffGuard: false })
  },
  endChallenge: (won) => {
    const c = get().challenge
    if (!c || c.won !== null) return
    set({ ...clearTurn, challenge: { ...c, won }, phase: PHASE.CHALLENGE_DONE, timerRunning: false })
  },
  leaveChallenge: (screen = SCREEN.MENU) => {
    clearMatchTimers()
    const c = get().challenge
    set({ ...clearTurn, challenge: null, screen, timerRunning: false, paused: false, ...(c?.prevTeam2 ? { teamConfig: { ...get().teamConfig, team2: c.prevTeam2 } } : {}) })
  },

  switchTurn: () => {
    if (get().challenge) { get().challengeFlickUsed(); return }
    const { activeTeam } = get()
    get().bumpStat(activeTeam, 'turns')
    set({ ...clearTurn, activeTeam: otherTeam(activeTeam), phase: PHASE.SELECT, kickoffGuard: false, shotClockRemaining: get().shotClock })
  },

  // ownGoal: the last cap to touch the ball was the conceding side's
  scoreGoal: (scoringTeam, { ownGoal = false, decision = null } = {}) => {
    const { score } = get()
    const replayDecision = decision || { outcome: 'goal' }
    if (get().challenge) {
      // Celebrate, then the challenge is done (into your own net is a fail)
      set({ ...clearTurn, score: { ...score, [scoringTeam]: score[scoringTeam] + 1 }, phase: PHASE.GOAL, replayDecision, lastScorer: scoringTeam, lastGoalOwn: !!ownGoal, lastConceded: otherTeam(scoringTeam) })
      goalTimer = later(() => get().endChallenge(scoringTeam === 'team1'), TIMING.goal)
      return
    }
    const concedingTeam = otherTeam(scoringTeam)
    get().bumpStat(scoringTeam, 'goals')
    const cap = get().lastFlickedCapId
    set({
      ...clearTurn,
      score: { ...score, [scoringTeam]: score[scoringTeam] + 1 },
      phase: PHASE.GOAL,
      replayDecision,
      lastScorer: scoringTeam,
      lastGoalOwn: !!ownGoal,
      lastGoalCap: cap,
      goalLog: [...(get().goalLog || []), { team: scoringTeam, cap, own: !!ownGoal, shootout: !!get().penaltyShootout, half: get().half, t: Math.round(get().timeRemaining) }],
      lastConceded: concedingTeam,
    })
    // First to N: that goal wins it
    const { goalTarget } = get()
    if (goalTarget && score[scoringTeam] + 1 >= goalTarget && !get().penaltyShootout) {
      goalTimer = later(() => get().endMatch(), TIMING.goal)
      return
    }
    goalTimer = later(() => get().startKickoff(concedingTeam), TIMING.goal)
  },

  /** Cut the goal replay short and go straight to the kick-off. Offline only:
      online, each side skips just its own view and the host's clock rules. */
  skipGoal: () => {
    const s = get()
    if (s.phase !== PHASE.GOAL || s.penaltyShootout || s.gameMode === 'online') return
    cancelLater(goalTimer)
    if (s.challenge) { s.endChallenge(s.lastScorer === 'team1'); return }
    if (s.goalTarget && s.score[s.lastScorer] >= s.goalTarget) { s.endMatch(); return }
    s.startKickoff(s.lastConceded)
  },

  // True while this client is showing a goal replay (local only, never synced)
  replayDecision: null,
  replaying: false,
  setReplaying: (v) => { if (get().replaying !== v) set({ replaying: v }) },

  /** Preserve the shot while the decision replay plays, then restart. */
  disallowGoal: (reason, { restart = null, evidence = {} } = {}) => {
    set({ ...clearTurn, phase: PHASE.NO_GOAL, noGoalReason: reason,
      replayDecision: { outcome: 'no_goal', reason, evidence }, pendingNoGoalRestart: restart })
    noGoalTimer = later(() => get().resumeNoGoal(), TIMING.noGoal)
  },
  pendingNoGoalRestart: null,
  resumeNoGoal: () => {
    if (get().phase !== PHASE.NO_GOAL || get().penaltyShootout) return
    const restart = get().pendingNoGoalRestart
    set({ pendingNoGoalRestart: null })
    if (get().challenge) { get().challengeFlickUsed(); return }
    if (restart) get().awardRestart(restart)
    else get().switchTurn()
  },
  skipNoGoal: () => {
    const s = get()
    if (s.phase !== PHASE.NO_GOAL || s.penaltyShootout || s.gameMode === 'online') return
    cancelLater(noGoalTimer)
    s.resumeNoGoal()
  },
  noGoalReason: null,

  startKickoff: (team) => {
    set({ ...clearTurn, phase: PHASE.KICKOFF, activeTeam: team, kickoffGuard: true })
    later(() => get().beginPlay(), TIMING.kickoff)
  },

  // --- Corner kicks / goal kicks (ball stuck in a corner) ---
  restart: null, // { kind: 'corner' | 'goalKick', team, ex, ey }
  awardRestart: ({ kind, team, ex, ey, reason = null }) => {
    if (get().challenge) { get().challengeFlickUsed(); return }
    const { activeTeam } = get()
    get().bumpStat(activeTeam, 'turns')
    set({
      ...clearTurn,
      phase: kind === 'corner' ? PHASE.CORNER_SETUP : PHASE.GOAL_KICK_SETUP,
      activeTeam: team,
      restart: { kind, team, ex, ey, reason },
      kickoffGuard: false,
    })
    // The scene lays the caps out as soon as the setup phase starts
    later(() => {
      const s = get()
      if (s.phase === PHASE.CORNER_SETUP || s.phase === PHASE.GOAL_KICK_SETUP) {
        set({ phase: PHASE.SELECT, selectedCapId: null, shotClockRemaining: s.shotClock })
      }
    }, TIMING.setPiece)
  },

  // --- Fouls ---
  callFoul: (foulSpot, fouledTeam, inPenaltyBox) => {
    if (get().challenge) { get().challengeFlickUsed(); return }
    const { activeTeam } = get()
    get().bumpStat(activeTeam, 'fouls')
    set({
      ...clearTurn,
      phase: PHASE.FOUL,
      foulData: { foulSpot, fouledTeam, inPenaltyBox, byCap: get().lastFlickedCapId },
      kickoffGuard: false,
    })
    later(() => {
      set({ phase: inPenaltyBox ? PHASE.PENALTY_SETUP : PHASE.FREE_KICK_SETUP, activeTeam: fouledTeam })
      // The scene places the caps as soon as the setup phase starts.
      later(() => {
        const s = get()
        if (s.phase === PHASE.PENALTY_SETUP) {
          set({ selectedCapId: null })
          get().startPenaltyKick()
        } else if (s.phase === PHASE.FREE_KICK_SETUP) {
          set({ phase: PHASE.SELECT, selectedCapId: null, shotClockRemaining: s.shotClock })
        }
      }, TIMING.setPiece)
    }, TIMING.foul)
  },

  // --- Penalty shootout ---
  penaltyShootout: false,
  penaltyKicks: { team1: 0, team2: 0 },
  penaltyScores: { team1: 0, team2: 0 },

  startPenaltyShootout: () => {
    clearMatchTimers()
    set({
      ...clearTurn,
      screen: SCREEN.PLAYING,
      matchKey: get().matchKey + 1,
      challenge: null,
      penaltyShootout: true,
      penaltyKicks: { team1: 0, team2: 0 },
      penaltyScores: { team1: 0, team2: 0 },
      phase: PHASE.KICKOFF,
      activeTeam: 'team1',
      kickoffGuard: false,
      timerRunning: false,
      paused: false,
      matchResult: null,
    })
    later(() => get().beginPlay(), TIMING.kickoff)
  },

  /** A shootout kick has finished — show the result, then move on. */
  penaltyAttemptResult: (scored, decision = null) => {
    const { activeTeam, penaltyKicks, penaltyScores } = get()
    const kicks = { ...penaltyKicks, [activeTeam]: penaltyKicks[activeTeam] + 1 }
    const goals = { ...penaltyScores, [activeTeam]: penaltyScores[activeTeam] + (scored ? 1 : 0) }
    const kicker = get().lastFlickedCapId
    set({
      ...clearTurn,
      penaltyKicks: kicks,
      penaltyScores: goals,
      phase: scored ? PHASE.GOAL : decision ? PHASE.NO_GOAL : PHASE.MISSED,
      replayDecision: decision || (scored ? { outcome: 'goal' } : null),
      noGoalReason: decision?.reason || null,
      lastScorer: scored ? activeTeam : null,
      lastGoalOwn: false,
      lastGoalCap: kicker,
      lastKicker: kicker,
    })
    later(() => {
      const status = shootoutStatus(kicks, goals)
      if (status.decided) {
        const { teamConfig, score, stats } = get()
        set({
          phase: PHASE.MATCH_OVER,
          matchResult: {
            winner: status.winner,
            isDraw: false,
            score: { ...score },
            stats,
            penaltyScore: { ...goals },
            team1Name: teamConfig.team1.name,
            team2Name: teamConfig.team2.name,
          },
        })
        later(() => set({ screen: SCREEN.MATCH_END }), TIMING.fullTime)
        return
      }
      set({ phase: PHASE.KICKOFF, activeTeam: nextShooter(kicks) })
      later(() => get().beginPlay(), TIMING.kickoff)
    }, scored ? TIMING.goal : decision ? TIMING.noGoal : TIMING.shootoutResult)
  },

  // --- Audio settings ---
  masterVolume: 0.7,
  sfxVolume: 0.6,
  musicVolume: 0.35,
  muted: false,
  setMasterVolume: (v) => set({ masterVolume: v }),
  setSfxVolume: (v) => set({ sfxVolume: v }),
  setMusicVolume: (v) => set({ musicVolume: v }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  // Phone vibration on flicks, hard cushion hits, goals and fouls
  vibration: true,
  toggleVibration: () => set((s) => ({ vibration: !s.vibration })),
  // Two players on one device: turn the view round each turn so the player
  // whose turn it is sees the pitch from their own end
  turnView: true,
  toggleTurnView: () => set((s) => ({ turnView: !s.turnView })),
  // How a flick is aimed: false = drag back like a slingshot,
  // true = swipe the way you want the cap to go
  swipeAim: false,
  // Menu music: index into MUSIC_TRACKS (0 = off). See audio/MusicManager.js
  musicTrack: 1,
  setMusicTrack: (i) => set({ musicTrack: i }),
  toggleSwipeAim: () => set((s) => ({ swipeAim: !s.swipeAim })),
}))
