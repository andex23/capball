import { create } from 'zustand'

// App screens
export const SCREEN = {
  SPLASH: 'SPLASH',
  MENU: 'MENU',
  RULES: 'RULES',
  ONLINE: 'ONLINE',
  TEAM_SELECT: 'TEAM_SELECT',
  STADIUM_SELECT: 'STADIUM_SELECT',
  FORMATION: 'FORMATION',
  PLAYING: 'PLAYING',
  MATCH_END: 'MATCH_END',
}

// Turn phases
export const PHASE = {
  IDLE: 'IDLE',
  SELECT: 'SELECT',
  AIM: 'AIM',
  FLICK: 'FLICK',
  RESOLVE: 'RESOLVE',
  SWITCH: 'SWITCH',
  GOAL: 'GOAL',
  KICKOFF: 'KICKOFF',
  FOUL: 'FOUL',
  FREE_KICK_SETUP: 'FREE_KICK_SETUP',
  FREE_KICK_AIM: 'FREE_KICK_AIM',
  PENALTY_SETUP: 'PENALTY_SETUP',
  PENALTY_AIM: 'PENALTY_AIM',
  MATCH_OVER: 'MATCH_OVER',
}

// Match duration options (seconds)
export const MATCH_DURATIONS = [120, 180, 300]

export const useMatchStore = create((set, get) => ({
  // --- App navigation ---
  screen: SCREEN.SPLASH,
  goToScreen: (screen) => set({ screen }),

  // --- Game mode ---
  gameMode: 'local', // 'local' or 'ai'
  aiTeam: 'team2',
  aiDifficulty: 'medium', // 'easy', 'medium', 'hard'
  setGameMode: (mode) => set({ gameMode: mode }),
  setAiDifficulty: (d) => set({ aiDifficulty: d }),

  // --- Team customization ---
  teamConfig: {
    team1: { name: 'Team 1', primary: '#D32F2F', edge: '#FFD700', badge: 'none', numbers: { gk: 1, def1: 4, def2: 5, atk1: 10, atk2: 9 }, pattern: 'none', finish: 'matte' },
    team2: { name: 'Team 2', primary: '#1565C0', edge: '#FFFFFF', badge: 'none', numbers: { gk: 1, def1: 3, def2: 6, atk1: 7, atk2: 11 }, pattern: 'none', finish: 'matte' },
  },
  setTeamConfig: (team, config) => set((s) => ({
    teamConfig: { ...s.teamConfig, [team]: { ...s.teamConfig[team], ...config } }
  })),

  // --- Ball color ---
  ballColor: '#c0c0c0',
  setBallColor: (color) => set({ ballColor: color }),

  // --- Stadium / surface ---
  stadium: 'arena',
  setStadium: (id) => set({ stadium: id }),

  // --- Side selection (which side team1 plays on) ---
  team1Side: 'left', // 'left' or 'right'
  setTeam1Side: (side) => set({ team1Side: side }),

  // --- Formations ---
  formations: { team1: 'default', team2: 'default' },
  setFormation: (team, formation) => set((s) => ({
    formations: { ...s.formations, [team]: formation }
  })),

  // --- Match timer ---
  matchDuration: 180, // default 3 minutes (per half)
  timeRemaining: 90,  // half the match duration
  timerRunning: false,
  paused: false,
  half: 1, // 1 or 2
  firstHalfKicker: 'team1', // who kicked off first half
  setMatchDuration: (d) => set({ matchDuration: d }),

  tickTimer: (dt) => {
    const { timeRemaining, timerRunning, paused, phase, half } = get()
    if (!timerRunning || paused) return
    const activePhases = [PHASE.SELECT, PHASE.AIM, PHASE.FLICK, PHASE.RESOLVE]
    if (!activePhases.includes(phase)) return
    const next = Math.max(0, timeRemaining - dt)
    set({ timeRemaining: next })
    if (next <= 0) {
      if (half === 1) {
        // Half time — swap sides, start second half
        get().startSecondHalf()
      } else {
        get().endMatch()
      }
    }
  },

  togglePause: () => set((s) => ({ paused: !s.paused })),

  // --- Start game ---
  startGame: () => {
    const { matchDuration } = get()
    set({
      screen: SCREEN.PLAYING,
      score: { team1: 0, team2: 0 },
      activeTeam: 'team1',
      phase: PHASE.KICKOFF, // show KICK OFF overlay first
      selectedCapId: null,
      lastConceded: null,
      timeRemaining: Math.floor(matchDuration / 2),
      timerRunning: false, // don't start timer until kickoff completes
      paused: false,
      half: 1,
      foulData: null,
      freeKickCapId: null,
      lastFlickedCapId: null,
      stats: { team1: { shots: 0, fouls: 0, turns: 0 }, team2: { shots: 0, fouls: 0, turns: 0 } },
    })
    // After 2 seconds, whistle blows and play starts
    setTimeout(() => {
      set({ phase: PHASE.SELECT, timerRunning: true })
    }, 2000)
  },

  // --- Half time: swap sides, reset timer for second half ---
  startSecondHalf: () => {
    const { matchDuration, team1Side, firstHalfKicker } = get()
    const newSide = team1Side === 'left' ? 'right' : 'left'
    const secondHalfKicker = firstHalfKicker === 'team1' ? 'team2' : 'team1'
    set({
      team1Side: newSide,
      half: 2,
      timeRemaining: Math.floor(matchDuration / 2),
      timerRunning: false,
      phase: PHASE.KICKOFF,
      activeTeam: secondHalfKicker, // opposite team kicks off second half
      selectedCapId: null,
      foulData: null,
      freeKickCapId: null,
      lastFlickedCapId: null,
    })
    // Show KICK OFF for 2 seconds then play
    setTimeout(() => {
      set({ timerRunning: true, phase: PHASE.SELECT })
    }, 2000)
  },

  // --- End match ---
  endMatch: () => {
    const { score, teamConfig } = get()
    let winner = null
    if (score.team1 > score.team2) winner = 'team1'
    else if (score.team2 > score.team1) winner = 'team2'
    const isDraw = !winner
    set({
      phase: PHASE.MATCH_OVER,
      timerRunning: false,
      matchResult: {
        winner,
        isDraw,
        score: { ...score },
        team1Name: teamConfig.team1.name,
        team2Name: teamConfig.team2.name,
      },
    })
    setTimeout(() => {
      set({ screen: SCREEN.MATCH_END })
    }, 1500)
  },
  matchResult: null,

  // --- Score ---
  score: { team1: 0, team2: 0 },

  // --- Match statistics ---
  stats: {
    team1: { shots: 0, fouls: 0, turns: 0 },
    team2: { shots: 0, fouls: 0, turns: 0 },
  },
  recordShot: (team) => set((s) => ({
    stats: { ...s.stats, [team]: { ...s.stats[team], shots: s.stats[team].shots + 1 } }
  })),
  recordFoul: (team) => set((s) => ({
    stats: { ...s.stats, [team]: { ...s.stats[team], fouls: s.stats[team].fouls + 1 } }
  })),
  recordTurn: (team) => set((s) => ({
    stats: { ...s.stats, [team]: { ...s.stats[team], turns: s.stats[team].turns + 1 } }
  })),

  // --- Turn ---
  activeTeam: 'team1',
  phase: PHASE.SELECT,
  selectedCapId: null,
  lastConceded: null,

  // --- Last flicked cap (for GK goal restriction + foul tracking) ---
  lastFlickedCapId: null,
  setLastFlickedCap: (capId) => set({ lastFlickedCapId: capId }),

  // --- Foul system ---
  freeKickCapId: null, // only this cap can take the free kick/penalty
  foulData: null, // { foulSpot: {x, y}, fouledTeam, inPenaltyBox }
  firstCollisionTracked: false,

  setFirstCollisionTracked: (v) => set({ firstCollisionTracked: v }),

  callFoul: (foulSpot, fouledTeam, inPenaltyBox) => {
    // Record foul against the team that committed it (active team)
    const { activeTeam } = get()
    get().recordFoul(activeTeam)
    set({
      phase: PHASE.FOUL,
      foulData: { foulSpot, fouledTeam, inPenaltyBox },
      selectedCapId: null,
    })
    // After brief display, transition to set piece
    setTimeout(() => {
      const { foulData } = get()
      if (!foulData) return
      if (foulData.inPenaltyBox) {
        set({ phase: PHASE.PENALTY_SETUP, activeTeam: foulData.fouledTeam })
      } else {
        set({ phase: PHASE.FREE_KICK_SETUP, activeTeam: foulData.fouledTeam })
      }
    }, 1200)
  },

  clearFoul: () => set({ foulData: null, freeKickCapId: null }),

  // Start free kick / penalty aim after ball is placed — use normal SELECT flow
  startFreeKickAim: () => set({ phase: PHASE.SELECT, selectedCapId: null }),
  startPenaltyAim: () => set({ phase: PHASE.SELECT, selectedCapId: null }),

  // After set piece resolves
  finishSetPiece: () => {
    set({ foulData: null, phase: PHASE.RESOLVE })
  },

  // --- Drag power (0-1) for power gauge ---
  dragPower: 0,
  setDragPower: (power) => set({ dragPower: power }),

  // --- Actions ---
  selectCap: (capId) => set({ selectedCapId: capId, phase: PHASE.AIM }),

  startFlick: () => set({ phase: PHASE.FLICK }),

  startResolve: () => set({ phase: PHASE.RESOLVE, firstCollisionTracked: false }),

  switchTurn: () => {
    const { activeTeam } = get()
    // Record turn stat
    get().recordTurn(activeTeam)
    set({
      activeTeam: activeTeam === 'team1' ? 'team2' : 'team1',
      phase: PHASE.SELECT,
      selectedCapId: null,
      firstCollisionTracked: false,
      freeKickCapId: null,
      foulData: null,
    })
  },

  scoreGoal: (scoringTeam) => {
    const { score } = get()
    const concedingTeam = scoringTeam === 'team1' ? 'team2' : 'team1'
    set({
      score: { ...score, [scoringTeam]: score[scoringTeam] + 1 },
      phase: PHASE.GOAL,
      lastConceded: concedingTeam,
      selectedCapId: null,
      foulData: null,
      freeKickCapId: null,
    })
  },

  startKickoff: () => set({ phase: PHASE.KICKOFF, freeKickCapId: null }),

  finishKickoff: () => {
    const { lastConceded } = get()
    set({
      activeTeam: lastConceded || 'team1',
      phase: PHASE.SELECT,
      selectedCapId: null,
      firstCollisionTracked: false,
      freeKickCapId: null,
      foulData: null,
    })
  },

  reset: () => {
    const { matchDuration } = get()
    set({
      score: { team1: 0, team2: 0 },
      activeTeam: 'team1',
      phase: PHASE.SELECT,
      selectedCapId: null,
      lastConceded: null,
      timeRemaining: Math.floor(matchDuration / 2),
      timerRunning: true,
      paused: false,
      half: 1,
      foulData: null,
      firstCollisionTracked: false,
      lastFlickedCapId: null,
    })
  },

  // --- Penalty shootout ---
  penaltyShootout: false,
  penaltyRound: 0,        // 0-2 (3 rounds each)
  penaltyTeam: 'team1',   // whose turn to shoot
  penaltyScores: { team1: 0, team2: 0 },

  startPenaltyShootout: () => {
    set({
      screen: SCREEN.PLAYING,
      penaltyShootout: true,
      penaltyRound: 0,
      penaltyTeam: 'team1',
      penaltyScores: { team1: 0, team2: 0 },
      phase: PHASE.KICKOFF,
      activeTeam: 'team1',
      timerRunning: false,
      paused: false,
      foulData: null,
      freeKickCapId: null,
    })
    // Show PENALTY SHOOTOUT text then start
    setTimeout(() => {
      set({ phase: PHASE.SELECT })
    }, 2000)
  },

  // Called after each penalty attempt resolves
  penaltyAttemptResult: (scored) => {
    const { penaltyTeam, penaltyRound, penaltyScores } = get()
    const newScores = { ...penaltyScores }
    if (scored) newScores[penaltyTeam] = newScores[penaltyTeam] + 1

    const nextTeam = penaltyTeam === 'team1' ? 'team2' : 'team1'
    const roundDone = penaltyTeam === 'team2' // both teams have shot this round
    const nextRound = roundDone ? penaltyRound + 1 : penaltyRound

    // Check if shootout is decided (after both teams shot in a round)
    if (roundDone && nextRound <= 3) {
      const remaining = 3 - nextRound
      const diff = Math.abs(newScores.team1 - newScores.team2)
      // If one team can't catch up even if they score all remaining
      if (diff > remaining) {
        // Shootout decided
        const winner = newScores.team1 > newScores.team2 ? 'team1' : 'team2'
        const { teamConfig } = get()
        set({
          penaltyScores: newScores,
          phase: PHASE.MATCH_OVER,
          matchResult: {
            winner,
            isDraw: false,
            score: { ...get().score },
            penaltyScore: { ...newScores },
            team1Name: teamConfig.team1.name,
            team2Name: teamConfig.team2.name,
          },
        })
        setTimeout(() => set({ screen: SCREEN.MATCH_END }), 1500)
        return
      }
    }

    // All 3 rounds done?
    if (nextRound >= 3) {
      const { teamConfig } = get()
      let winner = null
      if (newScores.team1 > newScores.team2) winner = 'team1'
      else if (newScores.team2 > newScores.team1) winner = 'team2'
      set({
        penaltyScores: newScores,
        phase: PHASE.MATCH_OVER,
        matchResult: {
          winner,
          isDraw: !winner,
          score: { ...get().score },
          penaltyScore: { ...newScores },
          team1Name: teamConfig.team1.name,
          team2Name: teamConfig.team2.name,
        },
      })
      setTimeout(() => set({ screen: SCREEN.MATCH_END }), 1500)
      return
    }

    // Continue shootout
    set({
      penaltyScores: newScores,
      penaltyTeam: nextTeam,
      penaltyRound: nextRound,
      activeTeam: nextTeam,
      phase: PHASE.KICKOFF,
      selectedCapId: null,
      freeKickCapId: null,
    })
    setTimeout(() => set({ phase: PHASE.SELECT }), 1500)
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
}))
