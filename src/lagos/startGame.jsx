import { createRoot } from 'react-dom/client'
import { loadArtFonts } from '../game/capArt'
import App from '../App'
import { initPersistence } from '../state/persistence'
import { initTournamentWatch } from '../state/tournamentStore'
import { initAudioUnlock } from '../audio/SoundManager'
import { initSavedMatches } from '../state/savedMatch'
import { initClips } from '../game/clips'
import { initCapOverrides } from '../game/capOverrides'
import { useLagosStore, watchMatches } from './lagosStore'
import { initIosAudio } from './iosAudio'
import { watchMatchAnalytics } from '../analytics'
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
  // Count matches started and finished, by mode (our own server, counts only)
  watchMatchAnalytics(useMatchStore, (event, _path, meta) => {
    if (event === 'match_start') useLagosStore.getState().count('match_start', meta?.mode)
    else if (event === 'match_complete') useLagosStore.getState().count('match_end', meta?.mode)
  })
  // ...and how often a phone takes the pitch away (see Scene.jsx)
  globalThis.__counterballCount = (event) => useLagosStore.getState().count(event)

  // Cap artwork is drawn with the game's fonts: have them ready first (they're local, so this is quick)
  Promise.race([loadArtFonts(), new Promise((r) => setTimeout(r, 1500))]).finally(() => {
    createRoot(document.getElementById('root')).render(<App />)
  })
}
