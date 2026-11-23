import { createRoot } from 'react-dom/client'
import { loadArtFonts } from '../game/capArt'
import App from '../App'
import { initPersistence } from '../state/persistence'
import { initTournamentWatch, useTournamentStore } from '../state/tournamentStore'
import { initAudioUnlock } from '../audio/SoundManager'
import { initSavedMatches } from '../state/savedMatch'
import { initClips } from '../game/clips'
import { initCapOverrides } from '../game/capOverrides'
import { useLagosStore, watchMatches } from './lagosStore'
import { initIosAudio } from './iosAudio'
import { watchMatchCounts } from './matchCounts'
import { useMatchStore } from '../state/MatchStore'

export function startGame(connection) {
  initPersistence()
  initTournamentWatch()
  initAudioUnlock()
  // Sound on iPhones with the silent switch on (see iosAudio.js)
  initIosAudio()
  initSavedMatches()
  initClips()
  initCapOverrides()
  watchMatches()
  useLagosStore.getState().boot(connection)
  // Count matches started, finished and quit, by mode (our own server, counts only)
  // ...split by what was being played: quick match, career, tournament or the daily challenge
  const kindOf = (s) => {
    const p = useTournamentStore.getState().playing
    if (s.challenge) return 'daily'
    if (s.training) return 'training'
    if (['career', 'careerCup', 'careerCcl'].includes(p?.kind)) return 'career'
    const mode = { ai: 'computer', local: 'local', online: 'online', anytime: 'anytime' }[s.gameMode] ?? 'local'
    if (p) return `tournament_${mode}`
    return mode
  }
  watchMatchCounts(useMatchStore, (event, detail) => useLagosStore.getState().count(event, detail), kindOf)
  // ...and how often a phone takes the pitch away (see Scene.jsx)
  // (with the detail: lost while on screen or in the background, given back or rebuilt)
  globalThis.__counterballCount = (event, detail) => useLagosStore.getState().count(event, detail)

  // Cap artwork is drawn with the game's fonts: have them ready first (they're local, so this is quick)
  Promise.race([loadArtFonts(), new Promise((r) => setTimeout(r, 1500))]).finally(() => {
    createRoot(document.getElementById('root')).render(<App />)
  })
}
