import { useMatchStore } from '../state/MatchStore'

const SAVE_KEY = 'capball_save'

export function saveMatch() {
  const state = useMatchStore.getState()
  const saveData = {
    score: state.score,
    activeTeam: state.activeTeam,
    timeRemaining: state.timeRemaining,
    half: state.half,
    teamConfig: state.teamConfig,
    formations: state.formations,
    stadium: state.stadium,
    team1Side: state.team1Side,
    matchDuration: state.matchDuration,
    gameMode: state.gameMode,
    aiDifficulty: state.aiDifficulty,
    stats: state.stats,
    savedAt: Date.now(),
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData))
    return true
  } catch (e) {
    return false
  }
}

export function loadMatch() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

export function hasSavedMatch() {
  try {
    return !!localStorage.getItem(SAVE_KEY)
  } catch (e) {
    return false
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch (e) {}
}
