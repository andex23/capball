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
  PENALTY_SETUP: 'PENALTY_SETUP',
  TIMEOUT: 'TIMEOUT',
  MATCH_OVER: 'MATCH_OVER',
}

/** Phases where a player may pick up and flick a cap. */
export const INPUT_PHASES = [PHASE.SELECT, PHASE.AIM]
/** Phases where the match clock runs. */
export const CLOCK_PHASES = [PHASE.SELECT, PHASE.AIM, PHASE.RESOLVE]

// Match duration options (seconds, whole match)
export const MATCH_DURATIONS = [120, 180, 300]
// Shot clock options (seconds per turn, 0 = off)
export const SHOT_CLOCKS = [0, 10, 15, 20]

// How long each overlay stays up before play continues (ms)
export const TIMING = {
  kickoff: 2000,
  goal: 5000, // banner + slow-motion replay (see game/replay.js)
  foul: 1200,
  setPiece: 1500,
  noGoal: 1500,
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
  team1: { goals: 0, shots: 0, fouls: 0, turns: 0 },
  team2: { goals: 0, shots: 0, fouls: 0, turns: 0 },
})

const clearTurn = {
  selectedCapId: null,
  lastFlickedCapId: null,
  firstCollisionTracked: false,
  freeKickCapId: null,
  foulData: null,
  dragPower: 0,
}

export const DEFAULT_TEAM_CONFIG = {
  team1: { name: 'Team 1', primary: '#D32F2F', edge: '#FFD700', badge: 'none', numbers: { gk: 1, def1: 4, def2: 5, atk1: 10, atk2: 9 }, pattern: 'none', finish: 'matte' },
  team2: { name: 'Team 2', primary: '#1565C0', edge: '#FFFFFF', badge: 'none', numbers: { gk: 1, def1: 3, def2: 6, atk1: 7, atk2: 11 }, pattern: 'none', finish: 'matte' },
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

  ballColor: '#c0c0c0',
  setBallColor: (color) => set({ ballColor: color }),

  stadium: 'arena',
  setStadium: (id) => set({ stadium: id }),

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

  // --- Shot clock (per turn; only runs while the active team can act) ---
  shotClock: 15,
  shotClockRemaining: 15,
  setShotClock: (secs) => set({ shotClock: secs, shotClockRemaining: secs }),

  tickShotClock: (dt) => {
    const { shotClock, shotClockRemaining, paused, phase } = get()
    if (!shotClock || paused || !INPUT_PHASES.includes(phase)) return
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

  tickTimer: (dt) => {
    const { timeRemaining, timerRunning, paused, phase, half } = get()
    if (!timerRunning || paused || !CLOCK_PHASES.includes(phase)) return
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
      screen: SCREEN.PLAYING,
      matchKey: s.matchKey + 1,
      score: { team1: 0, team2: 0 },
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
    set({ phase: PHASE.SELECT, timerRunning: !get().penaltyShootout, shotClockRemaining: get().shotClock })
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
    clearMatchTimers()
    set({ ...clearTurn, screen, timerRunning: false, paused: false, penaltyShootout: false })
  },

  matchResult: null,
  score: { team1: 0, team2: 0 },
  lastScorer: null,
  stats: emptyStats(),

  bumpStat: (team, key) => set((s) => ({
    stats: { ...s.stats, [team]: { ...s.stats[team], [key]: s.stats[team][key] + 1 } },
  })),

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

  switchTurn: () => {
    const { activeTeam } = get()
    get().bumpStat(activeTeam, 'turns')
    set({ ...clearTurn, activeTeam: otherTeam(activeTeam), phase: PHASE.SELECT, kickoffGuard: false, shotClockRemaining: get().shotClock })
  },

  scoreGoal: (scoringTeam) => {
    const { score } = get()
    const concedingTeam = otherTeam(scoringTeam)
    get().bumpStat(scoringTeam, 'goals')
    set({
      ...clearTurn,
      score: { ...score, [scoringTeam]: score[scoringTeam] + 1 },
      phase: PHASE.GOAL,
      lastScorer: scoringTeam,
      lastConceded: concedingTeam,
    })
    goalTimer = later(() => get().startKickoff(concedingTeam), TIMING.goal)
  },

  /** Cut the goal replay short and go straight to the kick-off. Offline only:
      online, each side skips just its own view and the host's clock rules. */
  skipGoal: () => {
    const s = get()
    if (s.phase !== PHASE.GOAL || s.penaltyShootout || s.gameMode === 'online') return
    cancelLater(goalTimer)
    s.startKickoff(s.lastConceded)
  },

  // True while this client is showing a goal replay (local only, never synced)
  replaying: false,
  setReplaying: (v) => { if (get().replaying !== v) set({ replaying: v }) },

  /** A ball in the net that doesn't count. Possession passes over. */
  disallowGoal: (reason) => {
    set({ ...clearTurn, phase: PHASE.NO_GOAL, noGoalReason: reason })
    later(() => get().switchTurn(), TIMING.noGoal)
  },
  noGoalReason: null,

  startKickoff: (team) => {
    set({ ...clearTurn, phase: PHASE.KICKOFF, activeTeam: team, kickoffGuard: true })
    later(() => get().beginPlay(), TIMING.kickoff)
  },

  // --- Fouls ---
  callFoul: (foulSpot, fouledTeam, inPenaltyBox) => {
    const { activeTeam } = get()
    get().bumpStat(activeTeam, 'fouls')
    set({
      ...clearTurn,
      phase: PHASE.FOUL,
      foulData: { foulSpot, fouledTeam, inPenaltyBox },
      kickoffGuard: false,
    })
    later(() => {
      set({ phase: inPenaltyBox ? PHASE.PENALTY_SETUP : PHASE.FREE_KICK_SETUP, activeTeam: fouledTeam })
      // The scene places the caps as soon as the setup phase starts.
      later(() => {
        const s = get()
        if (s.phase === PHASE.FREE_KICK_SETUP || s.phase === PHASE.PENALTY_SETUP) {
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
  penaltyAttemptResult: (scored) => {
    const { activeTeam, penaltyKicks, penaltyScores } = get()
    const kicks = { ...penaltyKicks, [activeTeam]: penaltyKicks[activeTeam] + 1 }
    const goals = { ...penaltyScores, [activeTeam]: penaltyScores[activeTeam] + (scored ? 1 : 0) }
    set({
      ...clearTurn,
      penaltyKicks: kicks,
      penaltyScores: goals,
      phase: scored ? PHASE.GOAL : PHASE.MISSED,
      lastScorer: scored ? activeTeam : null,
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
    }, TIMING.shootoutResult)
  },

  // --- Audio settings ---
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  muted: false,
  setMasterVolume: (v) => set({ masterVolume: v }),
  setSfxVolume: (v) => set({ sfxVolume: v }),
  setMusicVolume: (v) => set({ musicVolume: v }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  // Phone vibration on flicks, hard cushion hits, goals and fouls
  vibration: true,
  toggleVibration: () => set((s) => ({ vibration: !s.vibration })),
}))
